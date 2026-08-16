/**
 * Transient VFX: one-shot interaction, movement and violence effects.
 *
 * PURE. Same inputs give byte-identical output, so a scripted scene replays exactly in a test.
 * No `Math.random`, no `Date.now`, no `performance.now`, no state. The caller owns the clock, the
 * same contract the ambient system in `procedural-effects.ts` already keeps.
 *
 * Time is bucketed to `TRANSIENT_VFX_STEP_MILLISECONDS` before any geometry is computed, exactly as
 * `sampleVfxGeometry` buckets to `VFX_STEP_MILLISECONDS`. That is what makes a puff read as stepped
 * pixel animation instead of smooth interpolation, and it is why 20 Hz is enough.
 *
 * Every cap here is quoted from docs/specs/2026-08-11-skia-procedural-vfx.md rather than invented;
 * the section is named at each one.
 */

import { stableTupleHash } from '../../world/presentation/material-selection';
import type { WorldSun } from '../atmosphere';
import type { DistrictLighting } from '../district-lighting';
import type { TransientVfxGlow, TransientVfxLayer, TransientVfxRect } from './types';

/**
 * Salts transient seeds ONLY. Deliberately not `VFX_REVISION`: that value feeds every ambient
 * emitter's seed in `seed.ts`, so bumping it would re-phase all sixteen authored anchors and rebase
 * every golden capture. Spec section 15.4 requires a bump only when an EXISTING recipe's
 * deterministic evidence changes. These recipes are new.
 */
export const TRANSIENT_VFX_REVISION = 1 as const;

/** 20 Hz. Coarse enough to stay stepped, fine enough for a 100 ms muzzle flash. */
export const TRANSIENT_VFX_STEP_MILLISECONDS = 50 as const;

/** Spec section 14.2, High quality "action/critical reserve". */
export const TRANSIENT_VFX_MAX_RECTS = 96 as const;
/** Spec section 14.2, "at most eight active one-shot cue sequences". */
export const TRANSIENT_VFX_MAX_CUES = 8 as const;
/**
 * Factorio FFF #281 skips particles below 2% opacity because they "don't really seem to add
 * anything to the final picture". Culled before the geometry builder ever sees them.
 */
export const TRANSIENT_VFX_MINIMUM_ALPHA = 0.02 as const;

export const TRANSIENT_VFX_KINDS = ['ripple', 'dust', 'shot', 'blood'] as const;
export type TransientVfxKind = (typeof TRANSIENT_VFX_KINDS)[number];

/** Spec section 9.4 caps an expanding ring at 180-420 ms; section 9.10 a ground mark at 3-8 s. */
export const TRANSIENT_VFX_LIFETIME_MS: Readonly<Record<TransientVfxKind, number>> = Object.freeze({
  ripple: 400,
  dust: 400,
  shot: 500,
  blood: 4_000,
});

export type TransientVfxStrength = 'subtle' | 'standard' | 'strong';

export type TransientVfxPoint = Readonly<{ x: number; y: number }>;

export type TransientVfxCue = Readonly<{
  id: string;
  kind: TransientVfxKind;
  /** Presentation-clock milliseconds at admission. */
  startMs: number;
  /** World pixels. For `shot` this is the muzzle. */
  origin: TransientVfxPoint;
  /** World pixels. `shot` only: where the round lands. */
  target?: TransientVfxPoint;
  strength: TransientVfxStrength;
  seed: number;
}>;

export type TransientVfxPalette = Readonly<{
  /** Sun-lit edge. */
  accent: string;
  /** Shaded edge, 8-digit. */
  shadow: string;
  /** Shadow displacement; the sun sits opposite it. */
  shadowX: number;
  shadowY: number;
  /** 0 in full day through 1 at deep night: how strongly emitted light reads. */
  lampMix: number;
}>;

export type TransientVfxFrame = Readonly<{
  rects: readonly TransientVfxRect[];
  glows: readonly TransientVfxGlow[];
  /** Sorted. */
  activeCueIds: readonly string[];
  liveRects: number;
}>;

export const EMPTY_TRANSIENT_VFX_FRAME: TransientVfxFrame = Object.freeze({
  rects: Object.freeze([]),
  glows: Object.freeze([]),
  activeCueIds: Object.freeze([]),
  liveRects: 0,
});

/**
 * The eight authored water ground sprites. A click or a foot plant on one of these ripples; anything
 * else puffs dust. Verified against the generated atlas index.
 */
export const WATER_GROUND_SPRITES: ReadonlySet<string> = new Set([
  'tile.shallow-water',
  'tile.shallow-water-b',
  'tile.shallow-water-c',
  'tile.shallow-water-d',
  'tile.harbor-water',
  'tile.harbor-water-b',
  'tile.harbor-water-c',
  'tile.harbor-water-d',
]);

/**
 * Surfaces that take dust. Spec section 8.5: no dust on water, wet asphalt, or clean interior tile.
 * Classified by the SAME `footstepSurface()` the audio policy uses, so a puff and its footstep sound
 * can never disagree about what the ground is.
 */
export const DUSTY_FOOTSTEP_SURFACES: ReadonlySet<string> = new Set(['sand', 'stone', 'asphalt']);

/** Restrained, muted, and deliberately NOT sun-tinted: a stain is a surface mark, not emitted light. */
const BLOOD_COLOR = '#5e1a18';
/** Emitted light. Constant hue; only its halo strength follows the sun. */
const MUZZLE_CORE_COLOR = '#fff3c8';
const MUZZLE_HALO_COLOR = '#ffd88a';
const IMPACT_SPARK_COLOR = '#ffe9b4';

/** Eight compass points on a unit circle. A table, so the ring needs no trig and is obviously stable. */
const RING_POINTS: readonly (readonly [number, number])[] = Object.freeze([
  [1, 0], [0.7071, 0.7071], [0, 1], [-0.7071, 0.7071],
  [-1, 0], [-0.7071, -0.7071], [0, -1], [0.7071, -0.7071],
]);

/** Top-down foreshortening. Matches the selection ring's own 17x9 ellipse. */
const GROUND_ELLIPSE_RATIO = 0.53;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** `#rrggbb` plus an alpha byte. Alpha is quantised to a plateau by the caller, never a ramp. */
function withAlpha(hex: string, alpha: number): string {
  const base = hex.length >= 7 ? hex.slice(0, 7) : '#ffffff';
  const byte = Math.round(clamp01(alpha) * 255);
  return `${base}${byte.toString(16).padStart(2, '0')}`;
}

function rect(
  layer: TransientVfxLayer,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
): TransientVfxRect {
  return Object.freeze({
    layer,
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
    color,
  });
}

/** A stable 0..n-1 draw from a seed, so a recipe can vary without a random source. */
function seedPick(seed: number, salt: number, count: number): number {
  return (((seed >>> (salt % 24)) ^ (salt * 2_654_435_761)) >>> 0) % count;
}

export function transientVfxSeed(
  kind: TransientVfxKind,
  id: string,
  origin: TransientVfxPoint,
  target?: TransientVfxPoint,
): number {
  return stableTupleHash([
    TRANSIENT_VFX_REVISION,
    kind,
    id,
    Math.round(origin.x),
    Math.round(origin.y),
    Math.round(target?.x ?? 0),
    Math.round(target?.y ?? 0),
  ]);
}

export function createTransientVfxCue(
  input: Readonly<{
    id: string;
    kind: TransientVfxKind;
    startMs: number;
    origin: TransientVfxPoint;
    target?: TransientVfxPoint;
    strength?: TransientVfxStrength;
  }>,
): TransientVfxCue {
  const strength = input.strength ?? 'standard';
  return Object.freeze({
    id: input.id,
    kind: input.kind,
    startMs: input.startMs,
    origin: Object.freeze({ ...input.origin }),
    ...(input.target ? { target: Object.freeze({ ...input.target }) } : {}),
    strength,
    seed: transientVfxSeed(input.kind, input.id, input.origin, input.target),
  });
}

export function transientVfxPalette(lighting: DistrictLighting): TransientVfxPalette {
  const sun: WorldSun = lighting.sun;
  return Object.freeze({
    accent: lighting.accent,
    shadow: lighting.shadow.color,
    shadowX: sun.shadowX,
    shadowY: sun.shadowY,
    lampMix: sun.lampMix,
  });
}

export function transientCueExpired(cue: TransientVfxCue, nowMs: number): boolean {
  return nowMs - cue.startMs >= TRANSIENT_VFX_LIFETIME_MS[cue.kind];
}

export function expireTransientCues(
  cues: readonly TransientVfxCue[],
  nowMs: number,
): readonly TransientVfxCue[] {
  const live = cues.filter((cue) => !transientCueExpired(cue, nowMs));
  return live.length === cues.length ? cues : Object.freeze(live);
}

/** `shot` and `blood` are the critical primary marks spec section 14.3 rule 7 refuses to drop. */
function isCritical(cue: TransientVfxCue): boolean {
  return cue.kind === 'shot' || cue.kind === 'blood';
}

/**
 * Spec section 14.3 degradation order, restricted to this kit: drop feedback-tier cues before
 * critical ones, oldest first, and never drop a `shot` or `blood`.
 */
export function admitTransientCue(
  cues: readonly TransientVfxCue[],
  candidate: TransientVfxCue,
  nowMs: number,
): Readonly<{ cues: readonly TransientVfxCue[]; dropped: boolean }> {
  const live = [...expireTransientCues(cues, nowMs)];
  if (live.some((cue) => cue.id === candidate.id)) {
    return Object.freeze({ cues: Object.freeze(live), dropped: false });
  }
  if (live.length >= TRANSIENT_VFX_MAX_CUES) {
    if (!isCritical(candidate)) return Object.freeze({ cues: Object.freeze(live), dropped: true });
    const victim = live.findIndex((cue) => !isCritical(cue));
    if (victim < 0) return Object.freeze({ cues: Object.freeze(live), dropped: true });
    live.splice(victim, 1);
  }
  live.push(candidate);
  return Object.freeze({ cues: Object.freeze(live), dropped: false });
}

/**
 * Two broken concentric rings expanding on a posterized radius lattice.
 *
 * Broken on purpose: spec section 9.4 wants "an incomplete pixel ring", not "a magical perfect
 * circle". Which two of the eight points are missing rotates with the step, so the gap reads as
 * surface chop rather than a hole in the sprite.
 */
function rippleRects(cue: TransientVfxCue, step: number, reducedMotion: boolean, palette: TransientVfxPalette): TransientVfxRect[] {
  const out: TransientVfxRect[] = [];
  const sunSideX = -Math.sign(palette.shadowX) || 1;
  // Reduced motion: one ring, held at the mid radius, no expansion.
  const rings = reducedMotion ? [{ radius: 12, alpha: 0.42 }] : [
    { radius: 3 + step * 3, alpha: step < 3 ? 0.55 : step < 6 ? 0.28 : 0.1 },
    { radius: step < 2 ? 0 : 3 + (step - 2) * 3, alpha: step < 2 ? 0 : step < 5 ? 0.34 : 0.14 },
  ];
  for (const [ringIndex, ring] of rings.entries()) {
    if (ring.radius <= 0 || ring.alpha < TRANSIENT_VFX_MINIMUM_ALPHA) continue;
    const radiusX = Math.min(24, ring.radius);
    const radiusY = Math.max(1, Math.round(radiusX * GROUND_ELLIPSE_RATIO));
    for (const [pointIndex, point] of RING_POINTS.entries()) {
      if (!reducedMotion && (pointIndex + step + cue.seed + ringIndex) % 4 === 0) continue;
      const px = cue.origin.x + point[0] * radiusX;
      const py = cue.origin.y + point[1] * radiusY;
      const horizontal = Math.abs(point[0]) >= 0.7;
      const lit = Math.sign(point[0]) === sunSideX;
      out.push(rect(
        'ground',
        px - (horizontal ? 1 : 0),
        py,
        horizontal ? 2 : 1,
        1,
        withAlpha(lit ? palette.accent : palette.shadow, ring.alpha),
      ));
    }
  }
  return out;
}

/**
 * A flat base smear plus 2-6 hard particles. Spec section 8.5 gives the "two-to-six" range and
 * requires emission to follow travel distance rather than frame count, which is why the caller
 * spawns these off `FootPlant.index` and never off a render frame.
 */
function dustRects(cue: TransientVfxCue, step: number, reducedMotion: boolean, palette: TransientVfxPalette): TransientVfxRect[] {
  const out: TransientVfxRect[] = [];
  const count = cue.strength === 'subtle' ? 2 : cue.strength === 'strong' ? 6 : 4;
  const baseAlpha = step < 2 ? 0.4 : step < 5 ? 0.22 : 0.09;
  if (baseAlpha >= TRANSIENT_VFX_MINIMUM_ALPHA) {
    out.push(rect('ground', cue.origin.x - 3, cue.origin.y, 6, 2, withAlpha(palette.shadow, baseAlpha)));
  }
  if (reducedMotion) return out;
  const sunSideX = -Math.sign(palette.shadowX) || 1;
  for (let index = 0; index < count; index += 1) {
    const alpha = step < 2 ? 0.5 : step < 5 ? 0.26 : 0.1;
    if (alpha < TRANSIENT_VFX_MINIMUM_ALPHA) break;
    const lateral = (seedPick(cue.seed, index + 1, 5) - 2);
    const side = lateral === 0 ? (index % 2 === 0 ? 1 : -1) : Math.sign(lateral);
    const size = seedPick(cue.seed, index + 9, 2) === 0 ? 1 : 2;
    out.push(rect(
      'ground',
      cue.origin.x + lateral + side * step,
      cue.origin.y - 1 - Math.floor(step / 2),
      size,
      1,
      withAlpha(side === sunSideX ? palette.accent : palette.shadow, alpha),
    ));
  }
  return out;
}

/**
 * Muzzle flash, tracer and impact spark as one cue, so the three beats can never drift apart.
 *
 * The flash is a 4-arm cross: two arms along the shot axis, two perpendicular, with four seeded
 * length variations so repeated shots do not read as a stamp (Gravity Ace, "Making better bullets
 * in Godot Engine"). The tracer is Bresenham-stepped dashes that SHORTEN from the muzzle end, which
 * reads as travel without needing a rotated quad in an axis-aligned kit.
 */
function shotRects(cue: TransientVfxCue, step: number, reducedMotion: boolean): TransientVfxRect[] {
  const out: TransientVfxRect[] = [];
  const target = cue.target ?? cue.origin;
  const deltaX = target.x - cue.origin.x;
  const deltaY = target.y - cue.origin.y;
  const length = Math.hypot(deltaX, deltaY) || 1;
  const axisX = deltaX / length;
  const axisY = deltaY / length;
  const variation = seedPick(cue.seed, 3, 4);

  // Reduced motion: every mark static and simultaneous for four steps. No travel, no expansion.
  // The player still learns who fired, in what direction, and what was hit.
  if (reducedMotion) {
    if (step >= 4) return out;
    out.push(rect('aerial', cue.origin.x - 1, cue.origin.y - 1, 3, 3, withAlpha(MUZZLE_CORE_COLOR, 0.9)));
    for (let index = 1; index <= 8; index += 1) {
      const t = index / 9;
      out.push(rect(
        'aerial',
        cue.origin.x + deltaX * t,
        cue.origin.y + deltaY * t,
        1,
        1,
        withAlpha(MUZZLE_CORE_COLOR, 0.5),
      ));
    }
    out.push(rect('aerial', target.x - 1, target.y - 1, 3, 3, withAlpha(IMPACT_SPARK_COLOR, 0.8)));
    return out;
  }

  // Muzzle core: two steps. Spec section 7.4 wants a primary mark readable for >= 2 submitted frames.
  if (step < 2) {
    const alpha = step === 0 ? 1 : 0.6;
    out.push(rect('aerial', cue.origin.x - 1, cue.origin.y - 1, 3, 3, withAlpha(MUZZLE_CORE_COLOR, alpha)));
    const along = 3 + variation;
    const across = 1 + (variation % 2);
    out.push(rect('aerial', cue.origin.x + axisX * along - 1, cue.origin.y + axisY * along, 2, 1, withAlpha(MUZZLE_CORE_COLOR, alpha)));
    out.push(rect('aerial', cue.origin.x - axisX * 2, cue.origin.y - axisY * 2, 1, 1, withAlpha(MUZZLE_CORE_COLOR, alpha * 0.7)));
    out.push(rect('aerial', cue.origin.x - axisY * across, cue.origin.y + axisX * across, 1, 1, withAlpha(MUZZLE_HALO_COLOR, alpha * 0.8)));
    out.push(rect('aerial', cue.origin.x + axisY * across, cue.origin.y - axisX * across, 1, 1, withAlpha(MUZZLE_HALO_COLOR, alpha * 0.8)));
  }

  // Tracer: three steps, shortening from the muzzle.
  if (step < 3) {
    const dashes = 8;
    const from = step;
    for (let index = from; index < dashes; index += 1) {
      const t = (index + 1) / (dashes + 1);
      const alpha = 0.85 - t * 0.45 - step * 0.2;
      if (alpha < TRANSIENT_VFX_MINIMUM_ALPHA) continue;
      out.push(rect(
        'aerial',
        cue.origin.x + deltaX * t,
        cue.origin.y + deltaY * t,
        1,
        1,
        withAlpha(MUZZLE_CORE_COLOR, alpha),
      ));
    }
  }

  // Impact: steps 2-5, sparks thrown back along the incoming direction.
  if (step >= 2 && step < 6) {
    const age = step - 2;
    if (age < 2) {
      out.push(rect('aerial', target.x - 1, target.y - 1, 3, 3, withAlpha(IMPACT_SPARK_COLOR, age === 0 ? 0.95 : 0.55)));
    }
    const alpha = 0.8 - age * 0.22;
    if (alpha >= TRANSIENT_VFX_MINIMUM_ALPHA) {
      for (let index = 0; index < 6; index += 1) {
        const spread = seedPick(cue.seed, index + 5, 5) - 2;
        const distance = 1 + age * 2 + seedPick(cue.seed, index + 13, 2);
        out.push(rect(
          'aerial',
          target.x - axisX * distance - axisY * spread,
          target.y - axisY * distance + axisX * spread,
          1,
          1,
          withAlpha(IMPACT_SPARK_COLOR, alpha),
        ));
      }
    }
  }
  return out;
}

/**
 * Six dark pixels. Spec section 9.7 permits 4-12 and forbids mist, spray, deformation and pools.
 *
 * Static from the first frame, so reduced motion needs no special case — the aftermath read is
 * motion-free by construction. It works at 1x only because dark red on warm ground is a big colour
 * contrast, which is the RimWorld art rule: detail under 3 px wide needs contrast to survive.
 */
function bloodRects(cue: TransientVfxCue, step: number): TransientVfxRect[] {
  const holdSteps = 50;
  const alpha = step < holdSteps ? 0.8 : step < 60 ? 0.55 : step < 70 ? 0.3 : 0.12;
  if (alpha < TRANSIENT_VFX_MINIMUM_ALPHA) return [];
  const color = withAlpha(BLOOD_COLOR, alpha);
  const target = cue.target ?? cue.origin;
  const driftX = Math.sign(target.x - cue.origin.x) || 1;
  const out: TransientVfxRect[] = [
    rect('ground', cue.origin.x - 1, cue.origin.y, 2, 1, color),
    rect('ground', cue.origin.x + 1, cue.origin.y + 1, 1, 1, color),
    rect('ground', cue.origin.x - 2, cue.origin.y + 1, 1, 1, color),
  ];
  for (let index = 0; index < 3; index += 1) {
    const distance = 2 + seedPick(cue.seed, index + 2, 3);
    const lateral = seedPick(cue.seed, index + 7, 3) - 1;
    out.push(rect('ground', cue.origin.x + driftX * distance, cue.origin.y + lateral, 1, 1, color));
  }
  return out;
}

function shotGlow(cue: TransientVfxCue, step: number, reducedMotion: boolean, palette: TransientVfxPalette): TransientVfxGlow | undefined {
  // One step of light. Additive, stepped, and scaled by how much emitted light reads right now, so
  // the same shot is a small warm bloom at noon and a hard flash at midnight.
  if (reducedMotion || step !== 0) return undefined;
  const opacity = 0.3 + palette.lampMix * 0.5;
  return Object.freeze({
    worldX: cue.origin.x,
    worldY: cue.origin.y,
    radius: 16 + Math.round(palette.lampMix * 8),
    color: MUZZLE_HALO_COLOR,
    opacity,
  });
}

/**
 * Samples every live cue at `nowMs`.
 *
 * The cap is enforced HERE, not at admission, because a cue's rect count varies across its life.
 * Critical marks are kept and feedback-tier rects are dropped once the ceiling is reached.
 */
export function sampleTransientVfx(
  cues: readonly TransientVfxCue[],
  nowMs: number,
  reducedMotion: boolean,
  palette: TransientVfxPalette,
): TransientVfxFrame {
  if (!Number.isFinite(nowMs) || nowMs < 0) {
    throw new Error('Transient VFX time must be a finite non-negative number.');
  }
  const live = cues.filter((cue) => !transientCueExpired(cue, nowMs) && nowMs >= cue.startMs);
  if (live.length === 0) return EMPTY_TRANSIENT_VFX_FRAME;
  const ordered = [...live].sort((left, right) => (
    Number(isCritical(right)) - Number(isCritical(left)) ||
    left.startMs - right.startMs ||
    left.id.localeCompare(right.id, 'en')
  ));
  const rects: TransientVfxRect[] = [];
  const glows: TransientVfxGlow[] = [];
  const activeCueIds: string[] = [];
  for (const cue of ordered) {
    const step = Math.floor((nowMs - cue.startMs) / TRANSIENT_VFX_STEP_MILLISECONDS);
    const sampled = cue.kind === 'ripple'
      ? rippleRects(cue, step, reducedMotion, palette)
      : cue.kind === 'dust'
        ? dustRects(cue, step, reducedMotion, palette)
        : cue.kind === 'shot'
          ? shotRects(cue, step, reducedMotion)
          : bloodRects(cue, step);
    if (rects.length + sampled.length > TRANSIENT_VFX_MAX_RECTS) continue;
    if (sampled.length === 0) continue;
    rects.push(...sampled);
    activeCueIds.push(cue.id);
    if (cue.kind === 'shot') {
      const glow = shotGlow(cue, step, reducedMotion, palette);
      if (glow) glows.push(glow);
    }
  }
  return Object.freeze({
    rects: Object.freeze(rects),
    glows: Object.freeze(glows),
    activeCueIds: Object.freeze(activeCueIds.sort((left, right) => left.localeCompare(right, 'en'))),
    liveRects: rects.length,
  });
}

/**
 * The stub combat event interface.
 *
 * This game has no combat system. Spec section 3.3 is explicit that contextual violence stays "a
 * short abstract presentation of an already-resolved authored action", so this is the whole surface:
 * a future combat system emits `CombatShotEvent` and pushes the result into the same queue clicks
 * already use. No bus, no registry, no provider.
 *
 * It cannot touch the simulation. It takes a plain event and returns plain cues, so it structurally
 * cannot create evidence, choose a witness, or advance the domain PRNG (spec section 3.2).
 */
export type CombatShotEvent = Readonly<{
  /** Stable; also the dedup key. */
  id: string;
  shooterId: string;
  targetId: string;
  /** Muzzle, world pixels. */
  origin: TransientVfxPoint;
  /** Where the round lands, world pixels. */
  impact: TransientVfxPoint;
  outcome: 'hit' | 'miss';
}>;

/**
 * `bloodDelayMs` exists because the stain appears once the round has landed, not when it left the
 * barrel. A future lethal `outcome` maps to physics's `fallPose` then `downPose`; not built, because
 * nothing in the domain commits a death.
 */
export function combatShotCues(event: CombatShotEvent, nowMs: number): readonly TransientVfxCue[] {
  const shot = createTransientVfxCue({
    id: `${event.id}-shot`,
    kind: 'shot',
    startMs: nowMs,
    origin: event.origin,
    target: event.impact,
    strength: 'strong',
  });
  if (event.outcome === 'miss') return Object.freeze([shot]);
  return Object.freeze([
    shot,
    createTransientVfxCue({
      id: `${event.id}-blood`,
      kind: 'blood',
      startMs: nowMs + 150,
      origin: event.impact,
      target: { x: event.impact.x + (event.impact.x - event.origin.x), y: event.impact.y },
      strength: 'standard',
    }),
  ]);
}
