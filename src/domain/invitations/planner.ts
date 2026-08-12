import { PROTOTYPE_ECONOMY_POLICY } from '../economy/economy';
import { resolveChangeableRejections, type RejectionRecord, type RelationshipState } from '../relationships/relationship';
import type { NpcStateSchema, TransferStateSchema } from '../state/models';
import type { WorldState } from '../state/schema';
import type { z } from 'zod';
import { HomeInvitationRequestSchema, InvitationStateSchema, type HomeInvitationRequest, type InvitationState } from './schema';

type NpcState = z.infer<typeof NpcStateSchema>;
type TransferState = z.infer<typeof TransferStateSchema>;

export type HomeInvitationPlan = Readonly<{
  invitation: InvitationState;
  relationship: RelationshipState;
  npc: NpcState;
  transfer?: TransferState;
  changed: boolean;
}>;

function activeFlags(state: WorldState, npcId: string): ReadonlySet<string> {
  return new Set([
    ...(state.npcs[npcId]?.unlockedIds ?? []),
    ...Object.values(state.quests).flatMap(({ flagIds }) => flagIds),
  ]);
}

function minuteOfDay(absoluteMinute: number): number {
  return absoluteMinute % 1_440;
}

function overlaps(leftStart: number, leftDuration: number, rightStart: number, rightDuration: number): boolean {
  return leftStart < rightStart + rightDuration && rightStart < leftStart + leftDuration;
}

const INVITATION_BUSY_ACTIVITY_IDS = new Set(['shop', 'sleep', 'work']);

function conflictsWithSchedule(state: WorldState, npcId: string, start: number, duration: number): boolean {
  const schedule = Object.values(state.schedules).find((candidate) => candidate.npcId === npcId);
  if (!schedule) return true;
  const firstDay = Math.floor(start / 1_440) - 1;
  const lastDay = Math.floor((start + duration - 1) / 1_440);
  for (let day = firstDay; day <= lastDay; day += 1) {
    for (let index = 0; index < schedule.blocks.length; index += 1) {
      const block = schedule.blocks[index]!;
      if (!INVITATION_BUSY_ACTIVITY_IDS.has(block.activityId)) continue;
      const blockStart = day * 1_440 + block.startMinuteOfDay;
      const nextBlock = schedule.blocks[index + 1];
      const blockEnd = nextBlock
        ? day * 1_440 + nextBlock.startMinuteOfDay
        : (day + 1) * 1_440 + schedule.blocks[0]!.startMinuteOfDay;
      if (overlaps(start, duration, blockStart, blockEnd - blockStart)) return true;
    }
  }
  return false;
}

function conflictsWithInvitation(state: WorldState, npcId: string, start: number, duration: number): boolean {
  return Object.values(state.invitations).some((invitation) => (
    invitation.npcId === npcId &&
    ['accepted', 'completed'].includes(invitation.status) &&
    invitation.scheduledMinute !== undefined &&
    overlaps(start, duration, invitation.scheduledMinute, invitation.durationMinutes)
  ));
}

function available(state: WorldState, npcId: string, start: number, duration: number): boolean {
  const time = minuteOfDay(start);
  return time >= 10 * 60 && time + duration <= 22 * 60 &&
    !conflictsWithSchedule(state, npcId, start, duration) &&
    !conflictsWithInvitation(state, npcId, start, duration);
}

function nextAvailableMinute(state: WorldState, npcId: string, proposed: number, duration: number): number {
  let candidate = Math.max(proposed, state.clock.absoluteMinute + 60);
  candidate = Math.ceil(candidate / 60) * 60;
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const time = minuteOfDay(candidate);
    if (time < 10 * 60) candidate += 10 * 60 - time;
    else if (time + duration > 22 * 60) candidate += 1_440 - time + 10 * 60;
    if (available(state, npcId, candidate, duration)) return candidate;
    candidate += 60;
  }
  throw new Error('No invitation time is available in the next two days.');
}

function invitation(
  request: HomeInvitationRequest,
  status: InvitationState['status'],
  reasonId: string,
  feedback: string,
  extras: Partial<InvitationState> = {},
): InvitationState {
  return InvitationStateSchema.parse({
    id: request.invitationId,
    npcId: request.npcId,
    sourceConversationId: request.sourceConversationId,
    actionId: 'invite_home',
    destinationLocationId: 'protagonist_villa',
    destinationMapId: 'northwest_residential',
    proposedMinute: request.proposedMinute,
    durationMinutes: request.durationMinutes,
    status,
    responseReasonId: reasonId,
    feedback,
    ...extras,
  });
}

function repeatedRejectedInvitation(
  state: WorldState,
  request: HomeInvitationRequest,
  reasonId: string,
): InvitationState | undefined {
  return Object.values(state.invitations).find((candidate) => (
    candidate.npcId === request.npcId &&
    candidate.proposedMinute === request.proposedMinute &&
    candidate.durationMinutes === request.durationMinutes &&
    candidate.destinationLocationId === 'protagonist_villa' &&
    candidate.status === 'rejected' &&
    candidate.responseReasonId === reasonId
  ));
}

function rejectedPlan(
  state: WorldState,
  request: HomeInvitationRequest,
  relationship: RelationshipState,
  npc: NpcState,
  reasonId: string,
  feedback: string,
): HomeInvitationPlan {
  const repeated = repeatedRejectedInvitation(state, request, reasonId);
  return repeated
    ? { invitation: repeated, relationship, npc, changed: false }
    : { invitation: invitation(request, 'rejected', reasonId, feedback), relationship, npc, changed: true };
}

export function planHomeInvitation(state: WorldState, input: HomeInvitationRequest): HomeInvitationPlan {
  const request = HomeInvitationRequestSchema.parse(input);
  const npc = state.npcs[request.npcId];
  const relationship = state.relationships[request.npcId];
  if (!npc || !relationship) throw new Error('Invitation requires an existing NPC relationship.');
  const existing = state.invitations[request.invitationId];
  if (existing) {
    if (
      existing.npcId !== request.npcId || existing.proposedMinute !== request.proposedMinute ||
      existing.sourceConversationId !== request.sourceConversationId
    ) {
      throw new Error('Invitation ID cannot be reused for different details.');
    }
    return { invitation: existing, relationship, npc, changed: false };
  }
  const repeated = Object.values(state.invitations).find((candidate) => (
    candidate.npcId === request.npcId &&
    candidate.proposedMinute === request.proposedMinute &&
    candidate.durationMinutes === request.durationMinutes &&
    candidate.destinationLocationId === 'protagonist_villa' &&
    candidate.status === 'accepted'
  ));
  if (repeated) return { invitation: repeated, relationship, npc, changed: false };

  const flags = activeFlags(state, request.npcId);
  const resolved = resolveChangeableRejections(relationship.rejections, flags);
  const relationshipWithResolutions = { ...relationship, rejections: resolved };
  const boundary = relationship.policy.hardBoundaries.find(({ blockedActionIds }) => blockedActionIds.includes('invite_home'));
  if (boundary) {
    const record: RejectionRecord = {
      reasonId: boundary.id, kind: 'permanent_boundary', sourceActionId: 'invite_home', resolved: false,
    };
    const rejections = resolved.some(({ reasonId }) => reasonId === record.reasonId) ? resolved : [...resolved, record];
    return rejectedPlan(
      state,
      request,
      { ...relationshipWithResolutions, rejections },
      npc,
      boundary.id,
      'That invitation crosses a boundary.',
    );
  }
  const rejection = resolved.find((record) => !record.resolved && record.sourceActionId === 'invite_home');
  if (rejection) {
    return rejectedPlan(
      state,
      request,
      relationshipWithResolutions,
      npc,
      rejection.reasonId,
      'The current situation makes a home visit unsafe.',
    );
  }
  if (!relationship.compatibility.social || relationship.values.familiarity < 10) {
    return rejectedPlan(
      state,
      request,
      relationshipWithResolutions,
      npc,
      'not_familiar_enough',
      'We do not know each other well enough yet.',
    );
  }
  if (
    request.proposedMinute < state.clock.absoluteMinute + PROTOTYPE_ECONOMY_POLICY.npcTravelMinutes ||
    !available(state, request.npcId, request.proposedMinute, request.durationMinutes)
  ) {
    const counterProposedMinute = nextAvailableMinute(state, request.npcId, request.proposedMinute, request.durationMinutes);
    return {
      invitation: invitation(request, 'countered', 'schedule_conflict', 'That time clashes with the schedule. Another time is available.', {
        counterProposedMinute,
      }),
      relationship: relationshipWithResolutions, npc, changed: true,
    };
  }

  if (npc.presence.kind === 'in_transit') {
    return {
      invitation: invitation(request, 'replan_required', 'already_in_transit', 'Travel is already in progress. Replan after arrival.'),
      relationship: relationshipWithResolutions, npc, changed: true,
    };
  }
  if (Object.values(state.transfers).some(({ npcId }) => npcId === npc.id)) {
    return {
      invitation: invitation(request, 'replan_required', 'travel_unavailable', 'Travel cannot be reserved from the current state.'),
      relationship: relationshipWithResolutions, npc, changed: true,
    };
  }

  return {
    invitation: invitation(request, 'accepted', 'accepted', 'The visit is scheduled. Travel will use the visitor’s actual location.', {
      scheduledMinute: request.proposedMinute,
    }),
    relationship: relationshipWithResolutions,
    npc,
    changed: true,
  };
}

export function replanInvitationForTransfer(
  invitations: WorldState['invitations'],
  transferId: string,
  reasonId: string,
  feedback: string,
): WorldState['invitations'] {
  const current = Object.values(invitations).find((candidate) => candidate.transferId === transferId);
  if (!current) return invitations;
  return replanInvitation(invitations, current.id, reasonId, feedback);
}

export function replanInvitation(
  invitations: WorldState['invitations'],
  invitationId: string,
  reasonId: string,
  feedback: string,
): WorldState['invitations'] {
  const current = invitations[invitationId];
  if (!current) return invitations;
  return {
    ...invitations,
    [current.id]: InvitationStateSchema.parse({
      ...current,
      status: 'replan_required',
      responseReasonId: reasonId,
      feedback,
      transferId: undefined,
      preparedAtMinute: undefined,
    }),
  };
}

export function prepareInvitationAfterTransferArrival(
  invitations: WorldState['invitations'],
  transferId: string,
  preparedAtMinute: number,
): WorldState['invitations'] {
  const current = Object.values(invitations).find((candidate) => candidate.transferId === transferId);
  if (!current) return invitations;
  return {
    ...invitations,
    [current.id]: InvitationStateSchema.parse({
      ...current,
      transferId: undefined,
      preparedAtMinute,
    }),
  };
}

export function completeInvitationForTransfer(
  invitations: WorldState['invitations'],
  transferId: string,
): WorldState['invitations'] {
  const current = Object.values(invitations).find((candidate) => candidate.transferId === transferId);
  if (!current) return invitations;
  return {
    ...invitations,
    [current.id]: InvitationStateSchema.parse({
      ...current,
      status: 'completed',
      responseReasonId: 'visit_arrived',
      feedback: 'The visitor arrived at the villa.',
      transferId: undefined,
    }),
  };
}

export function completeLocalInvitation(
  invitations: WorldState['invitations'],
  invitationId: string,
): WorldState['invitations'] {
  const current = invitations[invitationId];
  if (!current || current.status !== 'accepted') return invitations;
  return {
    ...invitations,
    [current.id]: InvitationStateSchema.parse({
      ...current,
      status: 'completed',
      responseReasonId: 'visit_arrived',
      feedback: 'The visitor arrived at the villa.',
      transferId: undefined,
      preparedAtMinute: undefined,
    }),
  };
}

export function cancelInvitation(invitationState: InvitationState, reasonId: string): InvitationState {
  const current = InvitationStateSchema.parse(invitationState);
  if (!['accepted', 'countered', 'replan_required'].includes(current.status)) {
    throw new Error('Only an active invitation can be cancelled.');
  }
  return InvitationStateSchema.parse({
    ...current,
    status: 'cancelled',
    responseReasonId: reasonId,
    feedback: 'The invitation was cancelled. A new plan is required.',
    transferId: undefined,
    preparedAtMinute: undefined,
    scheduledMinute: current.scheduledMinute ?? current.counterProposedMinute ?? current.proposedMinute,
  });
}
