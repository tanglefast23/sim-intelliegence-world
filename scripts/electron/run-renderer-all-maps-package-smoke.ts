import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { PNG } from 'pngjs';
import { z } from 'zod';

import { measureRgbDeltas } from '../qualification/compare-renderer-frames';

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
    geometries: z.number().int().nonnegative().max(17),
    programs: z.number().int().nonnegative().max(3),
    textures: z.number().int().nonnegative().max(2),
  }).strict(),
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

// Stage 3 amendment 2026-08-15: the approved native and scaled RGB metrics for zoom crops.
const SCALED_LARGE_CHANNEL_DELTA = 32;
const NATIVE_ZOOM_LIMITS = Object.freeze({
  meanAbsoluteChannelDelta: 1,
  rootMeanSquareChannelDelta: 3,
  largeChangedPixelRatio: 0.002,
});
const SCALED_ZOOM_LIMITS = Object.freeze({
  meanAbsoluteChannelDelta: 10,
  rootMeanSquareChannelDelta: 20,
  largeChangedPixelRatio: 0.12,
});

const outputRoot = process.env.SI_WORLD_PACKAGE_OUTPUT_ROOT
  ? resolve(process.cwd(), process.env.SI_WORLD_PACKAGE_OUTPUT_ROOT)
  : join(process.cwd(), 'out');
const evidenceRoot = resolveEvidenceOutputRoot(process.argv.slice(2), {
  defaultRelative: 'output/verification/threejs-2d/stage-3/all-maps-package',
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
  const collect = async (rendererKind: 'skia' | 'threejs-2d'): Promise<Readonly<{
    fixtures: ReturnType<typeof ordered>;
    zoomSampling: z.infer<typeof ZoomSamplingSchema> | null;
  }>> => {
    const passes: Pass[] = [];
    // Stage 3 amendment 2026-08-15: launch only the DPR and VFX-mode combinations locked cases need.
    for (const { devicePixelRatio, vfxMode } of ALL_MAP_PARITY_COMBINATIONS) {
      passes.push(await run(rendererKind, devicePixelRatio, vfxMode));
    }
    return {
      fixtures: ordered(passes),
      zoomSampling: passes.find(({ zoomSampling }) => zoomSampling !== null)?.zoomSampling ?? null,
    };
  };
  const skiaPass = await collect('skia');
  const threePass = await collect('threejs-2d');
  const skia = skiaPass.fixtures;
  const three = threePass.fixtures;
  const expected = ALL_MAP_PARITY_CASES.map(({ id }) => id);
  if (JSON.stringify(skia.map(({ id }) => id)) !== JSON.stringify(expected) ||
      JSON.stringify(three.map(({ id }) => id)) !== JSON.stringify(expected)) {
    throw new Error('All-map renderer smoke did not capture the complete locked case set.');
  }
  for (const entry of ALL_MAP_PARITY_CASES) {
    const baseline = skia.find(({ id }) => id === entry.id)!;
    const candidate = three.find(({ id }) => id === entry.id)!;
    if (JSON.stringify(baseline.state) !== JSON.stringify(candidate.state)) {
      throw new Error(`All-map renderer state changed between Skia and Three.js for ${entry.id}.`);
    }
    if (baseline.state.mapId !== entry.mapId || !baseline.state.visibleEffectIds.includes(entry.effectId)) {
      throw new Error(`All-map renderer fixture ${entry.id} did not reach its locked map and effect.`);
    }
    // Stage 3 amendment 2026-08-15: the circle case must actually drive the fallback batch.
    // Assert both renderers; the Three.js candidate is the one this case exists to prove.
    if (entry.vfxMode === 'circle' && (
      !baseline.state.fallbackEffectIds.includes(entry.effectId) ||
      !candidate.state.fallbackEffectIds.includes(entry.effectId)
    )) {
      throw new Error(`All-map renderer fixture ${entry.id} did not render ${entry.effectId} as a fallback circle.`);
    }
    if (baseline.rendererEvidence !== null || candidate.rendererEvidence === null) {
      throw new Error(`All-map renderer evidence ownership is invalid for ${entry.id}.`);
    }
  }
  // Stage 3 amendment 2026-08-15: both renderers now own zoom evidence so the crops can be paired.
  if (skiaPass.zoomSampling === null || threePass.zoomSampling === null) {
    throw new Error('Both packaged DPR 1 procedural passes must own zoom-sampling evidence.');
  }
  const expectedZooms = Array.from({ length: 41 }, (_, index) => Math.round((1 + index * 0.05) * 100) / 100);
  if (JSON.stringify(threePass.zoomSampling.samples.map(({ zoom }) => zoom)) !== JSON.stringify(expectedZooms) ||
      JSON.stringify(skiaPass.zoomSampling.samples.map(({ zoom }) => zoom)) !== JSON.stringify(expectedZooms) ||
      threePass.zoomSampling.samples.some(({ zoom, inputStep, presentedZoom }) => (
        zoom !== presentedZoom || inputStep !== Number.isInteger(zoom * 10)
      ))) {
    throw new Error('Packaged zoom sampling did not cover every saved boundary exactly.');
  }
  if (JSON.stringify(skiaPass.zoomSampling.crop) !== JSON.stringify(threePass.zoomSampling.crop)) {
    throw new Error('Zoom-sampling crop geometry differed between renderers.');
  }

  // Measure the paired crops with the comparator's own RGB helper, never a second implementation.
  const zoomDirectory = (rendererKind: 'skia' | 'threejs-2d'): string => join(
    evidenceRoot, rendererKind, 'dpr-1-procedural', 'zoom',
  );
  const zoomMeasurements = threePass.zoomSampling.samples.map((sample, index) => {
    const baselineSample = skiaPass.zoomSampling!.samples[index]!;
    const baseline = PNG.sync.read(readFileSync(join(zoomDirectory('skia'), baselineSample.crop)));
    const candidate = PNG.sync.read(readFileSync(join(zoomDirectory('threejs-2d'), sample.crop)));
    if (baseline.width !== candidate.width || baseline.height !== candidate.height) {
      throw new Error(`Zoom ${sample.zoom} crops have different dimensions.`);
    }
    const total = baseline.width * baseline.height;
    const measurement = measureRgbDeltas(
      baseline,
      candidate,
      (function* pixels() { for (let pixel = 0; pixel < total; pixel += 1) yield pixel; })(),
      SCALED_LARGE_CHANNEL_DELTA,
    );
    // Zoom 1 at DPR 1 is a native raster comparison; every other saved zoom is scaled.
    const limits = sample.zoom === 1 ? NATIVE_ZOOM_LIMITS : SCALED_ZOOM_LIMITS;
    const failures: string[] = [];
    if (measurement.meanAbsoluteChannelDelta > limits.meanAbsoluteChannelDelta) {
      failures.push(`mean absolute channel delta ${measurement.meanAbsoluteChannelDelta} exceeds ${limits.meanAbsoluteChannelDelta}`);
    }
    if (measurement.rootMeanSquareChannelDelta > limits.rootMeanSquareChannelDelta) {
      failures.push(`root mean square channel delta ${measurement.rootMeanSquareChannelDelta} exceeds ${limits.rootMeanSquareChannelDelta}`);
    }
    if (measurement.largeChangedPixelRatio > limits.largeChangedPixelRatio) {
      failures.push(`large changed-pixel ratio ${measurement.largeChangedPixelRatio} exceeds ${limits.largeChangedPixelRatio}`);
    }
    return {
      zoom: sample.zoom,
      inputStep: sample.inputStep,
      savedBoundary: sample.savedBoundary,
      rasterComparison: sample.zoom === 1 ? 'native' : 'scaled',
      presentedZoom: sample.presentedZoom,
      atlasSampling: sample.atlasSampling,
      measurement,
      failures,
    };
  });
  const zoomFailures = zoomMeasurements.flatMap(({ zoom, failures }) => (
    failures.map((failure) => `Zoom ${zoom}: ${failure}`)
  ));
  if (zoomFailures.length > 0) {
    throw new Error(`Packaged zoom crops failed their measured comparison. ${zoomFailures.join(' ')}`);
  }

  const report = {
    schemaVersion: 1,
    testedCommit: resolveTestedCommit(),
    evidenceSource: resolveEvidenceSource([
      'electron/main/index.ts',
      'scripts/electron/run-renderer-all-maps-package-smoke.ts',
      'src/render/ThreeWorldSurface.tsx',
      'src/render/WorldScene.tsx',
      'src/render/three/all-map-parity.ts',
      'src/render/three/world-renderer.ts',
      'src/render/world-frame.ts',
    ]),
    caseIds: expected,
    passes: { skia: { fixtures: skia }, threejs2d: { fixtures: three } },
  };
  writeFileSync(join(evidenceRoot, 'renderer-all-maps-package-report.json'), `${JSON.stringify(report, null, 2)}\n`, {
    encoding: 'utf8',
    flush: true,
  });
  writeFileSync(join(evidenceRoot, 'zoom-sampling.json'), `${JSON.stringify({
    schemaVersion: 1,
    testedCommit: report.testedCommit,
    evidenceSource: report.evidenceSource,
    crop: threePass.zoomSampling.crop,
    rendererKinds: ['skia', 'threejs-2d'],
    nativeLimits: NATIVE_ZOOM_LIMITS,
    scaledLimits: SCALED_ZOOM_LIMITS,
    passed: true,
    samples: zoomMeasurements,
  }, null, 2)}\n`, { encoding: 'utf8', flush: true });
  process.stdout.write(`All-map renderer package smoke passed: ${evidenceRoot}\n`);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
