import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { WORLD_MAP_CATALOG } from '../../src/application/runtime/map-catalog';
import { buildDeterministicMovementTrace } from '../../src/render/movement-evidence';
import { resolveEvidenceSource } from '../qualification/evidence-source';
import { resolveTestedCommit } from '../qualification/tested-commit';
import { resolveEvidenceOutputRoot } from '../verification/evidence-output';
import { findPackagedExecutable } from './package-smoke-utils';
import {
  validateNaturalMovementReport,
  type NaturalMovementReport,
} from './natural-movement-report';

const outputRoot = process.env.SI_WORLD_PACKAGE_OUTPUT_ROOT
  ? resolve(process.cwd(), process.env.SI_WORLD_PACKAGE_OUTPUT_ROOT)
  : join(process.cwd(), 'out');
const evidenceRoot = resolveEvidenceOutputRoot(process.argv.slice(2), {
  defaultRelative: 'output/verification/natural-movement',
});
const profile = process.env.SI_WORLD_SMOKE_PROFILE ?? 'qualification';
if (profile !== 'qualification' && profile !== 'platform-shell') {
  throw new Error(`Unknown natural-movement smoke profile: ${profile}.`);
}
mkdirSync(evidenceRoot, { recursive: true });

const executable = findPackagedExecutable(outputRoot);
const appendBounded = (current: string, chunk: Buffer): string =>
  `${current}${chunk.toString('utf8')}`.slice(-2_000_000);

async function runPackagePass(mode: 'standard' | 'reduced'): Promise<unknown> {
  const smokeUserData = mkdtempSync(join(tmpdir(), `si-world-natural-movement-${mode}-`));
  try {
    return await new Promise((resolvePass, rejectPass) => {
      const child = spawn(executable, [], {
        detached: false,
        env: {
          ...process.env,
          SI_WORLD_NATURAL_MOVEMENT_REDUCED: mode === 'reduced' ? '1' : '0',
          SI_WORLD_NATURAL_MOVEMENT_SCREENSHOT_DIR: evidenceRoot,
          SI_WORLD_NATURAL_MOVEMENT_SMOKE: '1',
          SI_WORLD_SMOKE: '1',
          SI_WORLD_SMOKE_PROFILE: profile,
          SI_WORLD_SMOKE_USER_DATA: smokeUserData,
        },
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      child.stdout.on('data', (chunk: Buffer) => { stdout = appendBounded(stdout, chunk); });
      child.stderr.on('data', (chunk: Buffer) => { stderr = appendBounded(stderr, chunk); });
      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, 180_000);
      child.once('error', (error) => {
        clearTimeout(timeout);
        rejectPass(error);
      });
      child.once('close', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          rejectPass(new Error(
            `Natural-movement ${mode} package smoke ${timedOut ? 'timed out' : `exited with ${String(code)}`}. ` +
            `${stderr.slice(-5_000)} ${stdout.slice(-5_000)}`,
          ));
          return;
        }
        const prefix = 'SI_WORLD_NATURAL_MOVEMENT_SMOKE_RESULT ';
        const line = stdout.split(/\r?\n/u).find((candidate) => candidate.startsWith(prefix));
        if (!line) {
          rejectPass(new Error(`Natural-movement ${mode} package smoke did not emit evidence.`));
          return;
        }
        try {
          resolvePass(JSON.parse(line.slice(prefix.length)) as unknown);
        } catch (error) {
          rejectPass(error);
        }
      });
    });
  } finally {
    rmSync(smokeUserData, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  const map = WORLD_MAP_CATALOG.northwest_residential;
  const firstTrace = buildDeterministicMovementTrace(map, { x: 18, y: 18 }, { x: 22, y: 22 });
  const secondTrace = buildDeterministicMovementTrace(map, { x: 18, y: 18 }, { x: 22, y: 22 });
  if (JSON.stringify(firstTrace) !== JSON.stringify(secondTrace)) {
    throw new Error('Two fixed-step natural-movement traces are not identical.');
  }
  const standard = await runPackagePass('standard');
  const reduced = await runPackagePass('reduced');
  const evidenceSource = resolveEvidenceSource([
    '.github/workflows/ci.yml',
    'electron/main/index.ts',
    'package.json',
    'scripts/electron/natural-movement-report.ts',
    'scripts/electron/run-natural-movement-package-smoke.ts',
    'src/application/runtime/movement-frame.ts',
    'src/render/WorldScene.tsx',
    'src/render/movement-evidence.ts',
    'src/render/world-frame.ts',
    'src/world/movement/motion-clock.ts',
    'src/world/movement/reservations.ts',
    'src/world/movement/turn-curve.ts',
    'src/world/pathfinding/astar.ts',
    'src/world/pathfinding/movement.ts',
  ]);
  const report: NaturalMovementReport = {
    schemaVersion: 1,
    testedCommit: resolveTestedCommit(),
    evidenceSource: { ...evidenceSource, sourcePaths: [...evidenceSource.sourcePaths] },
    traceDeterministic: true,
    trace: firstTrace,
    package: {
      standard: standard as NaturalMovementReport['package']['standard'],
      reduced: reduced as NaturalMovementReport['package']['reduced'],
    },
  };
  validateNaturalMovementReport(report, evidenceRoot, {
    validateScreenshots: true,
  });
  const reportPath = join(evidenceRoot, 'natural-movement-report.json');
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flush: true });
  process.stdout.write(`Natural movement smoke: ${reportPath}\n`);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
