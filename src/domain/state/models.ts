import { z } from 'zod';

import { RelationshipStateSchema } from '../relationships/relationship';
import { EventIdSchema, StableIdSchema } from './ids';

export const BoundedConditionSchema = z.number().int().min(0).max(100);

export const ProtagonistStateSchema = z.object({
  id: z.literal('protagonist'),
  displayName: z.string().trim().min(1).max(32),
  energy: BoundedConditionSchema,
  health: BoundedConditionSchema,
  confidence: BoundedConditionSchema,
  locationId: StableIdSchema,
}).strict();

export const KnowledgeSourceSchema = z.object({
  type: z.enum(['player_message', 'scene_observation', 'npc_report', 'authored_event']),
  sourceId: StableIdSchema,
  evidenceText: z.string().max(500).optional(),
}).strict();

export const KnowledgeRecordSchema = z.object({
  factId: StableIdSchema,
  assertedValue: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  epistemicState: z.enum(['observed_fact', 'held_belief']),
  truthStatus: z.enum(['verified', 'contradicted', 'unknown']),
  source: KnowledgeSourceSchema,
}).strict();

export const MemoryRecordSchema = z.object({
  subjectId: StableIdSchema,
  summary: z.string().min(1).max(240),
  importancePermille: z.number().int().min(0).max(1_000),
  eventId: EventIdSchema,
}).strict();

export const NpcPresenceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('active_local'), locationId: StableIdSchema }).strict(),
  z.object({ kind: z.literal('in_transit'), transferId: StableIdSchema }).strict(),
  z.object({ kind: z.literal('inactive'), destinationLocationId: StableIdSchema }).strict(),
]);

export const NpcStateSchema = z.object({
  id: StableIdSchema,
  tier: z.enum(['full_ai', 'ambient']),
  presence: NpcPresenceSchema,
  knowledge: z.array(KnowledgeRecordSchema),
  unlockedInterestIds: z.array(StableIdSchema),
  memories: z.array(MemoryRecordSchema),
}).strict();

export const InventoryStateSchema = z.object({
  money: z.number().int().nonnegative(),
  items: z.record(StableIdSchema, z.number().int().nonnegative()),
  homeStorageItems: z.record(StableIdSchema, z.number().int().nonnegative()),
}).strict();

export const EconomyStateSchema = z.object({
  weeklyAllowance: z.number().int().positive(),
  basicDailyCost: z.number().int().positive(),
  nextAllowanceMinute: z.number().int().nonnegative(),
}).strict();

export const FactionStateSchema = z.object({
  id: StableIdSchema,
  standing: z.number().int().min(-100).max(100),
  revealed: z.boolean(),
}).strict();

export const QuestStateSchema = z.object({
  id: StableIdSchema,
  status: z.enum(['locked', 'available', 'active', 'resolved', 'failed', 'withdrawn']),
  flagIds: z.array(StableIdSchema),
}).strict();

export const JournalEntrySchema = z.object({
  id: StableIdSchema,
  questId: StableIdSchema,
  summary: z.string().min(1).max(500),
  locationPrecision: z.enum(['none', 'vague', 'exact']),
  locationId: StableIdSchema.optional(),
  markerVisible: z.boolean(),
  resolutionState: z.enum(['open', 'resolved', 'expired']),
}).strict().superRefine((entry, context) => {
  if (entry.markerVisible && (entry.locationPrecision !== 'exact' || !entry.locationId)) {
    context.addIssue({ code: 'custom', message: 'A map marker requires an exact known location.' });
  }
});

export const MapStateSchema = z.object({
  id: StableIdSchema,
  active: z.boolean(),
  unlocked: z.boolean(),
  discoveredEntranceIds: z.array(StableIdSchema),
}).strict();

export const ScheduleBlockSchema = z.object({
  startMinuteOfDay: z.number().int().min(0).max(1_439),
  locationId: StableIdSchema,
  activityId: StableIdSchema,
}).strict();

export const ScheduleStateSchema = z.object({
  id: StableIdSchema,
  npcId: StableIdSchema,
  blocks: z.array(ScheduleBlockSchema).min(4).max(6),
}).strict().superRefine((schedule, context) => {
  for (let index = 1; index < schedule.blocks.length; index += 1) {
    if ((schedule.blocks[index]?.startMinuteOfDay ?? 0) <= (schedule.blocks[index - 1]?.startMinuteOfDay ?? 0)) {
      context.addIssue({ code: 'custom', message: 'Schedule blocks must use strictly increasing times.' });
    }
  }
});

export const TransferStateSchema = z.object({
  id: StableIdSchema,
  npcId: StableIdSchema,
  originMapId: StableIdSchema,
  destinationMapId: StableIdSchema,
  edgePortalId: StableIdSchema,
  departureMinute: z.number().int().nonnegative(),
  arrivalMinute: z.number().int().nonnegative(),
  destinationEntranceId: StableIdSchema,
}).strict().refine((transfer) => transfer.arrivalMinute > transfer.departureMinute, {
  message: 'Transfer arrival must be after departure.',
});

export const EvidenceStateSchema = z.object({
  id: StableIdSchema,
  actionId: StableIdSchema,
  locationId: StableIdSchema,
  witnessNpcIds: z.array(StableIdSchema),
  createdAtMinute: z.number().int().nonnegative(),
  status: z.enum(['unnoticed', 'noticed', 'linked', 'resolved']),
}).strict();

export const PoliceAttentionSchema = z.enum([
  'none',
  'noticed',
  'questioned',
  'wanted',
  'arrest-on-sight',
]);

export { RelationshipStateSchema };
