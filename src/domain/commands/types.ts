import { z } from 'zod';

import { RelationshipDeltaSchema } from '../relationships/relationship';
import { CommandIdSchema, EventIdSchema, PauseTokenSchema, StableIdSchema } from '../state/ids';
import { SimulationSpeedSchema } from '../clock/clock';

const CommandBaseSchema = z.object({
  commandId: CommandIdSchema,
  eventId: EventIdSchema,
  scheduledMinute: z.number().int().nonnegative(),
  priority: z.number().int().min(-100).max(100),
}).strict();

export const DomainCommandSchema = z.discriminatedUnion('type', [
  CommandBaseSchema.extend({
    type: z.literal('advance-clock'),
    realMilliseconds: z.number().int().nonnegative(),
  }).strict(),
  CommandBaseSchema.extend({
    type: z.literal('add-pause-token'),
    token: PauseTokenSchema,
  }).strict(),
  CommandBaseSchema.extend({
    type: z.literal('remove-pause-token'),
    token: PauseTokenSchema,
  }).strict(),
  CommandBaseSchema.extend({
    type: z.literal('apply-relationship-delta'),
    npcId: StableIdSchema,
    delta: RelationshipDeltaSchema,
    source: z.enum(['conversation', 'quest']),
    reason: z.string().trim().min(1).max(160),
  }).strict(),
  CommandBaseSchema.extend({
    type: z.literal('apply-faction-delta'),
    factionId: StableIdSchema,
    delta: z.number().int(),
    scale: z.enum(['ordinary', 'major']),
    reason: z.string().trim().min(1).max(160),
  }).strict(),
  CommandBaseSchema.extend({
    type: z.literal('move-protagonist'),
    mapId: StableIdSchema,
    locationId: StableIdSchema,
    tileX: z.number().int().min(0).max(63),
    tileY: z.number().int().min(0).max(47),
  }).strict(),
  CommandBaseSchema.extend({
    type: z.literal('set-simulation-speed'),
    speed: SimulationSpeedSchema,
  }).strict(),
  CommandBaseSchema.extend({
    type: z.literal('advance-simulation'),
    realMilliseconds: z.number().int().nonnegative(),
  }).strict(),
  CommandBaseSchema.extend({
    type: z.literal('sleep-protagonist'),
    mode: z.enum(['nap', 'overnight']),
  }).strict(),
  CommandBaseSchema.extend({
    type: z.literal('apply-quest-reward'),
    rewardKind: z.enum(['ordinary', 'dangerous']),
    amount: z.number().int().nonnegative(),
    questId: StableIdSchema,
  }).strict(),
  CommandBaseSchema.extend({
    type: z.literal('move-npc'),
    npcId: StableIdSchema,
    mapId: StableIdSchema,
    tileX: z.number().int().min(0).max(63),
    tileY: z.number().int().min(0).max(47),
  }).strict(),
  CommandBaseSchema.extend({
    type: z.literal('complete-npc-goal'),
    npcId: StableIdSchema,
  }).strict(),
  CommandBaseSchema.extend({
    type: z.literal('depart-npc-transfer'),
    npcId: StableIdSchema,
    transferId: StableIdSchema,
  }).strict(),
  CommandBaseSchema.extend({
    type: z.literal('transition-protagonist'),
    originMapId: StableIdSchema,
    destinationMapId: StableIdSchema,
    sourcePortalId: StableIdSchema,
    destinationEntranceId: StableIdSchema,
    tileX: z.number().int().min(0).max(63),
    tileY: z.number().int().min(0).max(47),
  }).strict(),
]);

export type DomainCommand = z.infer<typeof DomainCommandSchema>;
