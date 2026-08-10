import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  canonicalLegacyStateV5Json,
  checksumLegacyStateV5,
  checksumUtf8,
} from '../../electron/persistence/checksum';
import { createSaveEnvelope } from '../../electron/persistence/save-format';
import { createInitialState } from '../../src/domain/state/initial-state';
import { LegacyStateV5Schema } from '../../src/domain/state/migrations/v5-to-v6';
import { WorldStateSchema } from '../../src/domain/state/schema';

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
  const { layoutRevisions: _layoutRevisions, layoutMigrationEvidence: _layoutEvidence, ...legacyFields } = current;
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
  const staleState = WorldStateSchema.parse({
    ...current,
    generationId: 'generation-fixture-v6-stale',
    layoutRevisions: Object.fromEntries(Object.keys(current.maps).map((mapId) => [mapId, 0])),
    layoutMigrationEvidence: [],
  });
  const staleEnvelope = createSaveEnvelope('slot-001', 11, 'manual', staleState);
  await Promise.all([
    writeFile(resolve(directory, 'valid-v5-envelope.json'), `${JSON.stringify(legacyEnvelope, null, 2)}\n`),
    writeFile(resolve(directory, 'stale-v6-envelope.json'), `${JSON.stringify(staleEnvelope, null, 2)}\n`),
  ]);
}
