import type { KnowledgeRecordSchema } from '../../domain/state/models';
import type { WorldState } from '../../domain/state/schema';
import type { z } from 'zod';
import type { ConversationResponse } from '../schemas/conversation-response';
import type { SceneRegistry } from '../registry/scene-registry';
import { isPositiveFirstPersonCatClaim, type TurnCandidateRegistry } from '../registry/turn-candidates';

type KnowledgeRecord = z.infer<typeof KnowledgeRecordSchema>;

export type ApprovedTurn = Readonly<{
  dialogue: string;
  emotion: ConversationResponse['emotion'];
  intent: ConversationResponse['intent'];
  actionId: string | null;
  knowledge: readonly KnowledgeRecord[];
  unlockedInterestIds: readonly string[];
  unlockedIds: readonly string[];
  memories: readonly Readonly<{
    subjectId: string;
    summary: string;
    importancePermille: number;
  }>[];
}>;

export type ValidationContext = Readonly<{
  state: WorldState;
  registry: SceneRegistry;
  turnCandidates: TurnCandidateRegistry;
  playerMessages: Readonly<Record<string, string>>;
  staged: Readonly<{
    knowledge: readonly KnowledgeRecord[];
    unlockedInterestIds: readonly string[];
    unlockedIds: readonly string[];
    memories: readonly Readonly<{ subjectId: string; summary: string; importancePermille: number }>[];
  }>;
}>;

function hasId(values: readonly string[], id: string, label: string): void {
  if (!values.includes(id)) throw new Error(`Unknown or unavailable ${label} ID.`);
}

function assertUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) throw new Error(`Duplicate ${label} candidate.`);
}

function authoritativeTruth(state: WorldState, factId: string): unknown | undefined {
  if (factId === 'protagonist_has_cat') {
    return (state.inventory.items.cat ?? state.inventory.homeStorageItems.cat ?? 0) > 0;
  }
  return undefined;
}

function equalScalar(left: unknown, right: unknown): boolean {
  return typeof left === typeof right && Object.is(left, right);
}

function assertSource(
  candidate: ConversationResponse['knowledgeCandidates'][number],
  context: ValidationContext,
): void {
  if (candidate.sourceType === 'player_message') {
    const source = context.playerMessages[candidate.sourceId];
    if (!source || !candidate.evidenceText || !source.includes(candidate.evidenceText)) {
      throw new Error('Player-message evidence is not an exact substring of its registered source.');
    }
    if (candidate.candidateType !== 'held_belief') {
      throw new Error('Player text can create only a held belief.');
    }
    if (
      candidate.factId === 'protagonist_has_cat' &&
      (!isPositiveFirstPersonCatClaim(source) || !isPositiveFirstPersonCatClaim(candidate.evidenceText))
    ) {
      throw new Error('Cat belief evidence lacks a direct ownership claim.');
    }
    return;
  }
  const allowed = candidate.sourceType === 'scene_observation'
    ? context.registry.sources.sceneObservationIds
    : candidate.sourceType === 'npc_report'
      ? context.registry.sources.npcReportIds
      : context.registry.sources.authoredEventIds;
  hasId(allowed, candidate.sourceId, `${candidate.sourceType} source`);
}

function knownSourceId(sourceId: string, context: ValidationContext): boolean {
  return Boolean(context.playerMessages[sourceId]) || [
    ...context.registry.sources.sceneObservationIds,
    ...context.registry.sources.npcReportIds,
    ...context.registry.sources.authoredEventIds,
  ].includes(sourceId);
}

export function validateConversationTurn(
  response: ConversationResponse,
  context: ValidationContext,
): ApprovedTurn {
  const npc = context.state.npcs[context.registry.npcId];
  if (!npc || npc.tier !== 'full_ai') throw new Error('Conversation target is not a full-AI NPC.');
  if (response.highImpactCandidates.length > 0) {
    throw new Error('Generated high-impact state changes are not supported.');
  }
  if (response.actionId !== null) {
    hasId(context.registry.actionIds, response.actionId, 'action');
    if (context.registry.blockedActionIds.includes(response.actionId)) {
      throw new Error('Proposed action crosses an authored hard boundary.');
    }
  }
  assertUnique(response.interestCandidateIds, 'interest');
  assertUnique(response.unlockCandidateIds, 'unlock');

  const knowledge: KnowledgeRecord[] = [];
  for (const candidate of response.knowledgeCandidates) {
    hasId(context.registry.factIds, candidate.factId, 'fact');
    hasId(context.turnCandidates.factIds, candidate.factId, 'turn fact');
    assertSource(candidate, context);
    const truth = authoritativeTruth(context.state, candidate.factId);
    if (candidate.candidateType === 'observed_fact') {
      if (truth === undefined || !equalScalar(truth, candidate.assertedValue)) {
        throw new Error('Observed fact does not match authoritative world truth.');
      }
    }
    const truthStatus = truth === undefined
      ? 'unknown' as const
      : equalScalar(truth, candidate.assertedValue) ? 'verified' as const : 'contradicted' as const;
    const record: KnowledgeRecord = {
      factId: candidate.factId,
      assertedValue: candidate.assertedValue,
      epistemicState: candidate.candidateType,
      truthStatus,
      source: {
        type: candidate.sourceType,
        sourceId: candidate.sourceId,
        ...(candidate.evidenceText ? { evidenceText: candidate.evidenceText } : {}),
      },
    };
    const existing = [...npc.knowledge, ...context.staged.knowledge, ...knowledge].some((entry) => (
      entry.factId === record.factId && entry.source.type === record.source.type && entry.source.sourceId === record.source.sourceId
    ));
    if (!existing) knowledge.push(record);
  }

  const hasCatBelief = [...npc.knowledge, ...context.staged.knowledge, ...knowledge]
    .some(({ factId, assertedValue }) => factId === 'protagonist_has_cat' && assertedValue === true);
  const unlockedInterestIds = response.interestCandidateIds.filter((id) => {
    hasId(context.registry.interestIds, id, 'interest');
    hasId(context.turnCandidates.interestIds, id, 'turn interest');
    if (id === 'cats' && !hasCatBelief) throw new Error('Cats interest requires a sourced cat belief.');
    return !npc.unlockedInterestIds.includes(id) && !context.staged.unlockedInterestIds.includes(id);
  });
  const availableInterests = new Set([...npc.unlockedInterestIds, ...context.staged.unlockedInterestIds, ...unlockedInterestIds]);
  const unlockedIds = response.unlockCandidateIds.filter((id) => {
    hasId(context.registry.unlockIds, id, 'unlock');
    hasId(context.turnCandidates.unlockIds, id, 'turn unlock');
    if (id !== 'cats_common_interest') throw new Error('Free-text cannot grant this authored unlock.');
    if (!availableInterests.has('cats')) throw new Error('Cats common interest requires the validated cats interest.');
    return !npc.unlockedIds.includes(id) && !context.staged.unlockedIds.includes(id);
  });

  const memories = response.memoryCandidates.flatMap((candidate) => {
    hasId(context.registry.memorySubjectIds, candidate.subjectId, 'memory subject');
    hasId(context.turnCandidates.memorySubjectIds, candidate.subjectId, 'turn memory subject');
    if (!knownSourceId(candidate.sourceId, context)) throw new Error('Memory source is not registered in this scene.');
    const duplicate = [...npc.memories, ...context.staged.memories].some((memory) => (
      memory.subjectId === candidate.subjectId && memory.summary === candidate.summary
    ));
    return duplicate ? [] : [{
      subjectId: candidate.subjectId,
      summary: candidate.summary,
      importancePermille: candidate.importancePermille,
    }];
  });

  return Object.freeze({
    dialogue: response.dialogue,
    emotion: response.emotion,
    intent: response.intent,
    actionId: response.actionId,
    knowledge,
    unlockedInterestIds,
    unlockedIds,
    memories,
  });
}
