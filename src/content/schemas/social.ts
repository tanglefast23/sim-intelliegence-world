import { z } from 'zod';

import { FactionAccessGateSchema } from '../../domain/factions/faction';
import { StableIdSchema } from '../../domain/state/ids';

export const SocialPurchaseSchema = z.object({
  id: StableIdSchema,
  displayName: z.string().trim().min(1).max(80),
  cost: z.number().int().positive(),
  questId: StableIdSchema,
  grantedQuestFlagId: StableIdSchema,
  benefit: z.enum(['relationship_route', 'faction_route', 'practical_quest_advantage']),
}).strict();
export type SocialPurchase = z.infer<typeof SocialPurchaseSchema>;

export const SocialContentSchema = z.object({
  schemaVersion: z.literal(1),
  factionAccessGates: z.array(FactionAccessGateSchema),
  purchases: z.array(SocialPurchaseSchema),
}).strict();
export type SocialContent = z.infer<typeof SocialContentSchema>;
