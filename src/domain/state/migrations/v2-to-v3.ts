import { z } from 'zod';

import { ProtagonistStateSchema } from '../models';
import { StableIdSchema } from '../ids';
import { WorldStateBaseSchema, WorldStateSchema, type WorldState } from '../schema';

export const LegacyProtagonistV2Schema = ProtagonistStateSchema.omit({ worldPosition: true }).strict();

export const LegacyStateV2Schema = WorldStateBaseSchema.extend({
  schemaVersion: z.literal(2),
  protagonist: LegacyProtagonistV2Schema,
}).strict();

export function migrateV2ToV3(candidate: unknown, nextGenerationId: string): WorldState {
  const generationId = StableIdSchema.refine((value) => value.startsWith('generation-'), {
    message: 'Migration generation ID must start with generation-.',
  }).parse(nextGenerationId);
  const source = LegacyStateV2Schema.parse(candidate);
  return WorldStateSchema.parse({
    ...source,
    schemaVersion: 3,
    generationId,
    protagonist: {
      ...source.protagonist,
      worldPosition: { mapId: 'northwest_residential', tileX: 18, tileY: 18 },
    },
  });
}
