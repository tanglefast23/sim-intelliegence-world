import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { PNG } from 'pngjs';

const stageIndex = process.argv.indexOf('--stage');
const stageArgument = stageIndex === -1 ? '2' : process.argv[stageIndex + 1];
if (stageArgument !== '2' && stageArgument !== '3' && stageArgument !== '4') throw new Error('--stage must be 2, 3 or 4.');
const stage = Number(stageArgument);
const REPORT = stage === 2
  ? 'output/verification/threejs-2d/stage-2/parity-package/renderer-parity-package-report.json'
  : `output/verification/threejs-2d/stage-${stage}/specialized-package/renderer-parity-package-report.json`;
const CAPTURE_OUTPUT = stage === 2
  ? 'artifacts/threejs-2d/stage-2/captures'
  : `artifacts/threejs-2d/stage-${stage}/captures/specialized`;
const FIXTURE_OUTPUT = stage === 2
  ? 'tests/fixtures/rendering/threejs-villa'
  : 'tests/fixtures/rendering/threejs-stage-3-specialized';
// Stage 4 reuses the Stage 3 specialized fixture paths; only its evidence source differs.
const FIXTURE_SET_OUTPUT = stage === 2
  ? 'tests/fixtures/rendering/threejs-villa-v1.json'
  : 'tests/fixtures/rendering/threejs-stage-3-specialized-v1.json';
const THRESHOLDS = {
  backgroundRingLogicalPixels: 2,
  contrastRetention: 0.9,
  outsideMaskChangedPixelRatio: 0.005,
  outsideMaskMaximumChannelDelta: 2,
  requiredMaskMaximumChannelDelta: 8,
} as const;

type Point = Readonly<{ x: number; y: number }>;
type Rect = Readonly<Point & { width: number; height: number }>;
type Placement = Readonly<{
  id: string;
  sprite: string;
  worldX: number;
  worldY: number;
  source: Rect;
}>;
type FrameState = Readonly<{
  camera: Readonly<Point & { zoom: number }>;
  viewport: Readonly<{ width: number; height: number }>;
  devicePixelRatio: number;
  characters: readonly Placement[];
  doors: readonly Placement[];
  doorPhases: Readonly<Record<string, string>>;
  movement: Readonly<{ direction: string; status: string; walkFrame: number }>;
  selectionRing: Readonly<Point & { id: string; worldX: number; worldY: number; radiusX: number; radiusY: number; strokeWidth: number }>;
  destinationPulse: null | Readonly<{ id: string; worldX: number; worldY: number; radius: number }>;
  journalMarkers: readonly Readonly<{ journalEntryId: string; tile: Point }>[];
  failureMarker: null | Readonly<{ id: string; worldX: number; worldY: number; radiusPixels: number }>;
}>;
type Fixture = Readonly<{ id: string; screenshot: string; state: FrameState }>;
type Pass = Readonly<{ rendererKind: 'skia' | 'threejs-2d'; fixtures: readonly Fixture[] }>;
type Report = Readonly<{
  testedCommit: string;
  fixtureIds: readonly string[];
  passes: Readonly<{ skia: Pass; threejs2d: Pass }>;
}>;
type MaskKind = 'player' | 'npc' | 'active-door' | 'route' | 'selection' | 'destination' | 'journal' | 'failure';
type Mask = Readonly<{
  id: string;
  kind: MaskKind;
  frameId: string;
  logicalBounds: Rect;
  hitBounds: Rect;
  alphaFootprint: readonly string[];
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
const distanceToSegment = (point: Point, start: Point, end: Point): number => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (
    (point.x - start.x) * dx + (point.y - start.y) * dy
  ) / lengthSquared));
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
};
const raster = (bounds: Rect, visible: (point: Point) => boolean): string[] => Array.from(
  { length: bounds.height },
  (_, y) => Array.from({ length: bounds.width }, (_, x) => (
    visible({ x: bounds.x + x + 0.5, y: bounds.y + y + 0.5 }) ? '1' : '0'
  )).join(''),
);

const report = json<Report>(REPORT);
const passes = Object.values(report.passes);
const skia = report.passes.skia;
const three = report.passes.threejs2d;
if (skia.rendererKind !== 'skia' || three.rendererKind !== 'threejs-2d') {
  throw new Error('Renderer parity report must contain Skia and Three.js passes.');
}

const atlas = PNG.sync.read(readFileSync(resolve('assets/generated/world-atlas.png')));
const fixture = (id: string): Fixture => {
  const baseline = skia.fixtures.find((candidate) => candidate.id === id);
  const candidate = three.fixtures.find((entry) => entry.id === id);
  if (!baseline || !candidate) throw new Error(`Missing renderer fixture ${id}.`);
  if (JSON.stringify(baseline.state) !== JSON.stringify(candidate.state)) {
    throw new Error(`Renderer state changed for ${id}.`);
  }
  return baseline;
};
const captureSize = PNG.sync.read(readFileSync(resolve(
  dirname(REPORT),
  'skia',
  fixture(report.fixtureIds[0]!).screenshot,
)));
const screenOffset = (state: FrameState): Point => ({
  x: (captureSize.width - state.viewport.width) / 2,
  y: (captureSize.height - state.viewport.height) / 2,
});
const screen = (state: FrameState, world: Point): Point => {
  const offset = screenOffset(state);
  return {
    x: offset.x + (world.x - state.camera.x) * state.camera.zoom,
    y: offset.y + (world.y - state.camera.y) * state.camera.zoom,
  };
};
const atlasOpaque = (source: Rect, x: number, y: number): boolean => (
  x >= 0 && y >= 0 && x < source.width && y < source.height &&
  atlas.data[((source.y + y) * atlas.width + source.x + x) * 4 + 3] !== 0
);
const atlasFootprint = (source: Rect, silhouetteOnly = false): string[] => Array.from(
  { length: source.height },
  (_, y) => Array.from({ length: source.width }, (_, x) => {
    if (!atlasOpaque(source, x, y)) return '0';
    if (!silhouetteOnly) return '1';
    return [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => (
      !atlasOpaque(source, x + dx!, y + dy!)
    )) ? '1' : '0';
  }).join(''),
);
const placementMask = (state: FrameState, placement: Placement, kind: MaskKind, id: string): Mask => {
  const topLeft = screen(state, { x: placement.worldX, y: placement.worldY });
  const logicalBounds = integerRect(topLeft.x, topLeft.y, placement.source.width, placement.source.height);
  return {
    id,
    kind,
    frameId: placement.sprite,
    logicalBounds,
    hitBounds: kind === 'active-door'
      ? logicalBounds
      : integerRect(logicalBounds.x - 4, logicalBounds.y - 2, 32, 32),
    alphaFootprint: atlasFootprint(placement.source, kind === 'player' || kind === 'active-door'),
  };
};
const ellipseMask = (
  state: FrameState,
  kind: 'route' | 'selection' | 'destination',
  id: string,
  frameId: string,
  worldCenter: Point,
  radiusX: number,
  radiusY: number,
  strokeWidth: number,
  hitBounds: Rect,
): Mask => {
  const center = screen(state, worldCenter);
  const padding = Math.ceil(strokeWidth / 2);
  const logicalBounds = integerRect(
    center.x - radiusX - padding,
    center.y - radiusY - padding,
    radiusX * 2 + padding * 2,
    radiusY * 2 + padding * 2,
  );
  const footprintStrokeWidth = kind === 'selection' ? Math.max(1, strokeWidth - 1) : strokeWidth;
  const outerX = radiusX + footprintStrokeWidth / 2;
  const outerY = radiusY + footprintStrokeWidth / 2;
  const innerX = Math.max(0.5, radiusX - footprintStrokeWidth / 2);
  const innerY = Math.max(0.5, radiusY - footprintStrokeWidth / 2);
  return {
    id,
    kind,
    frameId,
    logicalBounds,
    hitBounds,
    alphaFootprint: raster(logicalBounds, (point) => {
      const dx = point.x - center.x;
      const dy = point.y - center.y;
      const outer = (dx / outerX) ** 2 + (dy / outerY) ** 2 <= 1;
      const inner = (dx / innerX) ** 2 + (dy / innerY) ** 2 < 1;
      return outer && !inner;
    }),
  };
};
const tileHitBounds = (state: FrameState, worldFoot: Point): Rect => {
  const foot = screen(state, worldFoot);
  return integerRect(foot.x - 16, foot.y - 32, 32, 32);
};
const pulseMask = (state: FrameState, kind: 'route' | 'destination'): Mask => {
  const pulse = state.destinationPulse;
  if (!pulse) throw new Error(`${kind} fixture is missing its pulse.`);
  const worldCenter = { x: pulse.worldX, y: pulse.worldY };
  return ellipseMask(
    state,
    kind,
    kind === 'route' ? 'route-destination-pulse' : pulse.id,
    kind === 'route'
      ? `route:${state.movement.status}:${state.movement.direction}:${state.movement.walkFrame}:${pulse.worldX},${pulse.worldY}`
      : `destination:${pulse.worldX},${pulse.worldY}:${pulse.radius}`,
    worldCenter,
    // Skia draws the ring at `radius * zoom` screen pixels with a `zoom` stroke.
    pulse.radius * state.camera.zoom,
    pulse.radius * state.camera.zoom,
    state.camera.zoom,
    tileHitBounds(state, worldCenter),
  );
};
const selectionMask = (state: FrameState): Mask => {
  const ring = state.selectionRing;
  const selected = state.characters.find(({ worldX, worldY }) => (
    worldX + 12 === ring.worldX && worldY + 27 === ring.worldY
  ));
  const selectedMask = selected ? placementMask(state, selected, 'npc', 'selection-hit') : undefined;
  const hit = selectedMask
    ? selectedMask.hitBounds
    : tileHitBounds(state, { x: ring.worldX, y: ring.worldY });
  const mask = ellipseMask(
    state,
    'selection',
    ring.id,
    `selection:${ring.worldX},${ring.worldY}:${ring.radiusX},${ring.radiusY}`,
    { x: ring.worldX, y: ring.worldY },
    ring.radiusX,
    ring.radiusY,
    ring.strokeWidth,
    hit,
  );
  if (!selected || !selectedMask) return mask;
  return {
    ...mask,
    alphaFootprint: mask.alphaFootprint.map((row, y) => Array.from(row, (pixel, x) => {
      const selectedX = mask.logicalBounds.x + x - selectedMask.logicalBounds.x;
      const selectedY = mask.logicalBounds.y + y - selectedMask.logicalBounds.y;
      return pixel === '1' && atlasOpaque(selected.source, selectedX, selectedY) ? '0' : pixel;
    }).join('')),
  };
};
const journalMask = (state: FrameState): Mask => {
  const marker = state.journalMarkers[0];
  if (!marker) throw new Error('Journal fixture is missing its marker.');
  // Skia scales every journal-pin offset and radius by zoom, so the mask does too.
  const zoom = state.camera.zoom;
  // Both renderers place the pin from tileFootPoint, which is +29, not the tile bottom at +32.
  const worldFoot = { x: marker.tile.x * 32 + 16, y: marker.tile.y * 32 + 29 };
  const foot = screen(state, worldFoot);
  const center = { x: foot.x - 10 * zoom, y: foot.y - 30 * zoom };
  const start = { x: center.x, y: center.y + 4 * zoom };
  const end = { x: foot.x - 4 * zoom, y: foot.y - 5 * zoom };
  const logicalBounds = integerRect(center.x - 8 * zoom, center.y - 8 * zoom, 17 * zoom, 36 * zoom);
  return {
    id: `journal-${marker.journalEntryId}`,
    kind: 'journal',
    frameId: `journal:${marker.journalEntryId}:${marker.tile.x},${marker.tile.y}`,
    logicalBounds,
    hitBounds: tileHitBounds(state, worldFoot),
    alphaFootprint: raster(logicalBounds, (point) => (
      Math.hypot(point.x - center.x, point.y - center.y) <= 7 * zoom ||
      distanceToSegment(point, start, end) <= 2 * zoom
    )),
  };
};
const failureMask = (state: FrameState): Mask => {
  const marker = state.failureMarker;
  if (!marker) throw new Error('Failure fixture is missing its marker.');
  const center = screen(state, { x: marker.worldX, y: marker.worldY });
  const radius = marker.radiusPixels;
  const logicalBounds = integerRect(center.x - radius - 2, center.y - radius - 2, radius * 2 + 4, radius * 2 + 4);
  return {
    id: marker.id,
    kind: 'failure',
    frameId: `failure:${marker.worldX},${marker.worldY}:${radius}`,
    logicalBounds,
    hitBounds: integerRect(center.x - 16, center.y - 16, 32, 32),
    alphaFootprint: raster(logicalBounds, (point) => (
      distanceToSegment(
        point,
        { x: center.x - radius, y: center.y - radius },
        { x: center.x + radius, y: center.y + radius },
      ) <= 1.5 || distanceToSegment(
        point,
        { x: center.x + radius, y: center.y - radius },
        { x: center.x - radius, y: center.y + radius },
      ) <= 1.5
    )),
  };
};

const masksFor = (entry: Fixture): readonly Mask[] => {
  const state = entry.state;
  if (entry.id === 'villa-exterior-idle') {
    const player = state.characters.find(({ id }) => id === 'protagonist');
    if (!player) throw new Error('Exterior fixture is missing the player.');
    return [placementMask(state, player, 'player', 'player-protagonist')];
  }
  if (entry.id === 'villa-interior-roof-hidden') {
    const npc = state.characters.find(({ id }) => id === 'generic_resident');
    if (!npc) throw new Error('Interior fixture is missing the NPC.');
    return [placementMask(state, npc, 'npc', 'npc-generic-resident')];
  }
  if (entry.id === 'villa-door-transition') {
    const door = state.doors.find(({ id }) => state.doorPhases[id] === 'opening');
    if (!door) throw new Error('Door fixture is missing the active door.');
    return [placementMask(state, door, 'active-door', `active-door-${door.id}`)];
  }
  if (entry.id === 'villa-walk-east-frame-1') return [pulseMask(state, 'route')];
  if (entry.id === 'villa-selected-npc') return [selectionMask(state)];
  if (entry.id.startsWith('villa-destination-journal-failure')) {
    return [pulseMask(state, 'destination'), journalMask(state), failureMask(state)];
  }
  throw new Error(`No mask contract for ${entry.id}.`);
};

mkdirSync(resolve(CAPTURE_OUTPUT), { recursive: true });
for (const pass of passes) {
  for (const entry of pass.fixtures) {
    copyFileSync(
      resolve(dirname(REPORT), pass.rendererKind, entry.screenshot),
      resolve(CAPTURE_OUTPUT, entry.screenshot),
    );
  }
}
copyFileSync(resolve(REPORT), resolve(`artifacts/threejs-2d/stage-${stage}/renderer-parity-specialized-package-report.json`));

const fixtureEntries = report.fixtureIds.map((id) => {
  const entry = fixture(id);
  const masks = masksFor(entry);
  const maskPath = `${FIXTURE_OUTPUT}/${id}-mask-v1.json`;
  const manifestPath = `${FIXTURE_OUTPUT}/${id}-v1.json`;
  writeJson(maskPath, { schemaVersion: 1, masks });
  const lightSamples = id === 'villa-interior-roof-hidden' ? [{
    id: 'villa-patio-fire-pool',
    lit: { ...screen(entry.state, { x: 878, y: 1_038 }), width: 4, height: 4 },
    unlit: { ...screen(entry.state, { x: 940, y: 1_038 }), width: 4, height: 4 },
  }] : [];
  const shadowSamples = id === 'villa-interior-roof-hidden' ? [{
    id: 'villa-patio-fire-shadow',
    direction: 'lower-right',
    edges: [{
      lit: screen(entry.state, { x: 876, y: 1_036 }),
      shadow: screen(entry.state, { x: 886, y: 1_045 }),
    }],
  }] : [];
  writeJson(manifestPath, {
    schemaVersion: 1,
    fixture: id,
    sourceCommit: report.testedCommit,
    mode: 'parity',
    viewport: { width: captureSize.width, height: captureSize.height },
    devicePixelRatio: entry.state.devicePixelRatio,
    zoom: entry.state.camera.zoom,
    camera: { x: entry.state.camera.x, y: entry.state.camera.y },
    toneMapping: 'none',
    exposure: 1,
    baseline: {
      image: `${CAPTURE_OUTPUT}/${id}-skia-1x.png`,
      masks: maskPath,
    },
    candidate: {
      image: `${CAPTURE_OUTPUT}/${id}-threejs-2d-1x.png`,
      masks: maskPath,
    },
    requiredMaskIds: masks.map(({ id: maskId }) => maskId),
    lightSamples,
    shadowSamples,
    thresholds: THRESHOLDS,
  });
  return { id, manifest: manifestPath };
});

writeJson(FIXTURE_SET_OUTPUT, {
  schemaVersion: 1,
  fixtureSet: stage === 2 ? 'threejs-villa-stage-2' : 'threejs-specialized-stage-3',
  sourceCommit: report.testedCommit,
  mode: 'parity',
  fixtures: fixtureEntries,
});

process.stdout.write(`Wrote ${fixtureEntries.length} Three.js villa fixture manifests for ${report.testedCommit}.\n`);
