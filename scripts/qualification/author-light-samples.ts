import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PNG } from 'pngjs';

import { districtLighting } from '../../src/render/district-lighting';
import type { MapId } from '../../src/world/maps/catalog';

/**
 * Author the light samples the corpus has never had.
 *
 * Exactly ONE `lightSamples` entry existed across the whole corpus, on a frozen villa fixture, and
 * it sampled a patio fire rather than a lamp. Every other manifest carried an empty array, so the
 * comparator's light loop ran over nothing. Any claim that "lamp centres stay brighter than unlit
 * floor" was a sentence, not a measurement — and it is the only gate technique 7 has.
 *
 * Sources are taken from the two places light actually comes from: the static district pools per
 * map, and the lamp props authored into the compiled maps. Both are converted through the same
 * camera transform the mask emitter uses.
 *
 * THE UNLIT RECTANGLE IS CHOSEN BY GEOMETRY, NOT BY EYE. Each lamp emits an 88x88 world-pixel glow
 * quad and each pool an ellipse of its own radius. Technique 7 widens the plateaus, so a rectangle
 * that merely looks dark today can become lit later in this same program — which would flip the
 * sample's meaning without anyone editing it. The unlit point is the visible point furthest from
 * every source, and it is then confirmed against the captured pixels.
 */
const REPORT = 'output/verification/visual-polish/capture/renderer-capture-report.json';
const COLLECTION = 'tests/fixtures/rendering/threejs-all-maps-v1.json';
const TILE = 32;
const LAMP_GLOW_RADIUS = 44;
const SAMPLE = 6;

const LAMP_SPRITES = new Set([
  'tile.fixture-lamp', 'tile.fixture-dock-lamp-amber', 'tile.fixture-dock-lamp-cold',
  'tile.fixture-festival-lantern', 'tile.fixture-neon-lamp-cyan', 'tile.fixture-neon-lamp-magenta',
]);
const MAP_FILES: Readonly<Record<string, string>> = {
  northwest_residential: 'content/maps/northwest.json',
  northeast_downtown: 'content/maps/northeast.json',
  southwest_commercial: 'content/maps/southwest.json',
  southeast_docks: 'content/maps/southeast.json',
};

type Source = Readonly<{ x: number; y: number; radius: number }>;

function lampSources(mapId: string): Source[] {
  const map = JSON.parse(readFileSync(resolve(MAP_FILES[mapId]!), 'utf8')) as {
    objects: readonly Readonly<{
      anchor: { x: number; y: number };
      renderParts?: readonly Readonly<{ sprite: string; offset?: { x: number; y: number } }>[];
    }>[];
  };
  const lamps: Source[] = [];
  for (const object of map.objects) {
    for (const part of object.renderParts ?? []) {
      if (!LAMP_SPRITES.has(part.sprite)) continue;
      lamps.push({
        x: (object.anchor.x + (part.offset?.x ?? 0)) * TILE + TILE / 2,
        y: (object.anchor.y + (part.offset?.y ?? 0)) * TILE + TILE / 2,
        radius: LAMP_GLOW_RADIUS,
      });
    }
  }
  return lamps;
}

const report = JSON.parse(readFileSync(resolve(REPORT), 'utf8')) as {
  passes: { threejs2d: { fixtures: readonly Readonly<{
    id: string; zoom: number; devicePixelRatio: number;
    state: { mapId: string; camera: { x: number; y: number }; viewport: { width: number; height: number } };
  }>[] } };
};
const collection = JSON.parse(readFileSync(resolve(COLLECTION), 'utf8')) as {
  fixtures: readonly Readonly<{ id: string; manifest: string }>[];
};
const captured = new Map(report.passes.threejs2d.fixtures.map((fixture) => [fixture.id, fixture]));

/** Median luminance of a logical rectangle, read from the captured frame. */
function medianLuminance(image: PNG, rect: Readonly<{ x: number; y: number; width: number; height: number }>, dpr: number): number {
  const linear = (channel: number): number => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const values: number[] = [];
  for (let y = Math.ceil(rect.y * dpr - 0.5); y < Math.ceil((rect.y + rect.height) * dpr - 0.5); y += 1) {
    for (let x = Math.ceil(rect.x * dpr - 0.5); x < Math.ceil((rect.x + rect.width) * dpr - 0.5); x += 1) {
      if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue;
      const offset = (y * image.width + x) * 4;
      values.push(
        0.2126 * linear(image.data[offset]!) +
        0.7152 * linear(image.data[offset + 1]!) +
        0.0722 * linear(image.data[offset + 2]!),
      );
    }
  }
  if (values.length === 0) throw new Error('Empty luminance sample.');
  values.sort((left, right) => left - right);
  return values[Math.floor(values.length / 2)]!;
}

let authored = 0;
const skipped: string[] = [];

for (const entry of collection.fixtures) {
  const fixture = captured.get(entry.id)!;
  const manifestPath = resolve(entry.manifest);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown> & {
    viewport: { width: number; height: number };
    baseline: { image: string };
    lightSamples: unknown[];
  };

  const { camera, viewport, mapId } = fixture.state;
  const { zoom, devicePixelRatio: dpr } = fixture;
  const offsetX = (manifest.viewport.width - viewport.width) / 2;
  const offsetY = (manifest.viewport.height - viewport.height) / 2;
  const toScreen = (worldX: number, worldY: number) => ({
    x: offsetX + (worldX - camera.x) * zoom,
    y: offsetY + (worldY - camera.y) * zoom,
  });

  const lighting = districtLighting(mapId as MapId, 0);
  const sources: Source[] = [
    ...lighting.pools.map((pool) => ({
      x: pool.x * TILE + TILE / 2, y: pool.y * TILE + TILE / 2, radius: pool.radius,
    })),
    ...lampSources(mapId),
  ];

  const inside = (screen: Readonly<{ x: number; y: number }>): boolean =>
    screen.x >= SAMPLE && screen.y >= SAMPLE &&
    screen.x + SAMPLE <= manifest.viewport.width && screen.y + SAMPLE <= manifest.viewport.height;

  // The lit rectangle is the brightest visible source centre.
  const image = PNG.sync.read(readFileSync(resolve(manifest.baseline.image)));
  const rectAt = (screen: Readonly<{ x: number; y: number }>) => ({
    x: Math.round(screen.x - SAMPLE / 2), y: Math.round(screen.y - SAMPLE / 2), width: SAMPLE, height: SAMPLE,
  });
  const visible = sources.map((source) => ({ source, screen: toScreen(source.x, source.y) }))
    .filter(({ screen }) => inside(screen));
  if (visible.length === 0) { skipped.push(`${entry.id} (no light source on screen)`); continue; }
  const lit = visible
    .map(({ screen }) => ({ rect: rectAt(screen), luminance: medianLuminance(image, rectAt(screen), dpr) }))
    .sort((left, right) => right.luminance - left.luminance)[0]!;

  // The unlit rectangle: clearance is the HARD constraint, darkness is the tiebreak.
  //
  // Picking the single clearest point instead chose bright sand on the daylit docks, which is
  // outside every glow but is not dark — so the brightest visible lamp was measurably darker than
  // it and the pair was unusable. Requiring clearance first keeps the geometric guarantee that a
  // widened plateau cannot reach the rectangle; choosing the darkest among those makes the pair a
  // real lit-versus-unlit contrast rather than an accident of ground colour.
  let unlit: { rect: { x: number; y: number; width: number; height: number }; luminance: number } | undefined;
  let bestClearance = -Infinity;
  for (let sy = SAMPLE; sy + SAMPLE < manifest.viewport.height; sy += 8) {
    for (let sx = SAMPLE; sx + SAMPLE < manifest.viewport.width; sx += 8) {
      const worldX = (sx - offsetX) / zoom + camera.x;
      const worldY = (sy - offsetY) / zoom + camera.y;
      const clearance = Math.min(...sources.map((source) =>
        Math.hypot(worldX - source.x, worldY - source.y) - source.radius));
      bestClearance = Math.max(bestClearance, clearance);
      if (clearance <= 0) continue;
      const rect = { x: sx, y: sy, width: SAMPLE, height: SAMPLE };
      const luminance = medianLuminance(image, rect, dpr);
      if (!unlit || luminance < unlit.luminance) unlit = { rect, luminance };
    }
  }
  if (!unlit) {
    skipped.push(`${entry.id} (every visible point sits inside some source radius; best clearance ${bestClearance.toFixed(1)} world px)`);
    continue;
  }

  // Confirm on the pixels. The comparator asserts exactly this, so a sample that does not already
  // hold would be authored broken.
  if (lit.luminance <= unlit.luminance) {
    skipped.push(`${entry.id} (brightest source ${lit.luminance.toFixed(4)} is not above the clearest floor ${unlit.luminance.toFixed(4)})`);
    continue;
  }

  manifest.lightSamples = [{ id: `district-light-${entry.id}`, lit: lit.rect, unlit: unlit.rect }];
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flush: true });
  authored += 1;
}

process.stdout.write(
  `Authored light samples for ${authored} of ${collection.fixtures.length} live fixtures.\n` +
  (skipped.length > 0
    ? `No usable lit-versus-unlit pair was visible in: ${skipped.join(', ')}.\n`
    : ''),
);
