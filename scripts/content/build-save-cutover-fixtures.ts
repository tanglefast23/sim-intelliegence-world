import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  canonicalLegacyStateV5Json,
  canonicalLegacyStateV6Json,
  checksumLegacyStateV5,
  checksumLegacyStateV6,
  checksumUtf8,
} from '../../electron/persistence/checksum';
import { createInitialState } from '../../src/domain/state/initial-state';
import { LegacyStateV6Schema } from '../../src/domain/state/migrations/legacy-v6';
import { LegacyStateV5Schema } from '../../src/domain/state/migrations/v5-to-v6';

function payloadChecksum(input: Readonly<{
  formatVersion: 1;
  slotId: 'slot-001';
  saveGeneration: number;
  trigger: 'manual';
  stateChecksum: string;
  canonicalState: string;
}>): string {
  return checksumUtf8(JSON.stringify({
    formatVersion: input.formatVersion,
    slotId: input.slotId,
    saveGeneration: input.saveGeneration,
    trigger: input.trigger,
    stateChecksum: input.stateChecksum,
    state: JSON.parse(input.canonicalState) as unknown,
  }));
}

export async function buildSaveCutoverFixtures(root: string): Promise<void> {
  const directory = resolve(root, 'tests', 'fixtures', 'saves');
  await mkdir(directory, { recursive: true });
  const current = createInitialState('Fixture Player');
  const {
    playerKnowledge: _playerKnowledge,
    worldObjects: _worldObjects,
    verbalMissions: _verbalMissions,
    commitments: _commitments,
    ...currentV6Fields
  } = current;
  const currentV6 = LegacyStateV6Schema.parse({
    ...currentV6Fields,
    schemaVersion: 6,
    modelPin: {
      id: 'qwen3.5-9b',
      sourceRevision: 'c202236235762e1c871ad0ccb60c8ee5ba337b9a',
      artifactSha256: '8a9256b233037ea081c2e606e49dba0851cd42e441800da8ee04597ae9798341',
    },
  });
  const { layoutRevisions: _layoutRevisions, layoutMigrationEvidence: _layoutEvidence, ...legacyFields } = currentV6;
  const legacyState = LegacyStateV5Schema.parse({
    ...legacyFields,
    schemaVersion: 5,
    generationId: 'generation-fixture-v5',
  });
  const canonicalLegacyState = canonicalLegacyStateV5Json(legacyState);
  const legacyStateChecksum = checksumLegacyStateV5(legacyState);
  const legacyEnvelope = {
    formatVersion: 1 as const,
    slotId: 'slot-001' as const,
    saveGeneration: 7,
    trigger: 'manual' as const,
    stateChecksum: legacyStateChecksum,
    payloadChecksum: payloadChecksum({
      formatVersion: 1,
      slotId: 'slot-001',
      saveGeneration: 7,
      trigger: 'manual',
      stateChecksum: legacyStateChecksum,
      canonicalState: canonicalLegacyState,
    }),
    state: legacyState,
  };
  const staleState = LegacyStateV6Schema.parse({
    ...currentV6,
    generationId: 'generation-fixture-v6-stale',
    layoutRevisions: Object.fromEntries(Object.keys(currentV6.maps).map((mapId) => [mapId, 0])),
    layoutMigrationEvidence: [],
  });
  const canonicalStaleState = canonicalLegacyStateV6Json(staleState);
  const staleStateChecksum = checksumLegacyStateV6(staleState);
  const staleEnvelope = {
    formatVersion: 1 as const,
    slotId: 'slot-001' as const,
    saveGeneration: 11,
    trigger: 'manual' as const,
    stateChecksum: staleStateChecksum,
    payloadChecksum: payloadChecksum({
      formatVersion: 1,
      slotId: 'slot-001',
      saveGeneration: 11,
      trigger: 'manual',
      stateChecksum: staleStateChecksum,
      canonicalState: canonicalStaleState,
    }),
    state: staleState,
  };
  await Promise.all([
    writeFile(resolve(directory, 'valid-v5-envelope.json'), `${JSON.stringify(legacyEnvelope, null, 2)}\n`),
    writeFile(resolve(directory, 'stale-v6-envelope.json'), `${JSON.stringify(staleEnvelope, null, 2)}\n`),
  ]);
}
