import { z } from 'zod';

import { StableIdSchema } from '../ids';
import { ProtagonistStateSchema } from '../models';
import { LegacyStateV3Schema } from './v3-to-v4';

export const LegacyProtagonistV2Schema = ProtagonistStateSchema.omit({ worldPosition: true }).strict();

export const LegacyStateV2Schema = LegacyStateV3Schema.extend({
  schemaVersion: z.literal(2),
  protagonist: LegacyProtagonistV2Schema,
}).strict();

export function migrateV2ToV3(candidate: unknown, nextGenerationId: string): z.infer<typeof LegacyStateV3Schema> {
  const generationId = StableIdSchema.refine((value) => value.startsWith('generation-'), {
    message: 'Migration generation ID must start with generation-.',
  }).parse(nextGenerationId);
  const source = LegacyStateV2Schema.parse(candidate);
  return LegacyStateV3Schema.parse({
    ...source,
    schemaVersion: 3,
    generationId,
    protagonist: {
      ...source.protagonist,
      worldPosition: { mapId: 'northwest_residential', tileX: 18, tileY: 18 },
    },
  });
}
