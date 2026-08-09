import { WorldStateSchema, type WorldState } from '../schema';
import { StableIdSchema } from '../ids';
import { migrateV1ToV2 } from './v1-to-v2';

export function migrateStateCopy(candidate: unknown, nextGenerationId: string): WorldState {
  const version = typeof candidate === 'object' && candidate !== null
    ? (candidate as { schemaVersion?: unknown }).schemaVersion
    : undefined;
  if (version === 1) return migrateV1ToV2(candidate, nextGenerationId);
  if (version === 2) {
    const generationId = StableIdSchema.refine((value) => value.startsWith('generation-'), {
      message: 'Migration generation ID must start with generation-.',
    }).parse(nextGenerationId);
    return WorldStateSchema.parse({ ...WorldStateSchema.parse(candidate), generationId });
  }
  throw new Error(`No compatible state migration from schema version ${String(version)}.`);
}
