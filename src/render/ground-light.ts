import { stableTupleHash } from '../world/presentation/material-selection';
import { hexChannels, type WorldSun } from './atmosphere';

/**
 * Ground light: one field, three jobs.
 *
 * The ground read as a single flat colour under a single static light. This module fixes that
 * without one extra draw call, texture, GPU program or atlas cell, by writing PER-CORNER values
 * into the vertex `tint` attribute the renderer already uploads for every quad. The rasteriser
 * interpolates between the four corners for free, so a smooth field costs nothing beyond the
 * multiply.
 *
 * The field is the product of two terms:
 *
 *   STATIC   two octaves of value noise, salted by map id, giving each district its own organic
 *            large-scale variation. Depends only on the map, so it is built once and cached.
 *   LIVE     the sun's hue and level. One value per frame, so it is three multiplies per corner.
 *
 * WHY THE FIELD IS LOW FREQUENCY. Floor quads span 2 or 3 tiles depending on the material's
 * composition size, so a 2-block beside a 3-block shares only ONE endpoint of their common edge.
 * The two sides then interpolate the field across different spans — a T-junction. With an eight
 * tile shortest lattice the mismatch is second order and lands under half a count in 255. A
 * per-QUAD constant tint would avoid the T-junction and be far worse: it would draw the
 * composition grid itself as a checkerboard.
 */

/** Peak departure from unity in the static field. */
const VARIATION_AMPLITUDE = 0.05;
/** Lattice periods in tiles, coarse first. Both are wider than the widest composition block. */
const COARSE_OCTAVE_TILES = 21;
const FINE_OCTAVE_TILES = 8;
const FINE_OCTAVE_WEIGHT = 0.6;

/**
 * The darkest the sun may take the ground, as a fraction.
 *
 * Deliberately shallow. Night darkness is the atmosphere wash's job and always has been, and the
 * comparator's readable-coverage floor is 0.95 — the ground must not spend that budget.
 */
const SUN_LEVEL_MINIMUM = 0.94;

/**
 * Relative-luminance band the composed ground tint may never leave.
 *
 * The crush and blow-out guard, asserted across every minute of the day and every corner of every
 * map. It guards against a mistake, not against an art choice: move a keyframe and this moves too.
 */
export const GROUND_TINT_LUMINANCE_BOUNDS: readonly [number, number] = Object.freeze([0.78, 1.06]);

const FIELDS = new Map<string, Float32Array>();

function smoothstep(amount: number): number {
  return amount * amount * (3 - 2 * amount);
}

function latticeValue(mapId: string, octaveTiles: number, x: number, y: number): number {
  return (stableTupleHash([mapId, 'ground-variation', octaveTiles, x, y]) % 1_024) / 1_023;
}

/** Value noise: hash the lattice, smoothstep between the four surrounding lattice points. */
function octaveAt(mapId: string, octaveTiles: number, tileX: number, tileY: number): number {
  const cellX = Math.floor(tileX / octaveTiles);
  const cellY = Math.floor(tileY / octaveTiles);
  const fractionX = smoothstep((tileX - cellX * octaveTiles) / octaveTiles);
  const fractionY = smoothstep((tileY - cellY * octaveTiles) / octaveTiles);
  const top = latticeValue(mapId, octaveTiles, cellX, cellY) * (1 - fractionX) +
    latticeValue(mapId, octaveTiles, cellX + 1, cellY) * fractionX;
  const bottom = latticeValue(mapId, octaveTiles, cellX, cellY + 1) * (1 - fractionX) +
    latticeValue(mapId, octaveTiles, cellX + 1, cellY + 1) * fractionX;
  return top * (1 - fractionY) + bottom * fractionY;
}

/**
 * Multipliers at every TILE CORNER of one map, so the lattice is (columns + 1) by (rows + 1).
 *
 * Built once per map and cached. 65 x 49 floats is about 13 KB, and the alternative — evaluating
 * noise at each of the ~11,000 corner samples a worst-case frame emits — would cost about a
 * million operations per frame for a result that never changes.
 */
export function groundVariationField(
  mapId: string,
  tileColumns: number,
  tileRows: number,
): Float32Array {
  const key = `${mapId}:${tileColumns}x${tileRows}`;
  const cached = FIELDS.get(key);
  if (cached) return cached;
  const columns = tileColumns + 1;
  const field = new Float32Array(columns * (tileRows + 1));
  for (let y = 0; y <= tileRows; y += 1) {
    for (let x = 0; x <= tileColumns; x += 1) {
      const blended = octaveAt(mapId, FINE_OCTAVE_TILES, x, y) * FINE_OCTAVE_WEIGHT +
        octaveAt(mapId, COARSE_OCTAVE_TILES, x, y) * (1 - FINE_OCTAVE_WEIGHT);
      field[y * columns + x] = 1 + (blended * 2 - 1) * VARIATION_AMPLITUDE;
    }
  }
  FIELDS.set(key, field);
  return field;
}

/** One corner sample, clamped to the map so a culling margin cannot read outside the field. */
export function sampleGroundVariation(
  field: Float32Array,
  tileColumns: number,
  tileRows: number,
  tileX: number,
  tileY: number,
): number {
  const x = Math.min(Math.max(Math.round(tileX), 0), tileColumns);
  const y = Math.min(Math.max(Math.round(tileY), 0), tileRows);
  return field[y * (tileColumns + 1) + x] ?? 1;
}

/**
 * The sun's contribution, evaluated ONCE per frame.
 *
 * Hue comes from `sun.light`, level from `sun.elevation`. The renderer multiplies this by each
 * corner's variation, so the per-corner cost is three multiplies and no colour parsing.
 */
export function groundSunTint(sun: WorldSun, sheltered = false): readonly [number, number, number] {
  const level = SUN_LEVEL_MINIMUM + (1 - SUN_LEVEL_MINIMUM) * sun.elevation;
  // Under a roof the sun's HUE cannot reach the floor, so a villa floor must not swing amber at
  // dawn. Its LEVEL still should: a room without lamps genuinely is darker at night, and holding
  // the level is exactly what lets the lamp glow read as light rather than as a sticker.
  if (sheltered) return [level, level, level];
  const [red, green, blue] = hexChannels(sun.light);
  return [red * level, green * level, blue * level];
}

/** Rec. 709 relative luminance, the quantity `GROUND_TINT_LUMINANCE_BOUNDS` constrains. */
export function tintLuminance(tint: readonly [number, number, number]): number {
  return tint[0] * 0.2126 + tint[1] * 0.7152 + tint[2] * 0.0722;
}
