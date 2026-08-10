import { WorldStateSchema, type WorldState } from '../schema';
import { StableIdSchema } from '../ids';
import { migrateV1ToV2 } from './v1-to-v2';
import { migrateV2ToV3 } from './v2-to-v3';
import { migrateV3ToV4 } from './v3-to-v4';
import { migrateV4ToV5 } from './v4-to-v5';
import { migrateV5ToV6 } from './v5-to-v6';

export function migrateStateCopy(candidate: unknown, nextGenerationId: string): WorldState {
  const version = typeof candidate === 'object' && candidate !== null
    ? (candidate as { schemaVersion?: unknown }).schemaVersion
    : undefined;
  if (version === 1) {
    const v2 = migrateV1ToV2(candidate, nextGenerationId);
    const v3 = migrateV2ToV3(v2, nextGenerationId);
    const v4 = migrateV3ToV4(v3, nextGenerationId);
    const v5 = migrateV4ToV5(v4, nextGenerationId);
    return migrateV5ToV6(v5, nextGenerationId);
  }
  if (version === 2) {
    const v3 = migrateV2ToV3(candidate, nextGenerationId);
    const v4 = migrateV3ToV4(v3, nextGenerationId);
    const v5 = migrateV4ToV5(v4, nextGenerationId);
    return migrateV5ToV6(v5, nextGenerationId);
  }
  if (version === 3) {
    const v4 = migrateV3ToV4(candidate, nextGenerationId);
    const v5 = migrateV4ToV5(v4, nextGenerationId);
    return migrateV5ToV6(v5, nextGenerationId);
  }
  if (version === 4) return migrateV5ToV6(migrateV4ToV5(candidate, nextGenerationId), nextGenerationId);
  if (version === 5) return migrateV5ToV6(candidate, nextGenerationId);
  if (version === 6) {
    const generationId = StableIdSchema.refine((value) => value.startsWith('generation-'), {
      message: 'Migration generation ID must start with generation-.',
    }).parse(nextGenerationId);
    return WorldStateSchema.parse({ ...WorldStateSchema.parse(candidate), generationId });
  }
  throw new Error(`No compatible state migration from schema version ${String(version)}.`);
}
