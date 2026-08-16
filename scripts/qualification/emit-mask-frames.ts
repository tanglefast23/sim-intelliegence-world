import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { PNG } from 'pngjs';

import { rendererMask, type AlphaAt, type MaskFrameInput, type RendererMask } from '../../src/render/mask-frame';
import { CHARACTER_SCALE } from '../../src/render/world-frame';

/**
 * Emit the candidate mask frame for every live fixture, from the run under test.
 *
 * Both mask sides used to name ONE file. The deleted builder wrote
 * `baseline: { masks: maskPath }` and `candidate: { masks: maskPath }` from a single variable, so
 * the comparator's mask-identity check has compared a file to itself since the day it was written.
 * Nothing has ever been able to fail it.
 *
 * The inputs here come from the packaged capture's own report — the protagonist's sprite, world
 * position, camera and viewport as the renderer actually drew them — so a silhouette that moves
 * shows up as a moved mask rather than as a stale file that still matches.
 *
 * MIGRATION CHECK. On the first wiring, the emitted mask must reproduce the frozen one exactly.
 * The frozen native masks are 76-cell OUTLINES, not filled silhouettes, and an emitter that filled
 * them everywhere would look correct while silently changing what every readable-coverage number in
 * the corpus means. The check is deep equality of parsed structures, not of file bytes: JSON key
 * order is not part of the contract, and a formatting difference failing this would teach people to
 * ignore it.
 */
const REPORT = process.argv.includes('--report')
  ? process.argv[process.argv.indexOf('--report') + 1]!
  : 'output/verification/visual-polish/capture/renderer-capture-report.json';
const COLLECTION = 'tests/fixtures/rendering/threejs-all-maps-v1.json';
const MASK_ROOT = 'artifacts/visual-polish/baseline';
const ATLAS = 'assets/generated/world-atlas.png';
/** Committed so the emitter's migration check is reproducible without a packaged capture. */
const INPUTS = 'tests/fixtures/rendering/mask-emitter-inputs-v1.json';

type Placement = Readonly<{
  id: string;
  sprite: string;
  worldX: number;
  worldY: number;
  source: Readonly<{ x: number; y: number; width: number; height: number }>;
}>;
type Fixture = Readonly<{
  id: string;
  zoom: number;
  devicePixelRatio: number;
  state: Readonly<{
    camera: Readonly<{ x: number; y: number }>;
    viewport: Readonly<{ width: number; height: number }>;
    characters: readonly Placement[];
  }>;
}>;
type Report = Readonly<{ passes: Readonly<{ threejs2d: Readonly<{ fixtures: readonly Fixture[] }> }> }>;

const atlas = PNG.sync.read(readFileSync(resolve(ATLAS)));
export function atlasAlphaAt(source: Placement['source']): AlphaAt {
  return (x, y) => atlas.data[((source.y + y) * atlas.width + source.x + x) * 4 + 3] !== 0;
}

const report = JSON.parse(readFileSync(resolve(REPORT), 'utf8')) as Report;
const collection = JSON.parse(readFileSync(resolve(COLLECTION), 'utf8')) as {
  fixtures: readonly Readonly<{ id: string; manifest: string }>[];
};
const captured = new Map(report.passes.threejs2d.fixtures.map((fixture) => [fixture.id, fixture]));

mkdirSync(resolve(MASK_ROOT), { recursive: true });

const inputs: MaskFrameInput[] = [];
const mismatched: string[] = [];
let wired = 0;

for (const entry of collection.fixtures) {
  const fixture = captured.get(entry.id);
  if (!fixture) throw new Error(`The capture did not reach ${entry.id}, so its mask cannot be emitted.`);
  const player = fixture.state.characters.find((character) => character.id === 'protagonist');
  if (!player) throw new Error(`${entry.id} has no protagonist, so it has no required mask.`);

  const manifestPath = resolve(entry.manifest);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown> & {
    viewport: { width: number; height: number };
    baseline: { image: string; masks: string };
    candidate: { image: string; masks: string };
  };

  const input: MaskFrameInput = {
    fixtureId: fixture.id,
    sprite: player.sprite,
    source: { x: player.source.x, y: player.source.y, width: player.source.width, height: player.source.height },
    worldX: player.worldX,
    worldY: player.worldY,
    camera: fixture.state.camera,
    viewport: fixture.state.viewport,
    // The manifest's viewport is the CAPTURED frame's logical size, which is not always the case
    // viewport: the offset between them is what centres the frame.
    captureLogical: manifest.viewport,
    devicePixelRatio: fixture.devicePixelRatio,
    zoom: fixture.zoom,
    // The renderer's own authored character scale. The emitter must draw the silhouette the
    // renderer actually drew, or the mask stops describing the frame it is measuring.
    scale: CHARACTER_SCALE,
  };
  inputs.push(input);

  const emitted = rendererMask(input, atlasAlphaAt(player.source));
  const frozen = JSON.parse(readFileSync(resolve(manifest.baseline.masks), 'utf8')) as {
    masks: readonly RendererMask[];
  };
  const existing = frozen.masks.find((mask) => mask.id === emitted.id);
  if (!existing) throw new Error(`${entry.id}: the frozen frame has no mask named ${emitted.id}.`);
  if (JSON.stringify(existing) !== JSON.stringify(emitted)) mismatched.push(entry.id);

  const candidateMasks = `${MASK_ROOT}/${entry.id}-candidate-mask.json`;
  const baselineMasks = `${MASK_ROOT}/${entry.id}-baseline-mask.json`;
  const frame = `${JSON.stringify({ schemaVersion: 1, masks: [emitted] }, null, 2)}\n`;
  mkdirSync(dirname(resolve(candidateMasks)), { recursive: true });
  writeFileSync(resolve(candidateMasks), frame, { encoding: 'utf8', flush: true });
  // The baseline mask is written only when this is the first wiring. After that it belongs to
  // `capture:promote`, which moves it forward together with its image.
  if (!existsSync(resolve(baselineMasks))) {
    writeFileSync(resolve(baselineMasks), frame, { encoding: 'utf8', flush: true });
  }

  manifest.candidate = { ...manifest.candidate, masks: candidateMasks };
  manifest.baseline = { ...manifest.baseline, masks: baselineMasks };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flush: true });
  wired += 1;
}

/**
 * The migration check is a one-way ratchet with a declared exception.
 *
 * Normally a mask that does not reproduce its predecessor means the EMITTER is wrong, and that
 * must stop the run: an emitter which quietly changed the footprint would change what every
 * readable-coverage number in the corpus means.
 *
 * But an item whose whole purpose is to move a silhouette — an authored character scale — makes
 * the masks differ on purpose. That case is allowed only when it is asked for by name, with a
 * reason, so it can never be the accidental outcome of a bad emitter.
 */
const silhouetteChangeIndex = process.argv.indexOf('--silhouette-changed');
const silhouetteReason = silhouetteChangeIndex >= 0 ? process.argv[silhouetteChangeIndex + 1] : undefined;
if (mismatched.length > 0 && !silhouetteReason) {
  throw new Error(
    'The restored emitter does not reproduce the existing masks, so it would change what every ' +
    `readable-coverage number means: ${mismatched.join(', ')}. If a silhouette moved on purpose, ` +
    'pass --silhouette-changed "<reason>".',
  );
}
if (mismatched.length > 0) {
  process.stdout.write(`Silhouette changed on ${mismatched.length} fixtures: ${silhouetteReason}\n`);
}

writeFileSync(
  resolve(INPUTS),
  `${JSON.stringify({ schemaVersion: 1, inputs }, null, 2)}\n`,
  { encoding: 'utf8', flush: true },
);

process.stdout.write(
  `Emitted and wired ${wired} mask frames. Both sides now name different files.\n` +
  (mismatched.length === 0
    ? 'Every emitted mask reproduces its predecessor exactly.\n'
    : `${wired - mismatched.length} reproduce their predecessor; ${mismatched.length} moved by declaration.\n`),
);
