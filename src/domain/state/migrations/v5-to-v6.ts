import { z } from 'zod';

import { StableIdSchema } from '../ids';
import { WorldStateBaseSchema, WorldStateSchema, type WorldState } from '../schema';

export const LegacyStateV5Schema = WorldStateBaseSchema.omit({
  schemaVersion: true,
  layoutRevisions: true,
  layoutMigrationEvidence: true,
}).extend({
  schemaVersion: z.literal(5),
}).strict();

export type LegacyStateV5 = z.infer<typeof LegacyStateV5Schema>;

export function migrateV5ToV6(candidate: unknown, nextGenerationId: string): WorldState {
  const generationId = StableIdSchema.refine((value) => value.startsWith('generation-'), {
    message: 'Migration generation ID must start with generation-.',
  }).parse(nextGenerationId);
  const source = LegacyStateV5Schema.parse(candidate);
  return WorldStateSchema.parse({
    ...source,
    schemaVersion: 6,
    generationId,
    layoutRevisions: Object.fromEntries(Object.keys(source.maps).sort().map((mapId) => [mapId, 0])),
    layoutMigrationEvidence: [],
  });
}
