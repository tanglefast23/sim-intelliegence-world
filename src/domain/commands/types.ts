import { z } from 'zod';

import { RelationshipDeltaSchema } from '../relationships/relationship';
import { CommandIdSchema, EventIdSchema, PauseTokenSchema, StableIdSchema } from '../state/ids';

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
]);

export type DomainCommand = z.infer<typeof DomainCommandSchema>;
