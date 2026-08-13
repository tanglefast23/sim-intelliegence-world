import type { InferencePort } from '../../application/effects/InferencePort';
import type {
  CompleteVerbalMissionTurnResult,
  ConfirmVerbalMissionGoalRequest,
  ConfirmVerbalMissionGoalResult,
  ReadVerbalMissionTurnResult,
} from '../../application/effects/ConversationPort';
import { reduceCommand } from '../../domain/commands/reducer';
import { DomainCommandSchema } from '../../domain/commands/types';
import type {
  NpcDisposition,
  VerbalMissionDefinition,
  VerbalMove,
} from '../../domain/verbal-missions/contracts';
import {
  authoredPlayerKnowledgeRecord,
  PRIYA_ASSESSMENT_COMMITMENT_ID,
} from '../../domain/verbal-missions/goal-planners';
import { runOutcomeEngine, type VerbalMissionOutcome } from '../../domain/verbal-missions/outcome-engine';
import type { VerbalMissionState } from '../../domain/verbal-missions/state';
import type { WorldState } from '../../domain/state/schema';
import { AUTHORED_POLICY_RESPONSES, deterministicPolicyDecision } from '../policy/content-policy';
import type { CharacterWriting } from '../registry/scene-registry';
import type { PromptTurn } from '../projection/prompt-projection';
import { completeVerbalMissionActor, type VerbalMissionActorDiagnostic } from './verbal-mission-actor';
import { readVerbalMove } from './verbal-mission-reader';
import type {
  VerbalMissionPromptFact,
  VerbalMissionPromptReferent,
} from './verbal-mission-prompts';
import { ConversationTransaction, encodedIdPart } from './transaction';

export type VerbalMissionSessionContent = Readonly<{
  definition: VerbalMissionDefinition;
  disposition: NpcDisposition;
  referents: readonly VerbalMissionPromptReferent[];
  facts: readonly VerbalMissionPromptFact[];
  readTheRoomLines: Readonly<Record<string, string>>;
  speakableFactTexts: Readonly<Record<string, string>>;
}>;

export interface VerbalMissionContentStore {
  get(missionId: string): Promise<VerbalMissionSessionContent>;
}

type DecidedTurn = {
  message: string;
  read: Extract<ReadVerbalMissionTurnResult, { kind: 'decided' }>;
  outcome: VerbalMissionOutcome;
  mission: VerbalMissionState;
  speakableFactTexts: readonly string[];
  complete?: CompleteVerbalMissionTurnResult;
};
type ClarifiedTurn = Readonly<{
  message: string;
  read: Extract<ReadVerbalMissionTurnResult, { kind: 'clarify' }>;
}>;

function words(source: string): Set<string> {
  return new Set(source.toLocaleLowerCase('en').match(/[a-z0-9]+/gu)?.filter((word) => word.length > 2) ?? []);
}

function textMatches(message: string, values: readonly string[]): boolean {
  const lower = message.toLocaleLowerCase('en');
  const messageWords = words(message);
  return values.some((value) => {
    const candidate = value.toLocaleLowerCase('en');
    return lower.includes(candidate) || [...words(candidate)].some((word) => messageWords.has(word));
  });
}

function requiredCandidateIds(definition: VerbalMissionDefinition) {
  const contract = definition.goalContract;
  if (contract.kind === 'disclose_fact') {
    return { referents: new Set([contract.recipientId]), facts: new Set([contract.factId]) };
  }
  if (contract.kind === 'buy_object') {
    return { referents: new Set([contract.objectId]), facts: new Set<string>() };
  }
  return {
    referents: new Set([contract.actionId, contract.subjectNpcId, contract.locationId]),
    facts: new Set<string>(),
  };
}

function narrowCandidates(
  content: VerbalMissionSessionContent,
  message: string,
  recentFocusIds: readonly string[],
) {
  const required = requiredCandidateIds(content.definition);
  const focus = new Set(recentFocusIds);
  const referents = [
    ...content.referents.filter(({ id }) => required.referents.has(id)),
    ...content.referents.filter(({ id, label, aliases }) => !required.referents.has(id) && (
      focus.has(id) || textMatches(message, [label, ...(aliases ?? [])])
    )),
  ].slice(0, 8);
  const facts = [
    ...content.facts.filter(({ id }) => required.facts.has(id)),
    ...content.facts.filter(({ id, description, aliases }) => !required.facts.has(id) && (
      focus.has(id) || textMatches(message, [description, ...(aliases ?? [])])
    )),
  ].slice(0, 8);
  return { referents, facts };
}

function uniqueNumber(matches: IterableIterator<RegExpMatchArray>): Readonly<{ value: number | null; evidence?: string }> {
  const candidates = [...matches].map((match) => ({
    value: Number((match[1] ?? match[2])?.replaceAll(',', '')),
    evidence: match[0],
  })).filter(({ value }) => Number.isSafeInteger(value) && value >= 0);
  const values = [...new Set(candidates.map(({ value }) => value))];
  if (values.length !== 1) return { value: null };
  return { value: values[0]!, evidence: candidates[0]?.evidence };
}

function exactScheduleTime(message: string, absoluteMinute: number): Readonly<{ value: number | null; evidence?: string }> {
  const candidates: Array<{ value: number; evidence: string }> = [];
  for (const match of message.matchAll(/\b(?:(\d{1,2}):(\d{2})|(\d{1,2})\s*(a\.?m\.?|p\.?m\.?))\b/giu)) {
    let hour = Number(match[1] ?? match[3]);
    const minute = Number(match[2] ?? 0);
    const meridiem = match[4]?.toLocaleLowerCase('en').replaceAll('.', '');
    if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute > 59) continue;
    if (meridiem) {
      if (hour < 1 || hour > 12) continue;
      hour = hour % 12 + (meridiem === 'pm' ? 12 : 0);
    } else if (hour > 23) continue;
    const dayStart = Math.floor(absoluteMinute / 1_440) * 1_440;
    let value = dayStart + hour * 60 + minute;
    if (/\btomorrow\b/iu.test(message)) value += 1_440;
    else if (value < absoluteMinute) value += 1_440;
    if (Number.isSafeInteger(value)) candidates.push({ value, evidence: match[0] });
  }
  const minuteCandidate = uniqueNumber(message.matchAll(/\bminute\s+(\d+)\b/giu));
  if (minuteCandidate.value !== null && minuteCandidate.evidence) {
    candidates.push({ value: minuteCandidate.value, evidence: minuteCandidate.evidence });
  }
  const values = [...new Set(candidates.map(({ value }) => value))];
  if (values.length !== 1) return { value: null };
  return { value: values[0]!, evidence: candidates[0]?.evidence };
}

export function parseVerbalMissionExactTerms(
  message: string,
  mission: VerbalMissionState,
  absoluteMinute: number,
): Readonly<{
  exactOfferAmount: number | null;
  exactProposedMinute: number | null;
  action?: Readonly<{ act: 'offer'; evidenceText: string; referentId: string }>;
}> {
  if (mission.goalKind === 'buy_object') {
    const amount = uniqueNumber(message.matchAll(/\$\s*(\d[\d,]*)|\b(\d[\d,]*)\s*(?:dollars?|bucks?)\b/giu));
    return {
      exactOfferAmount: amount.value,
      exactProposedMinute: null,
      ...(amount.value !== null && amount.evidence && /\b(?:offer|pay|buy|give)\b/iu.test(message)
        ? { action: { act: 'offer' as const, evidenceText: amount.evidence, referentId: mission.terms.objectId } }
        : {}),
    };
  }
  if (mission.goalKind === 'schedule_cooperation') {
    const minute = exactScheduleTime(message, absoluteMinute);
    return {
      exactOfferAmount: null,
      exactProposedMinute: minute.value,
      ...(minute.value !== null && minute.evidence && /\b(?:schedule|time|appointment|assess|minute)\b/iu.test(message)
        ? { action: { act: 'offer' as const, evidenceText: minute.evidence, referentId: mission.terms.subjectNpcId } }
        : {}),
    };
  }
  return { exactOfferAmount: null, exactProposedMinute: null };
}

function applyExplicitAction(move: VerbalMove, action: ReturnType<typeof parseVerbalMissionExactTerms>['action']): VerbalMove {
  if (!action || move.acts.some(({ act }) => act === action.act)) return move;
  return { ...move, acts: [action, ...move.acts].slice(0, 3) };
}

function referentLabel(content: VerbalMissionSessionContent, id: string): string {
  const label = content.referents.find((referent) => referent.id === id)?.label;
  if (!label) throw new Error(`Missing Verbal Mission referent label: ${id}`);
  return label;
}

function factLabel(content: VerbalMissionSessionContent, id: string): string {
  const label = content.facts.find((fact) => fact.id === id)?.description;
  if (!label) throw new Error(`Missing Verbal Mission fact label: ${id}`);
  return label;
}

function confirmationFor(content: VerbalMissionSessionContent, mission: VerbalMissionState, canConfirm: boolean) {
  if (!canConfirm) return null;
  if (mission.goalKind === 'disclose_fact') {
    return {
      goalKind: mission.goalKind,
      factId: mission.terms.factId,
      factLabel: factLabel(content, mission.terms.factId),
      recipientId: mission.terms.recipientId,
      recipientLabel: referentLabel(content, mission.terms.recipientId),
    } as const;
  }
  if (mission.goalKind === 'buy_object' && mission.terms.currentOffer !== null) {
    return {
      goalKind: mission.goalKind,
      objectId: mission.terms.objectId,
      objectLabel: referentLabel(content, mission.terms.objectId),
      confirmedAmount: mission.terms.currentOffer,
    } as const;
  }
  if (mission.goalKind === 'schedule_cooperation' && mission.terms.proposedMinute !== null) {
    return {
      goalKind: mission.goalKind,
      actionId: mission.terms.actionId,
      actionLabel: referentLabel(content, mission.terms.actionId),
      subjectNpcId: mission.terms.subjectNpcId,
      subjectLabel: referentLabel(content, mission.terms.subjectNpcId),
      locationId: mission.terms.locationId,
      locationLabel: referentLabel(content, mission.terms.locationId),
      scheduledMinute: mission.terms.proposedMinute,
    } as const;
  }
  return null;
}

export class VerbalMissionSession {
  readonly #turns = new Map<string, DecidedTurn | ClarifiedTurn>();
  readonly #recentFocusIds: string[] = [];
  #pendingTurnId?: string;
  #hasDecidedTurn = false;
  #settled?: ConfirmVerbalMissionGoalResult;

  constructor(
    readonly missionId: string,
    private readonly conversationId: string,
    private readonly inference: InferencePort,
    private readonly character: CharacterWriting,
    private readonly transaction: ConversationTransaction,
    private readonly content: VerbalMissionSessionContent,
    private readonly recentTurns: PromptTurn[],
    private readonly signal: AbortSignal,
    private readonly onActorDiagnostic?: (diagnostic: VerbalMissionActorDiagnostic) => void,
  ) {
    const mission = transaction.previewState.verbalMissions[missionId];
    if (!mission || !['available', 'active'].includes(mission.status)) throw new Error('Verbal Mission session requires an unresolved mission.');
    if (
      content.definition.missionId !== missionId || content.definition.npcId !== mission.npcId ||
      content.disposition.dispositionId !== content.definition.dispositionId ||
      content.disposition.npcId !== mission.npcId
    ) throw new Error('Verbal Mission content does not match the active mission.');
  }

  get hasDecidedTurn(): boolean {
    return this.#hasDecidedTurn;
  }

  summary() {
    const mission = this.transaction.previewState.verbalMissions[this.missionId];
    if (!mission || (mission.status !== 'available' && mission.status !== 'active')) {
      throw new Error('Verbal Mission session lost its mission.');
    }
    return {
      missionId: mission.missionId,
      goalKind: mission.goalKind,
      status: mission.status,
      roomState: mission.roomState,
    } as const;
  }

  async read(turnId: string, messageCandidate: string): Promise<ReadVerbalMissionTurnResult> {
    if (this.#settled) throw new Error('Verbal Mission session is already settled.');
    const message = messageCandidate.trim();
    if (message.length === 0 || message.length > 500) throw new Error('Player message length is invalid.');
    const cached = this.#turns.get(turnId);
    if (cached) {
      if (cached.message !== message) throw new Error('Conversation turn ID was already used.');
      return cached.read;
    }
    if (this.#pendingTurnId) throw new Error('Complete the pending Verbal Mission turn before sending another input.');
    if (deterministicPolicyDecision(message)) {
      const clarification = {
        kind: 'clarify' as const,
        conversationId: this.conversationId,
        turnId,
        dialogue: AUTHORED_POLICY_RESPONSES.refuse,
        source: 'authored-clarification' as const,
      };
      this.#turns.set(turnId, { message, read: clarification });
      return clarification;
    }

    const state = this.transaction.previewState;
    const current = state.verbalMissions[this.missionId];
    if (!current || !['available', 'active'].includes(current.status)) throw new Error('Verbal Mission is no longer unresolved.');
    const terms = parseVerbalMissionExactTerms(message, current, state.clock.absoluteMinute);
    const candidates = narrowCandidates(this.content, message, this.#recentFocusIds);
    const reader = await readVerbalMove(this.inference, {
      playerMessage: message,
      referents: candidates.referents,
      facts: candidates.facts,
      recentFocusIds: this.#recentFocusIds,
    }, this.signal);
    if (reader.kind === 'clarify') {
      const clarification = {
        kind: 'clarify' as const,
        conversationId: this.conversationId,
        turnId,
        dialogue: 'I am not sure what you mean. Please say the request another way.',
        source: 'authored-clarification' as const,
      };
      this.#turns.set(turnId, { message, read: clarification });
      return clarification;
    }
    const move = applyExplicitAction(reader.move, terms.action);
    const outcome = runOutcomeEngine({
      mission: current,
      definition: this.content.definition,
      disposition: this.content.disposition,
      move,
      context: {
        playerFactIds: Object.keys(state.playerKnowledge).sort(),
        npcFactIds: (state.npcs[current.npcId]?.knowledge ?? []).map(({ factId }) => factId).sort(),
        contradictedFactIds: Object.values(state.playerKnowledge)
          .filter(({ truthStatus }) => truthStatus === 'contradicted').map(({ factId }) => factId).sort(),
        playerMoney: state.inventory.money,
        objectOwners: Object.fromEntries(Object.entries(state.worldObjects).map(([id, object]) => [id, object.ownerId])),
        absoluteMinute: state.clock.absoluteMinute,
        exactOfferAmount: terms.exactOfferAmount,
        exactProposedMinute: terms.exactProposedMinute,
      },
    });
    const readTheRoom = this.content.readTheRoomLines[outcome.readTheRoomId];
    if (!readTheRoom) throw new Error(`Missing Read the Room line: ${outcome.readTheRoomId}`);
    const speakableFactTexts = outcome.newlySpeakableFactIds.map((factId) => {
      const text = this.content.speakableFactTexts[factId];
      if (!text) throw new Error(`Missing speakable fact text: ${factId}`);
      return text;
    });
    const knowledgeRecords = outcome.newlySpeakableFactIds.map(authoredPlayerKnowledgeRecord);
    const nextMission = { ...outcome.mission, status: 'active' as const };
    const part = `${encodedIdPart(this.conversationId)}-${encodedIdPart(turnId)}`;
    const outcomeId = `verbal_outcome_${encodedIdPart(this.conversationId)}_${encodedIdPart(turnId)}`;
    const commands = [DomainCommandSchema.parse({
      type: 'apply-verbal-mission-outcome',
      commandId: `command-verbal-outcome-${part}`,
      eventId: `event-verbal-outcome-${part}`,
      scheduledMinute: state.clock.absoluteMinute,
      priority: 100,
      outcomeId,
      outcome: outcome.outcome,
      reactionId: outcome.reactionId,
      expectedMission: current,
      nextMission,
    }), ...knowledgeRecords.map((record, index) => DomainCommandSchema.parse({
        type: 'record-player-knowledge',
        commandId: `command-verbal-fact-${part}-${index}`,
        eventId: `event-verbal-fact-${part}-${index}`,
        scheduledMinute: state.clock.absoluteMinute,
        priority: 90 - index,
        record,
      }))];
    this.transaction.stageVerbalMissionCommands(commands);
    move.acts.forEach(({ referentId }) => {
      if (referentId && !this.#recentFocusIds.includes(referentId)) this.#recentFocusIds.push(referentId);
    });
    move.claims.forEach(({ factId }) => {
      if (!this.#recentFocusIds.includes(factId)) this.#recentFocusIds.push(factId);
    });
    this.#recentFocusIds.splice(0, Math.max(0, this.#recentFocusIds.length - 8));
    const stagedMission = this.transaction.previewState.verbalMissions[this.missionId]!;
    const read: Extract<ReadVerbalMissionTurnResult, { kind: 'decided' }> = {
      kind: 'decided',
      conversationId: this.conversationId,
      turnId,
      missionId: this.missionId,
      outcomeId,
      outcome: outcome.outcome,
      reactionId: outcome.reactionId,
      readTheRoom,
      portraitId: outcome.portraitId,
      cueId: outcome.cueId,
      concernTransitions: [...outcome.concernTransitions],
      recall: [...speakableFactTexts],
      roomState: stagedMission.roomState,
      stagedChangeCount: commands.length,
      confirmation: confirmationFor(this.content, stagedMission, outcome.canConfirm),
    };
    this.#turns.set(turnId, { message, read, outcome, mission: stagedMission, speakableFactTexts });
    this.#pendingTurnId = turnId;
    this.#hasDecidedTurn = true;
    return read;
  }

  async complete(turnId: string): Promise<CompleteVerbalMissionTurnResult> {
    const turn = this.#turns.get(turnId);
    if (!turn || !('outcome' in turn)) throw new Error('Verbal Mission turn has no decided outcome.');
    if (turn.complete) return turn.complete;
    if (this.#pendingTurnId !== turnId) throw new Error('Verbal Mission turn is not pending completion.');
    const actor = await completeVerbalMissionActor({
      inference: this.inference,
      state: this.transaction.previewState,
      character: this.character,
      mission: turn.mission,
      playerMessage: turn.message,
      recentTurns: this.recentTurns,
      outcome: turn.outcome,
      speakableFactTexts: turn.speakableFactTexts,
      signal: this.signal,
      onDiagnostic: this.onActorDiagnostic,
    });
    const complete = {
      conversationId: this.conversationId,
      turnId,
      dialogue: actor.dialogue,
      emotion: actor.emotion,
      source: actor.source,
    } as const;
    turn.complete = complete;
    this.#pendingTurnId = undefined;
    this.recentTurns.push({ speaker: 'player', text: turn.message }, { speaker: 'npc', text: actor.dialogue });
    return complete;
  }

  confirm(request: ConfirmVerbalMissionGoalRequest): ConfirmVerbalMissionGoalResult {
    if (this.#settled) return this.#settled;
    if (this.#pendingTurnId) throw new Error('Complete the pending Verbal Mission turn before confirmation.');
    const committed = this.transaction.commit();
    const mission = committed.verbalMissions[this.missionId];
    if (!mission) throw new Error('Verbal Mission confirmation lost its mission.');
    const part = encodedIdPart(this.conversationId);
    try {
      const command = request.goalKind === 'disclose_fact'
        ? DomainCommandSchema.parse({
          type: 'record-fact-disclosure', commandId: `command-verbal-confirm-${part}`,
          eventId: `event-verbal-confirm-${part}`, scheduledMinute: committed.clock.absoluteMinute,
          priority: 100, missionId: this.missionId,
        })
        : request.goalKind === 'buy_object'
          ? DomainCommandSchema.parse({
            type: 'purchase-unique-object', commandId: `command-verbal-confirm-${part}`,
            eventId: `event-verbal-confirm-${part}`, scheduledMinute: committed.clock.absoluteMinute,
            priority: 100, missionId: this.missionId, confirmedAmount: request.confirmedAmount,
          })
          : DomainCommandSchema.parse({
            type: 'create-scheduled-commitment', commandId: `command-verbal-confirm-${part}`,
            eventId: `event-verbal-confirm-${part}`, scheduledMinute: committed.clock.absoluteMinute,
            priority: 100, missionId: this.missionId,
            commitmentId: PRIYA_ASSESSMENT_COMMITMENT_ID, commitmentMinute: request.scheduledMinute,
          });
      if (mission.goalKind !== request.goalKind) throw new Error('Confirmation goal family does not match the mission.');
      const result = reduceCommand(committed, command);
      const event = result.event;
      if (!event) throw new Error('Verbal Mission confirmation produced no receipt.');
      const receipt = event.type === 'fact-disclosure-recorded'
        ? { resultId: event.resultId, journalReceiptId: event.journalReceiptId }
        : event.type === 'unique-object-purchased'
          ? { resultId: event.resultId, journalReceiptId: event.journalReceiptId }
          : event.type === 'scheduled-commitment-created'
            ? { resultId: 'priya_assessment_agreed', journalReceiptId: event.journalReceiptId }
            : undefined;
      if (!receipt) throw new Error('Verbal Mission confirmation used an unexpected event.');
      this.#settled = {
        kind: 'confirmed', missionId: this.missionId, ...receipt, state: result.state,
      };
    } catch {
      this.#settled = {
        kind: 'rejected', missionId: this.missionId,
        reasonId: 'goal_confirmation_invalid', state: committed,
      };
    }
    return this.#settled;
  }

  close(discardIfUndecided: boolean): WorldState {
    if (this.#settled) return this.#settled.state;
    return discardIfUndecided && !this.#hasDecidedTurn
      ? this.transaction.discard()
      : this.transaction.commit();
  }
}
