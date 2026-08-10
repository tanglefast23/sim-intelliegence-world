import { z } from 'zod';

import { InvitationStateSchema } from '../invitations/schema';
import { JournalEntrySchema } from '../quests/journal';
import { RelationshipStateSchema } from '../relationships/relationship';
import { EventIdSchema, StableIdSchema } from './ids';

export const BoundedConditionSchema = z.number().int().min(0).max(100);

function uniqueStableIds(message: string) {
  return z.array(StableIdSchema).refine((ids) => new Set(ids).size === ids.length, { message });
}

export const ProtagonistStateSchema = z.object({
  id: z.literal('protagonist'),
  displayName: z.string().trim().min(1).max(32),
  energy: BoundedConditionSchema,
  health: BoundedConditionSchema,
  confidence: BoundedConditionSchema,
  locationId: StableIdSchema,
  worldPosition: z.object({
    mapId: StableIdSchema,
    tileX: z.number().int().min(0).max(63),
    tileY: z.number().int().min(0).max(47),
  }).strict(),
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
  z.object({
    kind: z.literal('active_local'),
    mapId: StableIdSchema,
    locationId: StableIdSchema,
    tileX: z.number().int().min(0).max(63),
    tileY: z.number().int().min(0).max(47),
  }).strict(),
  z.object({ kind: z.literal('in_transit'), transferId: StableIdSchema }).strict(),
  z.object({
    kind: z.literal('inactive'),
    mapId: StableIdSchema,
    locationId: StableIdSchema,
    tileX: z.number().int().min(0).max(63),
    tileY: z.number().int().min(0).max(47),
  }).strict(),
]);

export const NpcScheduleGoalSchema = z.object({
  mapId: StableIdSchema,
  locationId: StableIdSchema,
  activityId: StableIdSchema,
  tileX: z.number().int().min(0).max(63),
  tileY: z.number().int().min(0).max(47),
  scheduledMinute: z.number().int().nonnegative(),
  sourceInvitationId: StableIdSchema.optional(),
}).strict();

export const NpcStateSchema = z.object({
  id: StableIdSchema,
  tier: z.enum(['full_ai', 'ambient']),
  condition: z.enum(['alive', 'injured', 'dead']).optional(),
  presence: NpcPresenceSchema,
  scheduleGoal: NpcScheduleGoalSchema.optional(),
  knowledge: z.array(KnowledgeRecordSchema),
  unlockedInterestIds: uniqueStableIds('Unlocked interest IDs must be unique.'),
  unlockedIds: uniqueStableIds('Unlock IDs must be unique.'),
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
  nextBasicCostMinute: z.number().int().nonnegative(),
}).strict();

export const FactionStateSchema = z.object({
  id: StableIdSchema,
  standing: z.number().int().min(-100).max(100),
  revealed: z.boolean(),
}).strict();

export const QuestStateSchema = z.object({
  id: StableIdSchema,
  status: z.enum(['locked', 'available', 'active', 'resolved', 'failed', 'withdrawn']),
  flagIds: uniqueStableIds('Quest flag IDs must be unique.'),
}).strict();

export const MapStateSchema = z.object({
  id: StableIdSchema,
  active: z.boolean(),
  unlocked: z.boolean(),
  discoveredEntranceIds: uniqueStableIds('Discovered entrance IDs must be unique.'),
}).strict();

export const ScheduleBlockSchema = z.object({
  startMinuteOfDay: z.number().int().min(0).max(1_439),
  locationId: StableIdSchema,
  activityId: StableIdSchema,
  mapId: StableIdSchema,
  tileX: z.number().int().min(0).max(63),
  tileY: z.number().int().min(0).max(47),
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
  status: z.enum(['approaching_exit', 'in_transit']),
  npcId: StableIdSchema,
  originMapId: StableIdSchema,
  destinationMapId: StableIdSchema,
  edgePortalId: StableIdSchema,
  departureMinute: z.number().int().nonnegative(),
  arrivalMinute: z.number().int().nonnegative(),
  destinationEntranceId: StableIdSchema,
  destinationEntranceTileX: z.number().int().min(0).max(63),
  destinationEntranceTileY: z.number().int().min(0).max(47),
  destinationLocationId: StableIdSchema,
  destinationActivityId: StableIdSchema,
  destinationGoalTileX: z.number().int().min(0).max(63),
  destinationGoalTileY: z.number().int().min(0).max(47),
}).strict().refine((transfer) => transfer.arrivalMinute > transfer.departureMinute, {
  message: 'Transfer arrival must be after departure.',
});

export const EvidenceStateSchema = z.object({
  id: StableIdSchema,
  actionId: StableIdSchema,
  locationId: StableIdSchema,
  witnessNpcIds: uniqueStableIds('Evidence witness IDs must be unique.'),
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

export { InvitationStateSchema, JournalEntrySchema, RelationshipStateSchema };
