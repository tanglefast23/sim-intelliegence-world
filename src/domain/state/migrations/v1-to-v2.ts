import { z } from 'zod';

import { StableIdSchema } from '../ids';
import { WorldStateBaseSchema, WorldStateSchema, type WorldState } from '../schema';

const LegacyStateV1Schema = WorldStateBaseSchema
  .omit({ modelPin: true, schemaVersion: true })
  .extend({ schemaVersion: z.literal(1) })
  .strict();

export function migrateV1ToV2(candidate: unknown, nextGenerationId: string): WorldState {
  const generationId = StableIdSchema.refine((value) => value.startsWith('generation-'), {
    message: 'Migration generation ID must start with generation-.',
  }).parse(nextGenerationId);
  const normalized = JSON.parse(JSON.stringify(candidate)) as {
    npcs?: Record<string, Record<string, unknown>>;
  };
  for (const npc of Object.values(normalized.npcs ?? {})) {
    npc.unlockedIds ??= [];
  }
  const source = LegacyStateV1Schema.parse(normalized);
  return WorldStateSchema.parse({
    ...source,
    schemaVersion: 2,
    generationId,
    modelPin: {
      id: 'qwen3.5-9b',
      sourceRevision: 'c202236235762e1c871ad0ccb60c8ee5ba337b9a',
      artifactSha256: '8a9256b233037ea081c2e606e49dba0851cd42e441800da8ee04597ae9798341',
    },
  });
}
