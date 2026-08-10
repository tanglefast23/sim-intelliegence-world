import { z } from 'zod';

import { CommandIdSchema, EventIdSchema, PauseTokenSchema, StableIdSchema } from '../state/ids';
import { SimulationSpeedSchema } from '../clock/clock';

const EventBaseSchema = z.object({
  eventId: EventIdSchema,
  commandId: CommandIdSchema,
  sequence: z.number().int().nonnegative(),
  absoluteMinute: z.number().int().nonnegative(),
}).strict();

export const DomainEventSchema = z.discriminatedUnion('type', [
  EventBaseSchema.extend({
    type: z.literal('clock-advanced'),
    fromMinute: z.number().int().nonnegative(),
    toMinute: z.number().int().nonnegative(),
    consumedRealMilliseconds: z.number().int().nonnegative(),
  }).strict(),
  EventBaseSchema.extend({
    type: z.literal('pause-token-added'),
    token: PauseTokenSchema,
    changed: z.boolean(),
  }).strict(),
  EventBaseSchema.extend({
    type: z.literal('pause-token-removed'),
    token: PauseTokenSchema,
    changed: z.boolean(),
  }).strict(),
  EventBaseSchema.extend({
    type: z.literal('relationship-changed'),
    npcId: StableIdSchema,
    familiarityDelta: z.number().int(),
    trustDelta: z.number().int(),
    attractionDelta: z.number().int(),
    reason: z.string().min(1).max(160),
  }).strict(),
  EventBaseSchema.extend({
    type: z.literal('faction-standing-changed'),
    factionId: StableIdSchema,
    delta: z.number().int(),
    reason: z.string().min(1).max(160),
  }).strict(),
  EventBaseSchema.extend({
    type: z.literal('protagonist-moved'),
    mapId: StableIdSchema,
    locationId: StableIdSchema,
    fromTileX: z.number().int().min(0).max(63),
    fromTileY: z.number().int().min(0).max(47),
    toTileX: z.number().int().min(0).max(63),
    toTileY: z.number().int().min(0).max(47),
  }).strict(),
  EventBaseSchema.extend({
    type: z.literal('simulation-speed-changed'),
    fromSpeed: SimulationSpeedSchema,
    toSpeed: SimulationSpeedSchema,
  }).strict(),
  EventBaseSchema.extend({
    type: z.literal('simulation-advanced'),
    fromMinute: z.number().int().nonnegative(),
    toMinute: z.number().int().nonnegative(),
    consumedRealMilliseconds: z.number().int().nonnegative(),
    milestoneIds: z.array(z.string().min(1).max(160)),
    energyDelta: z.number().int(),
    moneyDelta: z.number().int(),
  }).strict(),
  EventBaseSchema.extend({
    type: z.literal('sleep-completed'),
    mode: z.enum(['nap', 'overnight']),
    fromMinute: z.number().int().nonnegative(),
    toMinute: z.number().int().nonnegative(),
    energyDelta: z.number().int(),
    milestoneIds: z.array(z.string().min(1).max(160)),
  }).strict(),
  EventBaseSchema.extend({
    type: z.literal('quest-reward-applied'),
    rewardKind: z.enum(['ordinary', 'dangerous']),
    amount: z.number().int().nonnegative(),
    questId: StableIdSchema,
  }).strict(),
  EventBaseSchema.extend({
    type: z.literal('npc-moved'),
    npcId: StableIdSchema,
    mapId: StableIdSchema,
    fromTileX: z.number().int().min(0).max(63),
    fromTileY: z.number().int().min(0).max(47),
    toTileX: z.number().int().min(0).max(63),
    toTileY: z.number().int().min(0).max(47),
  }).strict(),
  EventBaseSchema.extend({
    type: z.literal('npc-goal-completed'),
    npcId: StableIdSchema,
    activityId: StableIdSchema,
    locationId: StableIdSchema,
  }).strict(),
  EventBaseSchema.extend({
    type: z.literal('npc-transfer-departed'),
    npcId: StableIdSchema,
    transferId: StableIdSchema,
    originMapId: StableIdSchema,
    destinationMapId: StableIdSchema,
    arrivalMinute: z.number().int().nonnegative(),
  }).strict(),
  EventBaseSchema.extend({
    type: z.literal('protagonist-transitioned'),
    originMapId: StableIdSchema,
    destinationMapId: StableIdSchema,
    sourcePortalId: StableIdSchema,
    destinationEntranceId: StableIdSchema,
    tileX: z.number().int().min(0).max(63),
    tileY: z.number().int().min(0).max(47),
  }).strict(),
  EventBaseSchema.extend({
    type: z.literal('conversation-committed'),
    conversationId: StableIdSchema,
    npcId: StableIdSchema,
    knowledgeCount: z.number().int().nonnegative(),
    interestCount: z.number().int().nonnegative(),
    unlockCount: z.number().int().nonnegative(),
    memoryCount: z.number().int().nonnegative(),
  }).strict(),
]);

export type DomainEvent = z.infer<typeof DomainEventSchema>;
