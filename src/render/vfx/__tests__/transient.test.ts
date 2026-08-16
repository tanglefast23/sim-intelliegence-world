import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { districtLighting } from '../../district-lighting';
import {
  admitTransientCue,
  combatShotCues,
  createTransientVfxCue,
  expireTransientCues,
  sampleTransientVfx,
  transientVfxPalette,
  transientVfxSeed,
  DUSTY_FOOTSTEP_SURFACES,
  TRANSIENT_VFX_KINDS,
  TRANSIENT_VFX_LIFETIME_MS,
  TRANSIENT_VFX_MAX_CUES,
  TRANSIENT_VFX_MAX_RECTS,
  TRANSIENT_VFX_MINIMUM_ALPHA,
  TRANSIENT_VFX_REVISION,
  TRANSIENT_VFX_STEP_MILLISECONDS,
  WATER_GROUND_SPRITES,
  type TransientVfxCue,
  type TransientVfxKind,
} from '../transient';

const PALETTE = transientVfxPalette(districtLighting('northwest_residential', 12 * 60));
const NIGHT_PALETTE = transientVfxPalette(districtLighting('northwest_residential', 23 * 60));

function cue(kind: TransientVfxKind, id = `${kind}-1`, startMs = 0): TransientVfxCue {
  return createTransientVfxCue({
    id,
    kind,
    startMs,
    origin: { x: 640, y: 640 },
    ...(kind === 'shot' ? { target: { x: 700, y: 620 } } : {}),
    strength: 'standard',
  });
}

function alphaOf(color: string): number {
  return Number.parseInt(color.slice(7), 16) / 255;
}

describe('transient VFX purity and determinism', () => {
  // Comments are stripped first: this guards the CODE, and the file's own doc comment names the very
  // APIs the guard forbids. Matching prose would make the test pass or fail on wording.
  const source = (): string => readFileSync(resolve(process.cwd(), 'src/render/vfx/transient.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/\/\/.*$/gmu, '');

  test('owns no clock and no random source', () => {
    // Same guard style as renderer-bill.test.ts. A transient recipe that reaches for wall-clock time
    // or Math.random cannot be replayed, which breaks the scripted scene's whole premise.
    expect(source()).not.toMatch(/Math\.random|Date\.now|performance\.now|setInterval|setTimeout/u);
  });

  test('salts its own revision and never the ambient one', () => {
    // Reusing VFX_REVISION here would re-seed all sixteen authored ambient anchors, moving every
    // golden capture. The underscore guard is what distinguishes it from TRANSIENT_VFX_REVISION.
    expect(source()).not.toMatch(/(^|[^_A-Z])VFX_REVISION/u);
    expect(TRANSIENT_VFX_REVISION).toBe(1);
    expect(transientVfxSeed('dust', 'a', { x: 1, y: 2 })).toBe(transientVfxSeed('dust', 'a', { x: 1, y: 2 }));
    expect(transientVfxSeed('dust', 'a', { x: 1, y: 2 })).not.toBe(transientVfxSeed('dust', 'b', { x: 1, y: 2 }));
    expect(transientVfxSeed('dust', 'a', { x: 1, y: 2 })).not.toBe(transientVfxSeed('ripple', 'a', { x: 1, y: 2 }));
  });

  test.each(TRANSIENT_VFX_KINDS)('samples %s byte-identically for the same inputs', (kind) => {
    const cues = [cue(kind)];
    for (let step = 0; step < 6; step += 1) {
      const at = step * TRANSIENT_VFX_STEP_MILLISECONDS;
      expect(sampleTransientVfx(cues, at, false, PALETTE))
        .toEqual(sampleTransientVfx(cues, at, false, PALETTE));
    }
  });

  test.each(TRANSIENT_VFX_KINDS)('emits only integer geometry and visible alpha for %s', (kind) => {
    const cues = [cue(kind)];
    for (let at = 0; at < TRANSIENT_VFX_LIFETIME_MS[kind]; at += TRANSIENT_VFX_STEP_MILLISECONDS) {
      for (const rect of sampleTransientVfx(cues, at, false, PALETTE).rects) {
        expect(Number.isInteger(rect.x)).toBe(true);
        expect(Number.isInteger(rect.y)).toBe(true);
        expect(Number.isInteger(rect.width)).toBe(true);
        expect(Number.isInteger(rect.height)).toBe(true);
        expect(rect.width).toBeGreaterThan(0);
        expect(rect.height).toBeGreaterThan(0);
        expect(rect.color).toMatch(/^#[0-9a-f]{8}$/u);
        expect(alphaOf(rect.color)).toBeGreaterThanOrEqual(TRANSIENT_VFX_MINIMUM_ALPHA);
      }
    }
  });

  test('expires each kind exactly at its lifetime', () => {
    for (const kind of TRANSIENT_VFX_KINDS) {
      const cues = [cue(kind)];
      const life = TRANSIENT_VFX_LIFETIME_MS[kind];
      expect(expireTransientCues(cues, life - 1)).toHaveLength(1);
      expect(expireTransientCues(cues, life)).toHaveLength(0);
    }
  });
});

describe('transient VFX budget', () => {
  test('holds the 96-rect ceiling under a flood of feedback cues', () => {
    let cues: readonly TransientVfxCue[] = [];
    let dropped = 0;
    for (let index = 0; index < 40; index += 1) {
      const result = admitTransientCue(cues, cue('ripple', `ripple-${index}`, 0), 0);
      cues = result.cues;
      if (result.dropped) dropped += 1;
    }
    expect(cues.length).toBeLessThanOrEqual(TRANSIENT_VFX_MAX_CUES);
    expect(dropped).toBeGreaterThan(0);
    const frame = sampleTransientVfx(cues, 0, false, PALETTE);
    expect(frame.liveRects).toBeLessThanOrEqual(TRANSIENT_VFX_MAX_RECTS);
    expect(frame.activeCueIds).toEqual([...frame.activeCueIds].sort());
  });

  test('keeps a critical cue and evicts feedback, never the reverse', () => {
    let cues: readonly TransientVfxCue[] = [];
    for (let index = 0; index < TRANSIENT_VFX_MAX_CUES; index += 1) {
      cues = admitTransientCue(cues, cue('dust', `dust-${index}`, 0), 0).cues;
    }
    expect(cues).toHaveLength(TRANSIENT_VFX_MAX_CUES);

    const shot = admitTransientCue(cues, cue('shot', 'shot-1', 0), 0);
    expect(shot.dropped).toBe(false);
    expect(shot.cues.some((entry) => entry.id === 'shot-1')).toBe(true);
    expect(shot.cues).toHaveLength(TRANSIENT_VFX_MAX_CUES);

    // A feedback cue arriving at a full queue is refused rather than evicting anything.
    const extra = admitTransientCue(shot.cues, cue('dust', 'dust-late', 0), 0);
    expect(extra.dropped).toBe(true);
    expect(extra.cues.some((entry) => entry.id === 'shot-1')).toBe(true);
  });

  test('does not re-admit a cue id that is already live', () => {
    const first = admitTransientCue([], cue('dust', 'dust-1', 0), 0);
    const second = admitTransientCue(first.cues, cue('dust', 'dust-1', 0), 0);
    expect(second.dropped).toBe(false);
    expect(second.cues).toHaveLength(1);
  });
});

describe('transient VFX reduced motion', () => {
  test.each(TRANSIENT_VFX_KINDS)('%s never moves under reduced motion', (kind) => {
    const cues = [cue(kind)];
    const geometries: string[][] = [];
    const alphas: number[] = [];
    for (let at = 0; at < TRANSIENT_VFX_LIFETIME_MS[kind]; at += TRANSIENT_VFX_STEP_MILLISECONDS) {
      const reduced = sampleTransientVfx(cues, at, true, PALETTE);
      if (reduced.rects.length === 0) continue;
      geometries.push(reduced.rects.map(({ x, y, width, height }) => `${x},${y},${width},${height}`));
      alphas.push(Math.max(...reduced.rects.map(({ color }) => alphaOf(color))));
    }
    // The property is ZERO POSITIONAL CHANGE. A mark may still fade — a fade is not motion, and the
    // spec's ground-mark lifetime requires one — so geometry is compared and colour is not.
    const first = geometries[0];
    expect(first).toBeDefined();
    for (const geometry of geometries) expect(geometry).toEqual(first);
    // And it fades out, never in: no flashing under reduced motion.
    for (let index = 1; index < alphas.length; index += 1) {
      expect(alphas[index]!).toBeLessThanOrEqual(alphas[index - 1]!);
    }
  });

  test.each(TRANSIENT_VFX_KINDS)('%s costs no more at its peak under reduced motion', (kind) => {
    // PEAK over the lifetime, not a per-step comparison. Reduced motion draws its whole mark on
    // every step it survives while full motion staggers its beats, so at an individual step the
    // reduced count can legitimately be higher. The budget claim is about the peak.
    const cues = [cue(kind)];
    let reducedPeak = 0;
    let standardPeak = 0;
    for (let at = 0; at < TRANSIENT_VFX_LIFETIME_MS[kind]; at += TRANSIENT_VFX_STEP_MILLISECONDS) {
      reducedPeak = Math.max(reducedPeak, sampleTransientVfx(cues, at, true, PALETTE).liveRects);
      standardPeak = Math.max(standardPeak, sampleTransientVfx(cues, at, false, PALETTE).liveRects);
    }
    expect(reducedPeak).toBeLessThanOrEqual(standardPeak);
  });

  test('a reduced-motion shot still reports who fired, along what line, and what was hit', () => {
    const frame = sampleTransientVfx([cue('shot')], 0, true, PALETTE);
    const aerial = frame.rects.filter(({ layer }) => layer === 'aerial');
    // Muzzle mark, eight tracer dashes and an impact mark: the full read, statically.
    expect(aerial).toHaveLength(10);
    expect(frame.glows).toHaveLength(0);
  });

  test('blood is static with or without reduced motion, so the aftermath read never depends on motion', () => {
    const cues = [cue('blood')];
    expect(sampleTransientVfx(cues, 0, true, PALETTE).rects)
      .toEqual(sampleTransientVfx(cues, 0, false, PALETTE).rects);
  });
});

describe('transient VFX recipes', () => {
  test('blood stays inside the restrained pixel budget and lives on the ground', () => {
    // Spec section 9.7 permits 4-12 small dark red pixels and forbids pools and spray.
    const frame = sampleTransientVfx([cue('blood')], 0, false, PALETTE);
    expect(frame.rects).toHaveLength(6);
    expect(frame.rects.every(({ layer }) => layer === 'ground')).toBe(true);
    expect(frame.rects.every(({ width, height }) => width <= 2 && height <= 1)).toBe(true);
  });

  test('a ripple stays inside the 0.75-tile ordinary ceiling', () => {
    const cues = [cue('ripple')];
    for (let at = 0; at < TRANSIENT_VFX_LIFETIME_MS.ripple; at += TRANSIENT_VFX_STEP_MILLISECONDS) {
      for (const rect of sampleTransientVfx(cues, at, false, PALETTE).rects) {
        expect(Math.abs(rect.x - 640)).toBeLessThanOrEqual(24 + 2);
        expect(rect.layer).toBe('ground');
      }
    }
  });

  test('dust honours the two-to-six particle band', () => {
    const counts = (['subtle', 'standard', 'strong'] as const).map((strength) => sampleTransientVfx(
      [createTransientVfxCue({ id: 'd', kind: 'dust', startMs: 0, origin: { x: 640, y: 640 }, strength })],
      0,
      false,
      PALETTE,
    ).rects.length - 1);
    expect(counts).toEqual([2, 4, 6]);
  });

  test('the muzzle halo follows the live sun and is the only glow', () => {
    const cues = [cue('shot')];
    const noon = sampleTransientVfx(cues, 0, false, PALETTE);
    const night = sampleTransientVfx(cues, 0, false, NIGHT_PALETTE);
    expect(noon.glows).toHaveLength(1);
    expect(night.glows).toHaveLength(1);
    // Emitted light reads harder after dark. This is the whole terrain coupling.
    expect(night.glows[0]!.opacity).toBeGreaterThan(noon.glows[0]!.opacity);
    expect(night.glows[0]!.radius).toBeGreaterThanOrEqual(noon.glows[0]!.radius);
    // One step of light only.
    expect(sampleTransientVfx(cues, TRANSIENT_VFX_STEP_MILLISECONDS, false, PALETTE).glows).toHaveLength(0);
  });

  test('the shot geometry is identical at noon and at night; only its light changes', () => {
    const cues = [cue('shot')];
    expect(sampleTransientVfx(cues, 0, false, PALETTE).rects)
      .toEqual(sampleTransientVfx(cues, 0, false, NIGHT_PALETTE).rects);
  });
});

describe('combat shot stub', () => {
  const event = {
    id: 'evt-1',
    shooterId: 'tomas_reed',
    targetId: 'protagonist',
    origin: { x: 800, y: 640 },
    impact: { x: 660, y: 640 },
  } as const;

  test('a hit produces a shot and blood; a miss produces only a shot', () => {
    const hit = combatShotCues({ ...event, outcome: 'hit' }, 0);
    expect(hit.map(({ kind }) => kind)).toEqual(['shot', 'blood']);
    // The stain appears once the round lands, not when it leaves the barrel.
    expect(hit[1]!.startMs).toBe(150);
    expect(combatShotCues({ ...event, outcome: 'miss' }, 0).map(({ kind }) => kind)).toEqual(['shot']);
  });

  test('is deterministic for the same event', () => {
    expect(combatShotCues({ ...event, outcome: 'hit' }, 0))
      .toEqual(combatShotCues({ ...event, outcome: 'hit' }, 0));
  });
});

describe('surface classification', () => {
  test('covers exactly the eight authored water sprites', () => {
    expect([...WATER_GROUND_SPRITES].sort()).toEqual([
      'tile.harbor-water', 'tile.harbor-water-b', 'tile.harbor-water-c', 'tile.harbor-water-d',
      'tile.shallow-water', 'tile.shallow-water-b', 'tile.shallow-water-c', 'tile.shallow-water-d',
    ]);
  });

  test('excludes wood and indoor floors from dust', () => {
    // Spec section 8.5: no dust on clean interior tile.
    expect(DUSTY_FOOTSTEP_SURFACES.has('wood')).toBe(false);
    expect(DUSTY_FOOTSTEP_SURFACES.has('indoor')).toBe(false);
    expect(DUSTY_FOOTSTEP_SURFACES.has('sand')).toBe(true);
  });
});
