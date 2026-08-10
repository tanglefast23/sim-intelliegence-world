import { z } from 'zod';

import { CommandIdSchema, EventIdSchema, PauseTokenSchema, StableIdSchema } from '../state/ids';

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
]);

export type DomainEvent = z.infer<typeof DomainEventSchema>;
