import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { PNG } from 'pngjs';
import { z } from 'zod';

import { PresentationPreferencesSchema } from '../../src/application/presentation/preferences';
import { resolveEvidenceSource } from '../qualification/evidence-source';
import { resolveTestedCommit } from '../qualification/tested-commit';
import { resolveEvidenceOutputRoot } from '../verification/evidence-output';
import { findPackagedExecutable, validateScreenshotBuffers } from './package-smoke-utils';

const EvidenceSchema = z.object({
  artMode: z.literal('enhanced'),
  presentationHash: z.string().regex(/^[0-9a-f]{8}$/u),
  selectedWorldZoom: z.literal(3),
  uiScale: z.literal(1.25),
  overflow: z.object({ body: z.literal(false), surface: z.literal(false) }).strict(),
}).passthrough();
const ResultSchema = z.object({
  mode: z.enum(['seed', 'restart']),
  evidence: EvidenceSchema,
}).strict();

const outputRoot = process.env.SI_WORLD_PACKAGE_OUTPUT_ROOT
  ? resolve(process.cwd(), process.env.SI_WORLD_PACKAGE_OUTPUT_ROOT)
  : join(process.cwd(), 'out');
const evidenceRoot = resolveEvidenceOutputRoot(process.argv.slice(2), {
  defaultRelative: 'output/verification/presentation-restart',
});
const executable = findPackagedExecutable(outputRoot);
const smokeUserData = mkdtempSync(join(tmpdir(), 'si-world-presentation-smoke-'));
const seedScreenshot = join(evidenceRoot, 'seed.png');
const restartScreenshot = join(evidenceRoot, 'restart.png');
const evidenceSource = resolveEvidenceSource([
  'electron/main/index.ts',
  'electron/persistence/presentation-preferences.ts',
  'package.json',
  'scripts/electron/run-presentation-restart-package-smoke.ts',
  'src/application/presentation/preferences.ts',
  'src/world/presentation/art-presentation.ts',
  'src/world/presentation/material-selection.ts',
]);
mkdirSync(evidenceRoot, { recursive: true });

async function launch(mode: 'seed' | 'restart', screenshot: string): Promise<z.infer<typeof ResultSchema>> {
  const environmentFlag = mode === 'seed'
    ? { SI_WORLD_PRESENTATION_SEED_SMOKE: '1' }
    : { SI_WORLD_PRESENTATION_RESTART_SMOKE: '1' };
  const result = await new Promise<Readonly<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }>>((resolveProcess, rejectProcess) => {
    const child = spawn(executable, [], {
      detached: false,
      env: {
        ...process.env,
        ...environmentFlag,
        SI_WORLD_PRESENTATION_SCREENSHOT: screenshot,
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
      `Presentation ${mode} smoke ${result.timedOut ? 'timed out' : `exited with ${String(result.code)}`}. ` +
      `${result.stderr.slice(-3_000)} ${result.stdout.slice(-3_000)}`,
    );
  }
  const prefix = 'SI_WORLD_PRESENTATION_SMOKE_RESULT ';
  const line = result.stdout.split(/\r?\n/u).find((candidate) => candidate.startsWith(prefix));
  if (!line) throw new Error(`Presentation ${mode} smoke did not emit evidence.`);
  const parsed = ResultSchema.parse(JSON.parse(line.slice(prefix.length)) as unknown);
  if (parsed.mode !== mode) throw new Error(`Presentation smoke emitted ${parsed.mode} during ${mode}.`);
  return parsed;
}

async function main(): Promise<void> {
  try {
    const seed = await launch('seed', seedScreenshot);
    const preferencesPath = join(smokeUserData, 'si-world', 'presentation-preferences.json');
    const persistedAfterSeed = PresentationPreferencesSchema.parse(JSON.parse(readFileSync(preferencesPath, 'utf8')) as unknown);
    const restart = await launch('restart', restartScreenshot);
    const persistedAfterRestart = PresentationPreferencesSchema.parse(JSON.parse(readFileSync(preferencesPath, 'utf8')) as unknown);
    if (persistedAfterSeed.worldZoom !== 3 || persistedAfterSeed.uiScale !== 1.25 ||
        persistedAfterRestart.worldZoom !== 3 || persistedAfterRestart.uiScale !== 1.25) {
      throw new Error('Presentation preferences did not persist as 3x and 125 percent across restart.');
    }
    if (seed.evidence.presentationHash !== restart.evidence.presentationHash) {
      throw new Error('Art presentation hash changed across restart.');
    }
    const seedImage = PNG.sync.read(readFileSync(seedScreenshot));
    const restartImage = PNG.sync.read(readFileSync(restartScreenshot));
    if (seedImage.width !== restartImage.width || seedImage.height !== restartImage.height) {
      throw new Error('Presentation restart changed screenshot dimensions.');
    }
    validateScreenshotBuffers(readFileSync(seedScreenshot), readFileSync(restartScreenshot));
    const reportPath = join(evidenceRoot, 'presentation-restart-report.json');
    writeFileSync(reportPath, `${JSON.stringify({
      schemaVersion: 1,
      evidenceSource,
      testedCommit: resolveTestedCommit(),
      seed,
      restart,
      persistedAfterSeed,
      persistedAfterRestart,
      screenshots: { seed: 'seed.png', restart: 'restart.png' },
    }, null, 2)}\n`, { encoding: 'utf8', flush: true });
    process.stdout.write(`Presentation restart smoke: ${reportPath}\n`);
  } finally {
    rmSync(smokeUserData, { force: true, recursive: true });
  }
}

void main();
