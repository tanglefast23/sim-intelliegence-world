import { StableIdSchema } from '../ids';
import { WorldStateSchema, type WorldState } from '../schema';
import { LegacyStateV6Schema } from './legacy-v6';

export function migrateV6ToV7(candidate: unknown, nextGenerationId: string): WorldState {
  const generationId = StableIdSchema.refine((value) => value.startsWith('generation-'), {
    message: 'Migration generation ID must start with generation-.',
  }).parse(nextGenerationId);
  const source = LegacyStateV6Schema.parse(candidate);
  const journal = Object.fromEntries(Object.entries(source.journal).map(([id, entry]) => {
    const { questId, ...fields } = entry;
    return [id, { ...fields, subject: { kind: 'quest' as const, questId } }];
  }));
  return WorldStateSchema.parse({
    ...source,
    schemaVersion: 7,
    generationId,
    modelPin: {
      id: 'qwen3.5-4b',
      sourceRevision: '851bf6e806efd8d0a36b00ddf55e13ccb7b8cd0a',
      artifactSha256: '32c8ff2d0972cc26d4c1f99d6655c7e0d4814bae9c23093a9213e23fd36e3d14',
    },
    journal,
    playerKnowledge: {},
    worldObjects: { linda_marchetti_purse: { objectId: 'linda_marchetti_purse', ownerId: 'linda' } },
    verbalMissions: {},
    commitments: {},
  });
}
