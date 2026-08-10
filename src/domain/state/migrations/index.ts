import { WorldStateSchema, type WorldState } from '../schema';
import { StableIdSchema } from '../ids';
import { migrateV1ToV2 } from './v1-to-v2';
import { migrateV2ToV3 } from './v2-to-v3';

export function migrateStateCopy(candidate: unknown, nextGenerationId: string): WorldState {
  const version = typeof candidate === 'object' && candidate !== null
    ? (candidate as { schemaVersion?: unknown }).schemaVersion
    : undefined;
  if (version === 1) return migrateV2ToV3(migrateV1ToV2(candidate, nextGenerationId), nextGenerationId);
  if (version === 2) return migrateV2ToV3(candidate, nextGenerationId);
  if (version === 3) {
    const generationId = StableIdSchema.refine((value) => value.startsWith('generation-'), {
      message: 'Migration generation ID must start with generation-.',
    }).parse(nextGenerationId);
    return WorldStateSchema.parse({ ...WorldStateSchema.parse(candidate), generationId });
  }
  throw new Error(`No compatible state migration from schema version ${String(version)}.`);
}
