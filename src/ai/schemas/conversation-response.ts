import { z } from 'zod';

import { StableIdSchema } from '../../domain/state/ids';
import type { SceneRegistry } from '../registry/scene-registry';
import type { TurnCandidateRegistry } from '../registry/turn-candidates';
import { parseBoundedJson } from './safe-json';

const AssertedValueSchema = z.union([z.string().max(160), z.number().finite(), z.boolean(), z.null()]);
const SourceTypeSchema = z.enum(['player_message', 'scene_observation', 'npc_report', 'authored_event']);

export const ConversationResponseSchema = z.object({
  dialogue: z.string().trim().min(1).max(420),
  emotion: z.enum(['neutral', 'warm', 'wary', 'angry', 'afraid', 'sad', 'amused']),
  intent: z.enum(['continue_conversation', 'ask_question', 'inform', 'refuse', 'end_conversation']),
  actionId: StableIdSchema.nullable(),
  knowledgeCandidates: z.array(z.object({
    candidateType: z.enum(['observed_fact', 'held_belief']),
    factId: StableIdSchema,
    assertedValue: AssertedValueSchema,
    sourceType: SourceTypeSchema,
    sourceId: StableIdSchema,
    evidenceText: z.string().min(1).max(500).nullable(),
  }).strict()).max(4),
  interestCandidateIds: z.array(StableIdSchema).max(4),
  memoryCandidates: z.array(z.object({
    subjectId: StableIdSchema,
    summary: z.string().trim().min(1).max(240),
    importancePermille: z.number().int().min(0).max(1_000),
    sourceId: StableIdSchema,
  }).strict()).max(2),
  unlockCandidateIds: z.array(StableIdSchema).max(4),
  highImpactCandidates: z.array(z.object({
    type: z.enum(['item', 'quest', 'exact_location', 'faction', 'consent', 'relationship_stage']),
    id: StableIdSchema,
    sourceType: SourceTypeSchema,
    sourceId: StableIdSchema,
  }).strict()).max(4),
}).strict();

export type ConversationResponse = z.infer<typeof ConversationResponseSchema>;
export const conversationResponseJsonSchema = z.toJSONSchema(ConversationResponseSchema, { target: 'draft-7' });

type JsonSchemaNode = Record<string, unknown>;

function objectNode(candidate: unknown): JsonSchemaNode {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('Unexpected conversation JSON Schema shape.');
  return candidate as JsonSchemaNode;
}

function property(node: JsonSchemaNode, key: string): JsonSchemaNode {
  return objectNode(objectNode(node.properties)[key]);
}

function closeArrayItems(arrayNode: JsonSchemaNode, ids: readonly string[]): void {
  if (ids.length === 0) {
    arrayNode.maxItems = 0;
    return;
  }
  objectNode(arrayNode.items).enum = [...ids];
  delete objectNode(arrayNode.items).pattern;
}

export function conversationResponseJsonSchemaForScene(
  registry: SceneRegistry,
  turnCandidates: TurnCandidateRegistry,
  playerMessageIds: readonly string[],
): Readonly<Record<string, unknown>> {
  const schema = structuredClone(conversationResponseJsonSchema) as JsonSchemaNode;
  property(schema, 'actionId').enum = [...registry.actionIds, null];
  delete property(schema, 'actionId').anyOf;

  const knowledge = property(schema, 'knowledgeCandidates');
  const knowledgeItem = objectNode(knowledge.items);
  const factIds = turnCandidates.factIds;
  if (factIds.length === 0) knowledge.maxItems = 0;
  else {
    property(knowledgeItem, 'factId').enum = factIds;
    delete property(knowledgeItem, 'factId').pattern;
    const assertedValue = property(knowledgeItem, 'assertedValue');
    delete assertedValue.anyOf;
    assertedValue.type = 'boolean';
  }
  const sourceIds = [...new Set([
    ...playerMessageIds,
    ...registry.sources.sceneObservationIds,
    ...registry.sources.npcReportIds,
    ...registry.sources.authoredEventIds,
  ])].sort();
  property(knowledgeItem, 'sourceId').enum = sourceIds;
  delete property(knowledgeItem, 'sourceId').pattern;

  closeArrayItems(
    property(schema, 'interestCandidateIds'),
    turnCandidates.interestIds,
  );
  closeArrayItems(
    property(schema, 'unlockCandidateIds'),
    turnCandidates.unlockIds,
  );
  const memory = property(schema, 'memoryCandidates');
  const memorySubjectIds = turnCandidates.memorySubjectIds;
  if (memorySubjectIds.length === 0) memory.maxItems = 0;
  else {
    const memoryItem = objectNode(memory.items);
    property(memoryItem, 'subjectId').enum = memorySubjectIds;
    delete property(memoryItem, 'subjectId').pattern;
    property(memoryItem, 'sourceId').enum = sourceIds;
    delete property(memoryItem, 'sourceId').pattern;
  }
  property(schema, 'highImpactCandidates').maxItems = 0;
  return schema;
}

export function parseConversationResponseJson(source: string): ConversationResponse {
  return ConversationResponseSchema.parse(parseBoundedJson(source, 8_192));
}

export const authoredNoChangeConversationResponse: ConversationResponse = Object.freeze({
  dialogue: 'I lost my train of thought. Ask me again in a moment.',
  emotion: 'neutral',
  intent: 'continue_conversation',
  actionId: null,
  knowledgeCandidates: [],
  interestCandidateIds: [],
  memoryCandidates: [],
  unlockCandidateIds: [],
  highImpactCandidates: [],
});
