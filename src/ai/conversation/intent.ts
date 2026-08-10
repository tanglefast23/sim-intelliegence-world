import type { ConversationPromptSuggestion, StructuredConversationAction } from '../../application/effects/ConversationPort';
import { planHomeInvitation } from '../../domain/invitations/planner';
import { requestRelationshipStage } from '../../domain/relationships/relationship';
import type { WorldState } from '../../domain/state/schema';
import { isDirectAskDateRequest, isDirectHomeInvitationRequest } from './direct-request';

function activeFlagIds(state: WorldState, npcId: string): ReadonlySet<string> {
  return new Set([
    ...(state.npcs[npcId]?.unlockedIds ?? []),
    ...Object.values(state.quests).flatMap(({ flagIds }) => flagIds),
  ]);
}

export function suggestedHomeVisitMinute(state: WorldState, npcId?: string): number {
  const now = state.clock.absoluteMinute;
  const counter = npcId
    ? Object.values(state.invitations)
      .filter((invitation) => (
        invitation.npcId === npcId && invitation.status === 'countered' &&
        invitation.counterProposedMinute !== undefined && invitation.counterProposedMinute >= now + 30
      ))
      .sort((left, right) => (
        (right.counterProposedMinute ?? 0) - (left.counterProposedMinute ?? 0) ||
        right.id.localeCompare(left.id, 'en')
      ))[0]?.counterProposedMinute
    : undefined;
  if (counter !== undefined) return counter;
  let proposed = Math.floor(now / 1_440) * 1_440 + 19 * 60;
  if (proposed < now + 60) proposed += 1_440;
  return proposed;
}

export function detectStructuredConversationAction(
  message: string,
  state: WorldState,
  npcId: string,
): StructuredConversationAction | undefined {
  if (isDirectAskDateRequest(message)) {
    return { kind: 'relationship_stage', targetStage: 'dating', actionId: 'ask_date' };
  }
  if (isDirectHomeInvitationRequest(message)) {
    return { kind: 'home_invitation', proposedMinute: suggestedHomeVisitMinute(state, npcId) };
  }
  return undefined;
}

export function structuredActionFromModelActionId(
  actionId: string | null,
  state: WorldState,
  npcId?: string,
): StructuredConversationAction | undefined {
  if (actionId === 'ask_date') {
    return { kind: 'relationship_stage', targetStage: 'dating', actionId: 'ask_date' };
  }
  if (actionId === 'invite_home') {
    return { kind: 'home_invitation', proposedMinute: suggestedHomeVisitMinute(state, npcId) };
  }
  return undefined;
}

export function conversationPromptSuggestions(
  state: WorldState,
  npcId: string,
): ConversationPromptSuggestion[] {
  const suggestions: ConversationPromptSuggestion[] = [];
  const relationship = state.relationships[npcId];
  const npc = state.npcs[npcId];
  if (!relationship || !npc || npc.tier !== 'full_ai') return suggestions;

  const dateDecision = requestRelationshipStage(
    relationship,
    'dating',
    'ask_date',
    activeFlagIds(state, npcId),
    false,
  );
  if (dateDecision.accepted) {
    suggestions.push({
      id: 'ask_out',
      label: 'ASK OUT',
      suggestedText: 'Would you like to go on a date with me?',
    });
  }

  const hasSuccessfulVisit = Object.values(state.invitations).some((invitation) => (
    invitation.npcId === npcId && ['accepted', 'completed'].includes(invitation.status)
  ));
  if (!hasSuccessfulVisit) {
    const proposedMinute = suggestedHomeVisitMinute(state, npcId);
    const plan = planHomeInvitation(state, {
      invitationId: `invitation_suggestion_${npcId}`,
      npcId,
      sourceConversationId: 'conversation_suggestion_probe',
      proposedMinute,
      durationMinutes: 120,
    });
    if (['accepted', 'countered'].includes(plan.invitation.status)) {
      suggestions.push({
        id: 'invite_home',
        label: 'INVITE HOME',
        suggestedText: proposedMinute === suggestedHomeVisitMinute({ ...state, invitations: {} })
          ? 'Would you like to visit my villa at 7 PM?'
          : 'Would you like to visit my villa at the time you suggested?',
      });
    }
  }
  return suggestions;
}
