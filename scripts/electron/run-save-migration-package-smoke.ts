import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { PNG } from 'pngjs';
import { z } from 'zod';

import { parseSaveEnvelope, parseSupportedSaveEnvelope } from '../../electron/persistence/save-format';
import { resolveEvidenceSource } from '../qualification/evidence-source';
import { resolveTestedCommit } from '../qualification/tested-commit';
import { resolveEvidenceOutputRoot } from '../verification/evidence-output';
import { findPackagedExecutable, validateScreenshotBuffers } from './package-smoke-utils';

const LoadResultSchema = z.object({
  status: z.literal('unchanged'),
  saveGeneration: z.literal(8),
  state: z.object({
    schemaVersion: z.literal(6),
    protagonist: z.object({
      worldPosition: z.object({
        mapId: z.string().min(1),
        tileX: z.number().int().nonnegative(),
        tileY: z.number().int().nonnegative(),
      }).passthrough(),
    }).passthrough(),
    layoutRevisions: z.record(z.string(), z.number().int().nonnegative()),
  }).passthrough(),
}).passthrough();
const ResultSchema = z.object({
  mode: z.enum(['migration', 'reload']),
  expectedSaveStatus: z.string().min(1),
  visibleSaveStatus: z.string().min(1),
  loaded: LoadResultSchema,
  worldStateLabel: z.string().min(1),
}).strict();

const outputRoot = process.env.SI_WORLD_PACKAGE_OUTPUT_ROOT
  ? resolve(process.cwd(), process.env.SI_WORLD_PACKAGE_OUTPUT_ROOT)
  : join(process.cwd(), 'out');
const evidenceRoot = resolveEvidenceOutputRoot(process.argv.slice(2), {
  defaultRelative: 'output/verification/save-migration',
});
const executable = findPackagedExecutable(outputRoot);
const smokeUserData = mkdtempSync(join(tmpdir(), 'si-world-save-migration-smoke-'));
const slotPath = join(smokeUserData, 'si-world', 'save-slots', 'slot-001');
const statePath = join(slotPath, 'state.json');
const backupPath = join(slotPath, 'state.json.bak');
const fixtureBytes = readFileSync(resolve('tests/fixtures/saves/valid-v5-envelope.json'), 'utf8');
const evidenceSource = resolveEvidenceSource([
  'electron/main/index.ts',
  'electron/persistence/save-format.ts',
  'electron/persistence/save-repository.ts',
  'package.json',
  'scripts/electron/run-save-migration-package-smoke.ts',
  'src/domain/state/migrations/v5-to-v6.ts',
  'tests/fixtures/saves/valid-v5-envelope.json',
]);
mkdirSync(slotPath, { recursive: true });
mkdirSync(evidenceRoot, { recursive: true });
writeFileSync(statePath, fixtureBytes, { encoding: 'utf8', flush: true });

async function launch(mode: 'migration' | 'reload', screenshot: string): Promise<z.infer<typeof ResultSchema>> {
  const modeFlag = mode === 'migration'
    ? { SI_WORLD_SAVE_MIGRATION_SMOKE: '1' }
    : { SI_WORLD_SAVE_RELOAD_SMOKE: '1' };
  const result = await new Promise<Readonly<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }>>((resolveProcess, rejectProcess) => {
    const child = spawn(executable, [], {
      detached: false,
      env: {
        ...process.env,
        ...modeFlag,
        SI_WORLD_SAVE_MIGRATION_SCREENSHOT: screenshot,
        SI_WORLD_SMOKE: '1',
        SI_WORLD_SMOKE_USER_DATA: smokeUserData,
      },
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const append = (current: string, chunk: Buffer): string => `${current}${chunk.toString('utf8')}`.slice(-1_000_000);
    child.stdout.on('data', (chunk: Buffer) => { stdout = append(stdout, chunk); });
    child.stderr.on('data', (chunk: Buffer) => { stderr = append(stderr, chunk); });
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, 60_000);
    child.once('error', (error) => {
      clearTimeout(timeout);
      rejectProcess(error);
    });
    child.once('close', (code) => {
      clearTimeout(timeout);
      resolveProcess({ code, stdout, stderr, timedOut });
    });
  });
  if (result.code !== 0) {
    throw new Error(
      `Save ${mode} smoke ${result.timedOut ? 'timed out' : `exited with ${String(result.code)}`}. ` +
      `${result.stderr.slice(-3_000)} ${result.stdout.slice(-3_000)}`,
    );
  }
  const prefix = 'SI_WORLD_SAVE_MIGRATION_SMOKE_RESULT ';
  const line = result.stdout.split(/\r?\n/u).find((candidate) => candidate.startsWith(prefix));
  if (!line) throw new Error(`Save ${mode} smoke did not emit evidence.`);
  const parsed = ResultSchema.parse(JSON.parse(line.slice(prefix.length)) as unknown);
  if (parsed.mode !== mode || parsed.visibleSaveStatus !== parsed.expectedSaveStatus) {
    throw new Error(`Save ${mode} smoke emitted the wrong visible status.`);
  }
  return parsed;
}

async function main(): Promise<void> {
  try {
    const migrationScreenshot = join(evidenceRoot, 'migration.png');
    const reloadScreenshot = join(evidenceRoot, 'reload.png');
    const migration = await launch('migration', migrationScreenshot);
    const migratedEnvelope = parseSaveEnvelope(JSON.parse(readFileSync(statePath, 'utf8')) as unknown);
    const backupBytes = readFileSync(backupPath, 'utf8');
    const backupEnvelope = parseSupportedSaveEnvelope(JSON.parse(backupBytes) as unknown);
    if (migratedEnvelope.saveGeneration !== 8 || migratedEnvelope.state.schemaVersion !== 6) {
      throw new Error('Migrated main save is not a valid v6 generation 8 envelope.');
    }
    if (backupBytes !== fixtureBytes || backupEnvelope.state.schemaVersion !== 5) {
      throw new Error('Migration did not preserve the exact v5 source as its backup.');
    }
    const reload = await launch('reload', reloadScreenshot);
    const afterReloadEnvelope = parseSaveEnvelope(JSON.parse(readFileSync(statePath, 'utf8')) as unknown);
    if (afterReloadEnvelope.payloadChecksum !== migratedEnvelope.payloadChecksum) {
      throw new Error('Reload changed the migrated v6 save.');
    }
    const migrationImage = PNG.sync.read(readFileSync(migrationScreenshot));
    const reloadImage = PNG.sync.read(readFileSync(reloadScreenshot));
    if (migrationImage.width !== reloadImage.width || migrationImage.height !== reloadImage.height) {
      throw new Error('Save reload changed screenshot dimensions.');
    }
    validateScreenshotBuffers(readFileSync(migrationScreenshot), readFileSync(reloadScreenshot));
    const reportPath = join(evidenceRoot, 'save-migration-report.json');
    writeFileSync(reportPath, `${JSON.stringify({
      schemaVersion: 1,
      evidenceSource,
      testedCommit: resolveTestedCommit(),
      migration,
      reload,
      disk: {
        mainSchemaVersion: migratedEnvelope.state.schemaVersion,
        mainSaveGeneration: migratedEnvelope.saveGeneration,
        mainPayloadChecksum: migratedEnvelope.payloadChecksum,
        exactV5BackupPreserved: true,
        backupSchemaVersion: backupEnvelope.state.schemaVersion,
      },
      screenshots: { migration: 'migration.png', reload: 'reload.png' },
    }, null, 2)}\n`, { encoding: 'utf8', flush: true });
    process.stdout.write(`Save migration smoke: ${reportPath}\n`);
  } finally {
    rmSync(smokeUserData, { force: true, recursive: true });
  }
}

void main();
