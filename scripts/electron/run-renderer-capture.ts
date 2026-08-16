import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { z } from 'zod';


import {
  ALL_MAP_PARITY_CASES,
  ALL_MAP_PARITY_COMBINATIONS,
  type AllMapParityVfxMode,
} from '../../src/render/three/all-map-parity';
import { resolveEvidenceSource } from '../qualification/evidence-source';
import { resolveTestedCommit } from '../qualification/tested-commit';
import { resolveEvidenceOutputRoot } from '../verification/evidence-output';
import { findPackagedExecutable } from './package-smoke-utils';

const RendererEvidenceSchema = z.object({
  rendererKind: z.literal('threejs-2d'),
  toneMapping: z.literal('none'),
  explicitSort: z.literal(true),
  drawCalls: z.number().int().nonnegative().max(24),
  atlasDrawCalls: z.number().int().nonnegative().max(12),
  gpu: z.object({
    drawCalls: z.number().int().nonnegative().max(24),
    // Two batches were added since this cap was written: sprite-shadows and lamp-glow.
    geometries: z.number().int().nonnegative().max(19),
    // The additive material omits the tone-mapping include, so it compiles its own program.
    programs: z.number().int().nonnegative().max(4),
    textures: z.number().int().nonnegative().max(2),
  }).strict(),
  trianglesByBatch: z.record(z.string(), z.number().int().nonnegative()),
}).passthrough();
const AtlasSamplingSchema = z.object({
  magFilter: z.literal('nearest'),
  minFilter: z.literal('nearest'),
  generateMipmaps: z.literal(false),
  anisotropy: z.literal(1),
  wrapS: z.literal('clamp-to-edge'),
  wrapT: z.literal('clamp-to-edge'),
}).strict();
const ZoomSamplingSchema = z.object({
  schemaVersion: z.literal(1),
  crop: z.object({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }).strict(),
  samples: z.array(z.object({
    zoom: z.number().min(1).max(3).multipleOf(0.05),
    inputStep: z.boolean(),
    savedBoundary: z.literal(true),
    crop: z.string().min(1),
    // Only the Three.js pass records live texture and presentation evidence.
    presentedZoom: z.number().min(1).max(3).multipleOf(0.05).optional(),
    atlasSampling: AtlasSamplingSchema.optional(),
  }).strict()).length(41),
}).strict();
const StateSchema = z.object({
  mapId: z.string().min(1),
  mapHash: z.string().min(1),
  presentationHash: z.string().min(1),
  atlasHash: z.string().min(1),
  camera: z.object({ x: z.number(), y: z.number(), zoom: z.union([z.literal(1), z.literal(2), z.literal(3)]) }).strict(),
  viewport: z.object({ width: z.number().positive(), height: z.number().positive() }).strict(),
  devicePixelRatio: z.union([z.literal(1), z.literal(1.25), z.literal(1.5), z.literal(2)]),
  characters: z.array(z.object({
    id: z.string().min(1),
    sprite: z.string().min(1),
    worldX: z.number(),
    worldY: z.number(),
    source: z.object({ x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive() }).passthrough(),
  }).passthrough()),
  visibleEffectIds: z.array(z.string()),
  fallbackEmitterIds: z.array(z.string()),
  fallbackEffectIds: z.array(z.string()),
}).passthrough();
const FixtureSchema = z.object({
  devicePixelRatio: z.union([z.literal(1), z.literal(1.25), z.literal(1.5), z.literal(2)]),
  effectId: z.string().min(1),
  id: z.string().min(1),
  mapId: z.string().min(1),
  viewport: z.object({ width: z.number().positive(), height: z.number().positive() }).strict(),
  vfxMode: z.enum(['procedural', 'circle']),
  zoom: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  screenshot: z.string().min(1),
  state: StateSchema,
  rendererEvidence: RendererEvidenceSchema.nullable(),
}).strict();
const PassSchema = z.object({
  schemaVersion: z.literal(1),
  rendererKind: z.enum(['skia', 'threejs-2d']),
  devicePixelRatio: z.union([z.literal(1), z.literal(1.25), z.literal(1.5), z.literal(2)]),
  vfxMode: z.enum(['procedural', 'circle']),
  fixtures: z.array(FixtureSchema).min(1),
  zoomSampling: ZoomSamplingSchema.nullable(),
}).strict();
type Pass = z.infer<typeof PassSchema>;

const MINIMUM_FALLBACK_TRIANGLES_PER_EFFECT = 32;

/**
 * The comparator requires every capture to be `round(viewport x devicePixelRatio)`.
 *
 * That still holds after handoff technique 1 made the drawing buffer an integer multiple of the
 * viewport, but only because these captures come from `webContents.capturePage`, which reads the
 * COMPOSITED WINDOW at device scale — including the CSS upscale — rather than the drawing buffer.
 *
 * Do not "improve" this to read the canvas buffer, and do not relax the comparator's dimension
 * check to match one. Either would break every fractional-DPR fixture with a hard throw.
 */
const outputRoot = process.env.SI_WORLD_PACKAGE_OUTPUT_ROOT
  ? resolve(process.cwd(), process.env.SI_WORLD_PACKAGE_OUTPUT_ROOT)
  : join(process.cwd(), 'out');
const evidenceRoot = resolveEvidenceOutputRoot(process.argv.slice(2), {
  defaultRelative: 'output/verification/visual-polish/capture',
});
const executable = findPackagedExecutable(outputRoot);
mkdirSync(evidenceRoot, { recursive: true });

async function run(
  rendererKind: 'skia' | 'threejs-2d',
  devicePixelRatio: 1 | 1.25 | 1.5 | 2,
  vfxMode: AllMapParityVfxMode,
): Promise<Pass> {
  const userData = mkdtempSync(join(tmpdir(), `si-world-all-maps-${rendererKind}-${devicePixelRatio}-${vfxMode}-`));
  const screenshotDirectory = join(evidenceRoot, rendererKind, `dpr-${devicePixelRatio}-${vfxMode}`);
  rmSync(screenshotDirectory, { force: true, recursive: true });
  mkdirSync(screenshotDirectory, { recursive: true });
  try {
    return await new Promise((resolvePass, rejectPass) => {
      const child = spawn(executable, [
        `--force-device-scale-factor=${devicePixelRatio}`,
        '--force-prefers-reduced-motion',
      ], {
        env: {
          ...process.env,
          SI_WORLD_RENDERER_ALL_MAPS_SMOKE: '1',
          SI_WORLD_RENDERER_PARITY_SCREENSHOT_DIR: screenshotDirectory,
          SI_WORLD_SMOKE: '1',
          SI_WORLD_SMOKE_USER_DATA: userData,
          SI_WORLD_TEST_RENDERER: rendererKind,
          // The locked manifests are no-tone parity captures, so the capture must force the same
          // override. Production runs ACES; comparing an ACES capture against a no-tone manifest
          // would measure the tone curve rather than the change under test.
          SI_WORLD_TEST_TONE_MAPPING: 'none',
          SI_WORLD_VFX_MODE: vfxMode,
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
      const timeout = setTimeout(() => child.kill('SIGKILL'), 300_000);
      child.once('error', (error) => {
        clearTimeout(timeout);
        rejectPass(error);
      });
      child.once('close', (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          rejectPass(new Error(`All-map renderer ${rendererKind} DPR ${devicePixelRatio} ${vfxMode} exited with ${String(code)}. ${stderr.slice(-5_000)} ${stdout.slice(-5_000)}`));
          return;
        }
        const prefix = 'SI_WORLD_RENDERER_ALL_MAPS_SMOKE_RESULT ';
        const line = stdout.split(/\r?\n/u).find((candidate) => candidate.startsWith(prefix));
        if (!line) {
          rejectPass(new Error(`All-map renderer ${rendererKind} DPR ${devicePixelRatio} ${vfxMode} emitted no result.`));
          return;
        }
        try {
          const pass = PassSchema.parse(JSON.parse(line.slice(prefix.length)) as unknown);
          if (pass.rendererKind !== rendererKind || pass.devicePixelRatio !== devicePixelRatio ||
              pass.vfxMode !== vfxMode) {
            throw new Error(`All-map renderer returned ${pass.rendererKind} DPR ${pass.devicePixelRatio} ${pass.vfxMode}.`);
          }
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

const caseOrder = new Map(ALL_MAP_PARITY_CASES.map((entry, index) => [entry.id, index]));
const ordered = (passes: readonly Pass[]) => passes
  .flatMap(({ fixtures }) => fixtures)
  .sort((left, right) => caseOrder.get(left.id)! - caseOrder.get(right.id)!);

async function main(): Promise<void> {
  const passes: Pass[] = [];
  // One packaged window per locked DPR and VFX-mode combination, hidden and game-muted.
  for (const { devicePixelRatio, vfxMode } of ALL_MAP_PARITY_COMBINATIONS) {
    passes.push(await run('threejs-2d', devicePixelRatio, vfxMode));
  }
  const three = ordered(passes);
  const expected = ALL_MAP_PARITY_CASES.map(({ id }) => id);
  if (JSON.stringify(three.map(({ id }) => id)) !== JSON.stringify(expected)) {
    throw new Error('Capture did not reach the complete locked case set.');
  }

  for (const entry of ALL_MAP_PARITY_CASES) {
    const candidate = three.find(({ id }) => id === entry.id)!;
    if (candidate.state.mapId !== entry.mapId || !candidate.state.visibleEffectIds.includes(entry.effectId)) {
      throw new Error(`Capture ${entry.id} did not reach its locked map and effect.`);
    }
    if (candidate.rendererEvidence === null) {
      throw new Error(`Capture ${entry.id} produced no renderer evidence.`);
    }
    if (entry.vfxMode === 'circle') {
      const triangles = candidate.rendererEvidence.trianglesByBatch.effects ?? 0;
      const minimum = MINIMUM_FALLBACK_TRIANGLES_PER_EFFECT * candidate.state.fallbackEffectIds.length;
      if (triangles < minimum) {
        throw new Error(`Capture ${entry.id} drew ${triangles} effect triangles, below ${minimum}.`);
      }
    }
  }

  const report = {
    schemaVersion: 1,
    testedCommit: resolveTestedCommit(),
    evidenceSource: resolveEvidenceSource([
      'electron/main/index.ts',
      'scripts/electron/run-renderer-capture.ts',
      'src/render/ThreeWorldSurface.tsx',
      'src/render/WorldScene.tsx',
      'src/render/three/all-map-parity.ts',
      'src/render/three/coordinate-contract.ts',
      'src/render/three/world-renderer.ts',
      'src/render/world-frame.ts',
    ]),
    caseIds: expected,
    passes: { threejs2d: { fixtures: three } },
  };
  writeFileSync(join(evidenceRoot, 'renderer-capture-report.json'), `${JSON.stringify(report, null, 2)}\n`, {
    encoding: 'utf8',
    flush: true,
  });
  process.stdout.write(`Renderer capture passed: ${evidenceRoot}\n`);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
