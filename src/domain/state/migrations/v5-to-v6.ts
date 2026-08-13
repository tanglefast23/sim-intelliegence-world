import { z } from 'zod';

import { StableIdSchema } from '../ids';
import { LegacyStateV6Schema, type LegacyStateV6 } from './legacy-v6';

export const LegacyStateV5Schema = LegacyStateV6Schema.omit({
  schemaVersion: true,
  layoutRevisions: true,
  layoutMigrationEvidence: true,
}).extend({
  schemaVersion: z.literal(5),
}).strict();

export type LegacyStateV5 = z.infer<typeof LegacyStateV5Schema>;

export function migrateV5ToV6(candidate: unknown, nextGenerationId: string): LegacyStateV6 {
  const generationId = StableIdSchema.refine((value) => value.startsWith('generation-'), {
    message: 'Migration generation ID must start with generation-.',
  }).parse(nextGenerationId);
  const source = LegacyStateV5Schema.parse(candidate);
  return LegacyStateV6Schema.parse({
    ...source,
    schemaVersion: 6,
    generationId,
    layoutRevisions: Object.fromEntries(Object.keys(source.maps).sort().map((mapId) => [mapId, 0])),
    layoutMigrationEvidence: [],
  });
}
