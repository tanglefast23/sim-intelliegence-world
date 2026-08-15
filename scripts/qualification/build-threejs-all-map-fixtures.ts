import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { PNG } from 'pngjs';

import { ALL_MAP_PARITY_CASES } from '../../src/render/three/all-map-parity';

const REPORT = 'output/verification/threejs-2d/stage-3/all-maps-package/renderer-all-maps-package-report.json';
const SPECIALIZED = 'tests/fixtures/rendering/threejs-stage-3-specialized-v1.json';
const CAPTURE_OUTPUT = 'artifacts/threejs-2d/stage-3/captures/all-maps';
const FIXTURE_OUTPUT = 'tests/fixtures/rendering/threejs-all-maps';
const THRESHOLDS = {
  backgroundRingLogicalPixels: 2,
  contrastRetention: 0.9,
  outsideMaskChangedPixelRatio: 0.005,
  outsideMaskMaximumChannelDelta: 2,
  requiredMaskMaximumChannelDelta: 8,
  scaledMeanAbsoluteChannelDelta: 1,
  scaledRootMeanSquareChannelDelta: 3,
  scaledLargeChannelDelta: 32,
  scaledLargeChangedPixelRatio: 0.002,
} as const;

type Point = Readonly<{ x: number; y: number }>;
type Rect = Readonly<Point & { width: number; height: number }>;
type Placement = Readonly<{
  id: string;
  sprite: string;
  source: Rect;
  worldX: number;
  worldY: number;
}>;
type FrameState = Readonly<{
  mapId: string;
  mapHash: string;
  presentationHash: string;
  atlasHash: string;
  camera: Readonly<Point & { zoom: number }>;
  viewport: Readonly<{ width: number; height: number }>;
  devicePixelRatio: number;
  characters: readonly Placement[];
  visibleEffectIds: readonly string[];
  fallbackEmitterIds: readonly string[];
}>;
type RendererEvidence = Readonly<{
  drawCalls: number;
  atlasDrawCalls: number;
  gpu: Readonly<{ drawCalls: number; geometries: number; programs: number; textures: number }>;
}>;
type Fixture = Readonly<{
  devicePixelRatio: 1 | 1.25 | 1.5 | 2;
  effectId: string;
  id: string;
  mapId: string;
  rendererEvidence: RendererEvidence | null;
  screenshot: string;
  state: FrameState;
  viewport: Readonly<{ width: number; height: number }>;
  vfxMode: 'procedural' | 'circle';
  zoom: 1 | 2 | 3;
}>;
type Report = Readonly<{
  testedCommit: string;
  caseIds: readonly string[];
  passes: Readonly<{
    skia: Readonly<{ fixtures: readonly Fixture[] }>;
    threejs2d: Readonly<{ fixtures: readonly Fixture[] }>;
  }>;
}>;
type FixtureSet = Readonly<{
  sourceCommit: string;
  fixtures: readonly Readonly<{ id: string; manifest: string }>[];
}>;

const json = <Value>(path: string): Value => JSON.parse(readFileSync(resolve(path), 'utf8')) as Value;
const writeJson = (path: string, value: unknown): void => {
  const output = resolve(path);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(value, null, 2)}\n`);
};
const integerRect = (x: number, y: number, width: number, height: number): Rect => ({
  x: Math.round(x),
  y: Math.round(y),
  width: Math.round(width),
  height: Math.round(height),
});

const report = json<Report>(REPORT);
const specialized = json<FixtureSet>(SPECIALIZED);
if (specialized.sourceCommit !== report.testedCommit) {
  throw new Error('Stage 3 specialized and all-map fixtures must use the same tested commit.');
}
if (JSON.stringify(report.caseIds) !== JSON.stringify(ALL_MAP_PARITY_CASES.map(({ id }) => id))) {
  throw new Error('The packaged all-map report does not match the locked matrix.');
}

const atlas = PNG.sync.read(readFileSync(resolve('assets/generated/world-atlas.png')));
const atlasOpaque = (source: Rect, x: number, y: number): boolean => (
  x >= 0 && y >= 0 && x < source.width && y < source.height &&
  atlas.data[((source.y + y) * atlas.width + source.x + x) * 4 + 3] !== 0
);
const playerFootprint = (source: Rect, zoom: number, silhouetteOnly: boolean): string[] => Array.from(
  { length: source.height * zoom },
  (_, y) => Array.from({ length: source.width * zoom }, (_, x) => {
    const sourceX = Math.floor(x / zoom);
    const sourceY = Math.floor(y / zoom);
    if (!atlasOpaque(source, sourceX, sourceY)) return '0';
    if (!silhouetteOnly) return '1';
    return [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => (
      !atlasOpaque(source, sourceX + dx!, sourceY + dy!)
    )) ? '1' : '0';
  }).join(''),
);
const sourceCapture = (rendererKind: 'skia' | 'threejs-2d', fixture: Fixture): string => resolve(
  dirname(REPORT),
  rendererKind,
  // Stage 3 amendment 2026-08-15: one capture directory per DPR and VFX mode.
  `dpr-${fixture.devicePixelRatio}-${fixture.vfxMode}`,
  fixture.screenshot,
);

mkdirSync(resolve(CAPTURE_OUTPUT), { recursive: true });
for (const [rendererKind, pass] of [
  ['skia', report.passes.skia],
  ['threejs-2d', report.passes.threejs2d],
] as const) {
  for (const fixture of pass.fixtures) {
    copyFileSync(sourceCapture(rendererKind, fixture), resolve(CAPTURE_OUTPUT, fixture.screenshot));
  }
}
copyFileSync(resolve(REPORT), resolve('artifacts/threejs-2d/stage-3/renderer-all-maps-package-report.json'));
copyFileSync(resolve(dirname(REPORT), 'zoom-sampling.json'), resolve('artifacts/threejs-2d/stage-3/zoom-sampling.json'));

const fixtureEntries = report.caseIds.map((id) => {
  const baseline = report.passes.skia.fixtures.find((fixture) => fixture.id === id);
  const candidate = report.passes.threejs2d.fixtures.find((fixture) => fixture.id === id);
  if (!baseline || !candidate || JSON.stringify(baseline.state) !== JSON.stringify(candidate.state)) {
    throw new Error(`Missing or mismatched all-map fixture ${id}.`);
  }
  const player = baseline.state.characters.find((character) => character.id === 'protagonist');
  if (!player) throw new Error(`All-map fixture ${id} is missing the protagonist.`);
  const capture = PNG.sync.read(readFileSync(sourceCapture('skia', baseline)));
  const logicalWidth = capture.width / baseline.devicePixelRatio;
  const logicalHeight = capture.height / baseline.devicePixelRatio;
  if (!Number.isInteger(logicalWidth) || !Number.isInteger(logicalHeight)) {
    throw new Error(`All-map fixture ${id} has fractional logical capture bounds.`);
  }
  const offset = {
    x: (logicalWidth - baseline.state.viewport.width) / 2,
    y: (logicalHeight - baseline.state.viewport.height) / 2,
  };
  const topLeft = {
    x: offset.x + (player.worldX - baseline.state.camera.x) * baseline.zoom,
    y: offset.y + (player.worldY - baseline.state.camera.y) * baseline.zoom,
  };
  const logicalBounds = integerRect(
    topLeft.x,
    topLeft.y,
    player.source.width * baseline.zoom,
    player.source.height * baseline.zoom,
  );
  const mask = {
    id: `player-protagonist-${id}`,
    kind: 'player',
    frameId: `${player.sprite}:${baseline.zoom}`,
    logicalBounds,
    hitBounds: integerRect(
      logicalBounds.x - 4 * baseline.zoom,
      logicalBounds.y - 2 * baseline.zoom,
      32 * baseline.zoom,
      32 * baseline.zoom,
    ),
    alphaFootprint: playerFootprint(
      player.source,
      baseline.zoom,
      baseline.devicePixelRatio === 1 && baseline.zoom === 1,
    ),
  };
  const maskPath = `${FIXTURE_OUTPUT}/${id}-mask-v1.json`;
  const manifestPath = `${FIXTURE_OUTPUT}/${id}-v1.json`;
  writeJson(maskPath, { schemaVersion: 1, masks: [mask] });
  writeJson(manifestPath, {
    schemaVersion: 1,
    fixture: id,
    sourceCommit: report.testedCommit,
    mode: 'parity',
    viewport: { width: logicalWidth, height: logicalHeight },
    devicePixelRatio: baseline.devicePixelRatio,
    zoom: baseline.zoom,
    camera: { x: baseline.state.camera.x, y: baseline.state.camera.y },
    toneMapping: 'none',
    exposure: 1,
    baseline: { image: `${CAPTURE_OUTPUT}/${baseline.screenshot}`, masks: maskPath },
    candidate: { image: `${CAPTURE_OUTPUT}/${candidate.screenshot}`, masks: maskPath },
    requiredMaskIds: [mask.id],
    lightSamples: [],
    shadowSamples: [],
    thresholds: THRESHOLDS,
  });
  return { id, manifest: manifestPath };
});

writeJson('tests/fixtures/rendering/threejs-all-maps-v1.json', {
  schemaVersion: 1,
  fixtureSet: 'threejs-all-maps-stage-3',
  sourceCommit: report.testedCommit,
  mode: 'parity',
  fixtures: [...specialized.fixtures, ...fixtureEntries],
});

const rendererEvidence = report.passes.threejs2d.fixtures.map(({ rendererEvidence: evidence }) => evidence!);
const maximum = (select: (evidence: RendererEvidence) => number): number => Math.max(...rendererEvidence.map(select));
writeJson('artifacts/threejs-2d/stage-3/all-map-matrix.json', {
  schemaVersion: 1,
  testedCommit: report.testedCommit,
  cases: ALL_MAP_PARITY_CASES,
  coverage: {
    sampledTuples: ALL_MAP_PARITY_CASES.map(({ id: caseId, mapId, viewport, devicePixelRatio, zoom }) => ({
      id: caseId,
      mapId,
      viewport,
      devicePixelRatio,
      zoom,
    })),
    maximumLoadCaseId: 'maximum-load-2560x1440-dpr2-zoom1',
    specializedFixtures: specialized.fixtures.map(({ id: fixtureId }) => fixtureId),
  },
  maximumResources: {
    drawCalls: maximum(({ drawCalls }) => drawCalls),
    atlasDrawCalls: maximum(({ atlasDrawCalls }) => atlasDrawCalls),
    gpuDrawCalls: maximum(({ gpu }) => gpu.drawCalls),
    gpuTextures: maximum(({ gpu }) => gpu.textures),
    gpuPrograms: maximum(({ gpu }) => gpu.programs),
    gpuGeometries: maximum(({ gpu }) => gpu.geometries),
  },
});

process.stdout.write(`Wrote ${fixtureEntries.length} all-map fixtures for ${report.testedCommit}.\n`);
