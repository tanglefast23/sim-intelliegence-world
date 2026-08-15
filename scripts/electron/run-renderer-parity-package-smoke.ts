import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { z } from 'zod';

import { resolveEvidenceSource } from '../qualification/evidence-source';
import { resolveTestedCommit } from '../qualification/tested-commit';
import { resolveEvidenceOutputRoot } from '../verification/evidence-output';
import { findPackagedExecutable } from './package-smoke-utils';

const FixtureIdSchema = z.enum([
  'villa-exterior-idle',
  'villa-interior-roof-hidden',
  'villa-door-transition',
  'villa-walk-east-frame-1',
  'villa-selected-npc',
  'villa-destination-journal-failure',
]);
const StateSchema = z.object({
  camera: z.object({ x: z.number(), y: z.number(), zoom: z.literal(1) }).strict(),
  viewport: z.object({ width: z.literal(1280), height: z.literal(720) }).strict(),
  devicePixelRatio: z.literal(1),
}).passthrough();
const PassSchema = z.object({
  schemaVersion: z.literal(1),
  rendererKind: z.enum(['skia', 'threejs-2d']),
  fixtures: z.array(z.object({
    id: FixtureIdSchema,
    screenshot: z.string().min(1),
    state: StateSchema,
  }).strict()).length(6),
  contextLifecycle: z.record(z.string(), z.unknown()).nullable(),
}).strict();

const outputRoot = process.env.SI_WORLD_PACKAGE_OUTPUT_ROOT
  ? resolve(process.cwd(), process.env.SI_WORLD_PACKAGE_OUTPUT_ROOT)
  : join(process.cwd(), 'out');
const evidenceRoot = resolveEvidenceOutputRoot(process.argv.slice(2), {
  defaultRelative: 'output/verification/threejs-2d/stage-2/parity-package',
});
const executable = findPackagedExecutable(outputRoot);
mkdirSync(evidenceRoot, { recursive: true });

async function run(rendererKind: 'skia' | 'threejs-2d'): Promise<z.infer<typeof PassSchema>> {
  const userData = mkdtempSync(join(tmpdir(), `si-world-renderer-parity-${rendererKind}-`));
  const screenshotDirectory = join(evidenceRoot, rendererKind);
  rmSync(screenshotDirectory, { force: true, recursive: true });
  mkdirSync(screenshotDirectory, { recursive: true });
  try {
    return await new Promise((resolvePass, rejectPass) => {
      const child = spawn(executable, ['--force-device-scale-factor=1', '--force-prefers-reduced-motion'], {
        detached: false,
        env: {
          ...process.env,
          SI_WORLD_RENDERER_PARITY_SCREENSHOT_DIR: screenshotDirectory,
          SI_WORLD_RENDERER_PARITY_SMOKE: '1',
          SI_WORLD_SMOKE: '1',
          SI_WORLD_SMOKE_USER_DATA: userData,
          SI_WORLD_TEST_RENDERER: rendererKind,
        },
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      let stdout = '';
      let stderr = '';
      const append = (current: string, chunk: Buffer): string => `${current}${chunk.toString('utf8')}`.slice(-2_000_000);
      child.stdout.on('data', (chunk: Buffer) => { stdout = append(stdout, chunk); });
      child.stderr.on('data', (chunk: Buffer) => { stderr = append(stderr, chunk); });
      const timeout = setTimeout(() => child.kill('SIGKILL'), 180_000);
      child.once('error', (error) => {
        clearTimeout(timeout);
        rejectPass(error);
      });
      child.once('close', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          rejectPass(new Error(`Renderer parity ${rendererKind} exited with ${String(code)}. ${stderr.slice(-5_000)} ${stdout.slice(-5_000)}`));
          return;
        }
        const prefix = 'SI_WORLD_RENDERER_PARITY_SMOKE_RESULT ';
        const line = stdout.split(/\r?\n/u).find((candidate) => candidate.startsWith(prefix));
        if (!line) {
          rejectPass(new Error(`Renderer parity ${rendererKind} emitted no result.`));
          return;
        }
        try {
          const pass = PassSchema.parse(JSON.parse(line.slice(prefix.length)) as unknown);
          if (pass.rendererKind !== rendererKind) throw new Error(`Renderer parity returned ${pass.rendererKind} for ${rendererKind}.`);
          resolvePass(pass);
        } catch (error) {
          rejectPass(error);
        }
      });
    });
  } finally {
    rmSync(userData, { force: true, recursive: true });
  }
}

const skia = await run('skia');
const three = await run('threejs-2d');
const fixtureIds = FixtureIdSchema.options;
if (JSON.stringify(skia.fixtures.map(({ id }) => id).sort()) !== JSON.stringify([...fixtureIds].sort()) ||
    JSON.stringify(three.fixtures.map(({ id }) => id).sort()) !== JSON.stringify([...fixtureIds].sort())) {
  throw new Error('Renderer parity did not capture the complete six-fixture set.');
}
for (const id of fixtureIds) {
  const baseline = skia.fixtures.find((fixture) => fixture.id === id)!;
  const candidate = three.fixtures.find((fixture) => fixture.id === id)!;
  if (JSON.stringify(baseline.state) !== JSON.stringify(candidate.state)) {
    throw new Error(`Renderer parity state changed between Skia and Three.js for ${id}.`);
  }
}
if (three.contextLifecycle?.supported !== true || three.contextLifecycle.restored !== true) {
  throw new Error('Three.js context lifecycle evidence did not pass.');
}

const report = {
  schemaVersion: 1,
  testedCommit: resolveTestedCommit(),
  evidenceSource: resolveEvidenceSource([
    'electron/main/index.ts',
    'scripts/electron/run-renderer-parity-package-smoke.ts',
    'src/render/ThreeWorldSurface.tsx',
    'src/render/WorldScene.tsx',
    'src/render/three/world-renderer.ts',
  ]),
  fixtureIds,
  passes: { skia, threejs2d: three },
};
writeFileSync(join(evidenceRoot, 'renderer-parity-package-report.json'), `${JSON.stringify(report, null, 2)}\n`, {
  encoding: 'utf8',
  flush: true,
});
process.stdout.write(`Renderer parity package smoke passed: ${evidenceRoot}\n`);
