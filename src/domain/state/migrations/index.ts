import { WorldStateSchema, type WorldState } from '../schema';
import { StableIdSchema } from '../ids';
import { migrateV1ToV2 } from './v1-to-v2';
import { migrateV2ToV3 } from './v2-to-v3';
import { migrateV3ToV4 } from './v3-to-v4';

export function migrateStateCopy(candidate: unknown, nextGenerationId: string): WorldState {
  const version = typeof candidate === 'object' && candidate !== null
    ? (candidate as { schemaVersion?: unknown }).schemaVersion
    : undefined;
  if (version === 1) return migrateV3ToV4(migrateV2ToV3(migrateV1ToV2(candidate, nextGenerationId), nextGenerationId), nextGenerationId);
  if (version === 2) return migrateV3ToV4(migrateV2ToV3(candidate, nextGenerationId), nextGenerationId);
  if (version === 3) return migrateV3ToV4(candidate, nextGenerationId);
  if (version === 4) {
    const generationId = StableIdSchema.refine((value) => value.startsWith('generation-'), {
      message: 'Migration generation ID must start with generation-.',
    }).parse(nextGenerationId);
    return WorldStateSchema.parse({ ...WorldStateSchema.parse(candidate), generationId });
  }
  throw new Error(`No compatible state migration from schema version ${String(version)}.`);
}
