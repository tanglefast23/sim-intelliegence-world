import { readFileSync } from 'node:fs';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

import { SaveRequestSchema, type SaveTrigger } from '../../src/application/effects/PersistencePort';
import { createInitialState } from '../../src/domain/state/initial-state';
import { migrateStateCopy } from '../../src/domain/state/migrations';
import { WorldStateSchema, type WorldState } from '../../src/domain/state/schema';
import { SaveManifestSchema, parseSaveEnvelope } from '../../electron/persistence/save-format';
import {
  SaveRepository,
  saveRootForUserData,
  type SaveFaultStage,
} from '../../electron/persistence/save-repository';

type BoundaryFixture = Readonly<{
  trigger: SaveTrigger;
  blockingPauseTokens: readonly string[];
}>;

const boundaryFixtures = JSON.parse(readFileSync(
  resolve('tests/fixtures/saves/stable-boundaries.json'),
  'utf8',
)) as BoundaryFixture[];

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'si-world-save-test-'));
  temporaryRoots.push(path);
  return path;
}

function stateAtRevision(revision: number, displayName = 'Player'): WorldState {
  return WorldStateSchema.parse({ ...createInitialState(displayName), revision });
}

function request(
  state: WorldState,
  expectedSaveGeneration: number | null,
  trigger: SaveTrigger = 'manual',
) {
  return SaveRequestSchema.parse({
    slotId: 'slot-001',
    expectedSaveGeneration,
    trigger,
    state,
  });
}

async function runCrashChild(root: string, stage: SaveFaultStage): Promise<Readonly<{
  code: number | null;
  signal: NodeJS.Signals | null;
}>> {
  const child = spawn(
    process.execPath,
    [resolve('node_modules/tsx/dist/cli.mjs'), resolve('scripts/persistence/save-crash-child.ts'), root, stage],
    { stdio: 'ignore' },
  );
  return new Promise((resolveClose, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolveClose({ code, signal }));
  });
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

describe('recoverable save repository', () => {
  test('clean save and load restore byte-identical authority with zero offline catch-up', async () => {
    const root = await temporaryRoot();
    const repository = new SaveRepository(root);
    const state = stateAtRevision(4, 'Joe');
    const saved = await repository.save(request(state, null));
    const loaded = await repository.load('slot-001');

    expect(saved).toEqual(expect.objectContaining({ status: 'saved', saveGeneration: 1 }));
    expect(loaded).toEqual(expect.objectContaining({
      status: 'loaded',
      saveGeneration: 1,
      source: 'main',
      state,
    }));
    if (loaded.status !== 'loaded') throw new Error('Expected a loaded save.');
    if (saved.status !== 'saved') throw new Error('Expected a saved result.');
    expect(loaded.checksum).toBe(saved.checksum);
    expect(saved.maintenanceWarnings).toEqual([]);
    expect(JSON.stringify(loaded.state)).toBe(JSON.stringify(state));
    expect(loaded.state.clock).toEqual(state.clock);
    expect(loaded.state.prng).toEqual(state.prng);
    expect(loaded.state.modelPin).toEqual(state.modelPin);

    const slotPath = join(root, 'save-slots', 'slot-001');
    const envelope = parseSaveEnvelope(JSON.parse(await readFile(join(slotPath, 'state.json'), 'utf8')) as unknown);
    const manifest = SaveManifestSchema.parse(JSON.parse(await readFile(join(slotPath, 'manifest.json'), 'utf8')) as unknown);
    expect(manifest.latestSaveGeneration).toBe(envelope.saveGeneration);
    expect(manifest.payloadChecksum).toBe(envelope.payloadChecksum);
    expect(manifest.pins.modelArtifactSha256).toBe(state.modelPin.artifactSha256);
  });

  test('fixture-driven stable boundaries rotate only the newest three autosaves', async () => {
    const root = await temporaryRoot();
    const repository = new SaveRepository(root);
    const stable = boundaryFixtures.filter(({ blockingPauseTokens }) => blockingPauseTokens.length === 0);
    let generation: number | null = null;
    for (const [index, fixture] of [...stable, stable[0]!].entries()) {
      const result = await repository.save(request(stateAtRevision(index), generation, fixture.trigger));
      if (result.status !== 'saved') throw new Error('Stable boundary was deferred.');
      generation = result.saveGeneration;
    }
    expect((await readdir(join(root, 'save-slots', 'slot-001', 'autosaves'))).sort()).toEqual([
      'autosave-000000000002.json',
      'autosave-000000000003.json',
      'autosave-000000000004.json',
    ]);
  });

  test.each(boundaryFixtures.filter(({ blockingPauseTokens }) => blockingPauseTokens.length > 0))(
    '$trigger is deferred at an unstable fixture boundary',
    async ({ trigger, blockingPauseTokens }) => {
      const root = await temporaryRoot();
      const repository = new SaveRepository(root);
      const state = WorldStateSchema.parse({
        ...createInitialState(),
        clock: { ...createInitialState().clock, pauseTokens: blockingPauseTokens },
      });
      await expect(repository.save(request(state, null, trigger))).resolves.toEqual({
        status: 'deferred',
        slotId: 'slot-001',
        blockingPauseTokens,
      });
      await expect(repository.load('slot-001')).resolves.toEqual({ status: 'empty', slotId: 'slot-001' });
    },
  );

  test('the queue serializes writers and rejects the stale one without poisoning later work', async () => {
    const root = await temporaryRoot();
    const repository = new SaveRepository(root);
    const first = repository.save(request(stateAtRevision(1), null));
    const stale = repository.save(request(stateAtRevision(2), null));
    await expect(first).resolves.toEqual(expect.objectContaining({ status: 'saved', saveGeneration: 1 }));
    await expect(stale).rejects.toThrow('Stale save writer');
    await expect(repository.save(request(stateAtRevision(3), 1))).resolves.toEqual(
      expect.objectContaining({ status: 'saved', saveGeneration: 2 }),
    );
  });

  test.each<SaveFaultStage>([
    'before-write',
    'after-write',
    'after-flush',
    'after-validation',
    'after-backup',
  ])('fault after %s never loses the last complete generation', async (faultStage) => {
    const root = await temporaryRoot();
    let armed = false;
    const repository = new SaveRepository(root, (stage) => {
      if (armed && stage === faultStage) throw new Error(`Injected ${stage}`);
    });
    await repository.save(request(stateAtRevision(1), null));
    armed = true;
    await expect(repository.save(request(stateAtRevision(2), 1))).rejects.toThrow(`Injected ${faultStage}`);
    const loaded = await repository.load('slot-001');
    expect(loaded.status).toBe('loaded');
    if (loaded.status !== 'loaded') throw new Error('Expected recovery after injected fault.');
    expect(loaded.saveGeneration).toBeGreaterThanOrEqual(1);
    expect(loaded.saveGeneration).toBeLessThanOrEqual(2);
    expect([1, 2]).toContain(loaded.state.revision);
  });

  test.each<Readonly<{ stage: SaveFaultStage; warning: string }>>([
    { stage: 'after-replacement', warning: 'post_commit_observer_failed' },
    { stage: 'before-autosave-maintenance', warning: 'autosave_maintenance_failed' },
    { stage: 'before-manifest-maintenance', warning: 'manifest_maintenance_failed' },
  ])('post-commit $stage returns the committed generation with a maintenance warning', async ({ stage, warning }) => {
    const root = await temporaryRoot();
    let armed = false;
    const repository = new SaveRepository(root, (candidate) => {
      if (armed && candidate === stage) throw new Error(`Injected ${candidate}`);
    });
    await repository.save(request(stateAtRevision(1), null));
    armed = true;
    const trigger = stage === 'before-autosave-maintenance' ? 'sleep' : 'manual';
    await expect(repository.save(request(stateAtRevision(2), 1, trigger))).resolves.toEqual(
      expect.objectContaining({
        status: 'saved',
        saveGeneration: 2,
        maintenanceWarnings: [warning],
      }),
    );
    await expect(repository.load('slot-001')).resolves.toEqual(expect.objectContaining({
      status: 'loaded',
      saveGeneration: 2,
      state: expect.objectContaining({ revision: 2 }),
    }));
  });

  test.each<SaveFaultStage>([
    'after-write',
    'after-flush',
    'after-validation',
    'after-backup',
    'after-replacement',
  ])('forced process death after %s preserves a complete recoverable generation', async (faultStage) => {
    const root = await temporaryRoot();
    const repository = new SaveRepository(root);
    await repository.save(request(stateAtRevision(1), null));
    const death = await runCrashChild(root, faultStage);
    expect(death.code).not.toBe(2);
    expect(death.signal === 'SIGKILL' || death.code !== 0).toBe(true);

    const loaded = await new SaveRepository(root).load('slot-001');
    expect(loaded.status).toBe('loaded');
    if (loaded.status !== 'loaded') throw new Error('Forced death lost every valid generation.');
    expect(loaded.saveGeneration).toBeGreaterThanOrEqual(1);
    expect(loaded.saveGeneration).toBeLessThanOrEqual(2);
    expect([1, 2]).toContain(loaded.state.revision);
  }, 20_000);

  test.each([
    { code: 'ENOSPC', label: 'disk full' },
    { code: 'EACCES', label: 'permission failure' },
  ])('$label leaves existing bytes unchanged', async ({ code }) => {
    const root = await temporaryRoot();
    let armed = false;
    const repository = new SaveRepository(root, (stage) => {
      if (armed && stage === 'before-write') {
        const error = new Error(code) as NodeJS.ErrnoException;
        error.code = code;
        throw error;
      }
    });
    await repository.save(request(stateAtRevision(1), null));
    const mainPath = join(root, 'save-slots', 'slot-001', 'state.json');
    const before = await readFile(mainPath, 'utf8');
    armed = true;
    await expect(repository.save(request(stateAtRevision(2), 1))).rejects.toMatchObject({ code });
    expect(await readFile(mainPath, 'utf8')).toBe(before);
    await expect(repository.load('slot-001')).resolves.toEqual(expect.objectContaining({
      status: 'loaded',
      saveGeneration: 1,
    }));
  });

  test('corrupt main data is preserved and the valid backup is selected', async () => {
    const root = await temporaryRoot();
    const repository = new SaveRepository(root);
    await repository.save(request(stateAtRevision(1), null));
    await repository.save(request(stateAtRevision(2), 1));
    const mainPath = join(root, 'save-slots', 'slot-001', 'state.json');
    const corrupt = JSON.parse(await readFile(mainPath, 'utf8')) as { saveGeneration: number };
    corrupt.saveGeneration = 999;
    const corruptBytes = `${JSON.stringify(corrupt)}\n`;
    await writeFile(mainPath, corruptBytes, 'utf8');

    const loaded = await repository.load('slot-001');
    expect(loaded).toEqual(expect.objectContaining({
      status: 'loaded',
      saveGeneration: 1,
      source: 'backup',
      invalidCandidateCount: 1,
    }));
    expect(await readFile(mainPath, 'utf8')).toBe(corruptBytes);
  });

  test('a recovered temporary generation becomes the next valid backup', async () => {
    const root = await temporaryRoot();
    let armed = false;
    const crashingRepository = new SaveRepository(root, (stage) => {
      if (armed && stage === 'after-validation') throw new Error('leave complete temporary');
    });
    await crashingRepository.save(request(stateAtRevision(1), null));
    armed = true;
    await expect(crashingRepository.save(request(stateAtRevision(2), 1))).rejects.toThrow();

    const repository = new SaveRepository(root);
    await expect(repository.load('slot-001')).resolves.toEqual(expect.objectContaining({
      status: 'loaded',
      saveGeneration: 2,
      source: 'temporary',
    }));
    await repository.save(request(stateAtRevision(3), 2));
    const backup = parseSaveEnvelope(JSON.parse(await readFile(
      join(root, 'save-slots', 'slot-001', 'state.json.bak'),
      'utf8',
    )) as unknown);
    expect(backup.saveGeneration).toBe(2);
    expect(backup.state.revision).toBe(2);
  });

  test('generation order wins over future modification time', async () => {
    const root = await temporaryRoot();
    const repository = new SaveRepository(root);
    await repository.save(request(stateAtRevision(1), null));
    await repository.save(request(stateAtRevision(2), 1, 'sleep'));
    const backupPath = join(root, 'save-slots', 'slot-001', 'state.json.bak');
    await utimes(backupPath, new Date('2099-01-01T00:00:00Z'), new Date('2099-01-01T00:00:00Z'));
    await expect(repository.load('slot-001')).resolves.toEqual(expect.objectContaining({
      status: 'loaded',
      saveGeneration: 2,
      state: expect.objectContaining({ revision: 2 }),
    }));
  });

  test('an unrecoverable unknown file is reported, preserved, and not overwritten', async () => {
    const root = await temporaryRoot();
    const slotPath = join(root, 'save-slots', 'slot-001');
    await mkdir(slotPath, { recursive: true });
    const mainPath = join(slotPath, 'state.json');
    const unknown = '{"formatVersion":999,"future":true}\n';
    await writeFile(mainPath, unknown, 'utf8');
    const repository = new SaveRepository(root);

    await expect(repository.load('slot-001')).resolves.toEqual({
      status: 'unrecoverable',
      slotId: 'slot-001',
      invalidCandidateCount: 1,
    });
    await expect(repository.save(request(stateAtRevision(1), null))).rejects.toThrow('corrupt candidates were preserved');
    expect(await readFile(mainPath, 'utf8')).toBe(unknown);
  });

  test('slot IDs cannot traverse outside the save root', async () => {
    const repository = new SaveRepository(await temporaryRoot());
    await expect(repository.load('../escape' as 'slot-001')).rejects.toThrow();
    expect(saveRootForUserData('/user-data')).toBe(join('/user-data', 'si-world'));
  });
});

describe('save migrations and state invariants', () => {
  test('v1 migration copies authority, adds the exact model pin, and leaves its source unchanged', () => {
    const source = JSON.parse(readFileSync(resolve('tests/fixtures/saves/legacy-v1.json'), 'utf8')) as unknown;
    const before = JSON.stringify(source);
    const migrated = migrateStateCopy(source, 'generation-migrated-001');

    expect(JSON.stringify(source)).toBe(before);
    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.generationId).toBe('generation-migrated-001');
    expect(migrated.modelPin).toEqual({
      id: 'qwen3.5-9b',
      sourceRevision: 'c202236235762e1c871ad0ccb60c8ee5ba337b9a',
      artifactSha256: '8a9256b233037ea081c2e606e49dba0851cd42e441800da8ee04597ae9798341',
    });
    expect(migrated.npcs.linda?.unlockedIds).toEqual([]);
    expect(migrated.protagonist.worldPosition).toEqual({
      mapId: 'northwest_residential',
      tileX: 18,
      tileY: 18,
    });
    expect(migrated.npcs.linda?.presence).toEqual({
      kind: 'active_local', mapId: 'northwest_residential', locationId: 'linda_villa', tileX: 23, tileY: 28,
    });
    expect(migrated.npcs.generic_resident?.presence).toEqual({
      kind: 'active_local', mapId: 'northwest_residential', locationId: 'northwest_residential', tileX: 29, tileY: 33,
    });
    expect(migrated.economy.nextBasicCostMinute).toBe(1_440);
    expect(migrated.schedules.linda_daily?.blocks).toEqual(createInitialState().schedules.linda_daily?.blocks);
  });

  test('an unavailable migration fails without modifying its source', () => {
    const source = { schemaVersion: 99, data: 'preserve me' };
    const before = JSON.stringify(source);
    expect(() => migrateStateCopy(source, 'generation-migrated-099')).toThrow('No compatible state migration');
    expect(JSON.stringify(source)).toBe(before);
  });

  test('copying a current v4 state also receives the requested new generation ID', () => {
    const source = createInitialState();
    const migrated = migrateStateCopy(source, 'generation-current-copy-001');
    expect(migrated.generationId).toBe('generation-current-copy-001');
    expect(source.generationId).toBe('generation-prototype-001');
  });

  test('repository migration writes a new slot and keeps the old state file byte-identical', async () => {
    const root = await temporaryRoot();
    const sourceSlotPath = join(root, 'save-slots', 'slot-001');
    await mkdir(sourceSlotPath, { recursive: true });
    const sourcePath = join(sourceSlotPath, 'state.json');
    const legacyBytes = readFileSync(resolve('tests/fixtures/saves/legacy-v1.json'), 'utf8');
    await writeFile(sourcePath, legacyBytes, 'utf8');
    const repository = new SaveRepository(root);

    await expect(repository.migrate({
      sourceSlotId: 'slot-001',
      targetSlotId: 'slot-002',
      nextGenerationId: 'generation-migrated-002',
    })).resolves.toEqual(expect.objectContaining({
      status: 'migrated',
      sourceSlotId: 'slot-001',
      targetSlotId: 'slot-002',
      saveGeneration: 1,
      stateSchemaVersion: 4,
    }));
    expect(await readFile(sourcePath, 'utf8')).toBe(legacyBytes);
    await expect(repository.load('slot-002')).resolves.toEqual(expect.objectContaining({
      status: 'loaded',
      state: expect.objectContaining({
        generationId: 'generation-migrated-002',
        schemaVersion: 4,
        protagonist: expect.objectContaining({
          worldPosition: { mapId: 'northwest_residential', tileX: 18, tileY: 18 },
        }),
      }),
    }));
  });

  test('duplicate persistent unlocks are rejected before saving', () => {
    const state = createInitialState();
    expect(() => WorldStateSchema.parse({
      ...state,
      npcs: {
        ...state.npcs,
        linda: { ...state.npcs.linda, unlockedIds: ['velvet_tide_lead', 'velvet_tide_lead'] },
      },
    })).toThrow('Unlock IDs must be unique');
  });
});
