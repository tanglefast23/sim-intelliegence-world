import { worldSun } from '../atmosphere';
import { MAP_IDS } from '../../world/maps/catalog';
import {
  GROUND_TINT_LUMINANCE_BOUNDS,
  groundSunTint,
  groundVariationField,
  sampleGroundVariation,
  tintLuminance,
} from '../ground-light';

const COLUMNS = 64;
const ROWS = 48;

describe('ground light', () => {
  test('builds one cached corner lattice per map and salts it by map id', () => {
    const field = groundVariationField('northwest_residential', COLUMNS, ROWS);
    expect(field).toHaveLength((COLUMNS + 1) * (ROWS + 1));
    // Cached by identity, so the ~11,000 corner samples a frame emits never rebuild it.
    expect(groundVariationField('northwest_residential', COLUMNS, ROWS)).toBe(field);
    const other = groundVariationField('southeast_docks', COLUMNS, ROWS);
    expect([...other]).not.toEqual([...field]);
  });

  // The one artifact this design can produce, measured rather than argued.
  //
  // A 3-tile composition quad beside 2-tile quads shares only ONE endpoint of their common edge,
  // so the 3-block interpolates that edge as a straight chord while its neighbours sample the
  // field at the tile between. The visible seam is exactly that gap: field minus chord. Measured
  // worst case across all four maps is 1.09 counts of 255, which is invisible under textured
  // pixel art — and it is the reason the lattice is 8 tiles and not 2.
  test('keeps the composition T-junction mismatch near one count of 255', () => {
    let worstMismatch = 0;
    for (const mapId of MAP_IDS) {
      const field = groundVariationField(mapId, COLUMNS, ROWS);
      const at = (x: number, y: number): number => sampleGroundVariation(field, COLUMNS, ROWS, x, y);
      for (let y = 0; y <= ROWS; y += 1) {
        for (let x = 0; x <= COLUMNS; x += 1) {
          for (const step of [1, 2]) {
            const fraction = step / 3;
            if (x + 3 <= COLUMNS) {
              const chord = at(x, y) * (1 - fraction) + at(x + 3, y) * fraction;
              worstMismatch = Math.max(worstMismatch, Math.abs(at(x + step, y) - chord));
            }
            if (y + 3 <= ROWS) {
              const chord = at(x, y) * (1 - fraction) + at(x, y + 3) * fraction;
              worstMismatch = Math.max(worstMismatch, Math.abs(at(x, y + step) - chord));
            }
          }
        }
      }
    }
    expect(worstMismatch * 255).toBeLessThan(1.5);
  });

  test('clamps outside the map, so the culling margin cannot read past the lattice', () => {
    const field = groundVariationField('northwest_residential', COLUMNS, ROWS);
    expect(sampleGroundVariation(field, COLUMNS, ROWS, -4, -4))
      .toBe(sampleGroundVariation(field, COLUMNS, ROWS, 0, 0));
    expect(sampleGroundVariation(field, COLUMNS, ROWS, COLUMNS + 9, ROWS + 9))
      .toBe(sampleGroundVariation(field, COLUMNS, ROWS, COLUMNS, ROWS));
  });

  test('never crushes or blows out the ground, at any minute on any map', () => {
    const [minimum, maximum] = GROUND_TINT_LUMINANCE_BOUNDS;
    let darkest = Number.POSITIVE_INFINITY;
    let brightest = 0;
    for (const mapId of MAP_IDS) {
      const field = groundVariationField(mapId, COLUMNS, ROWS);
      const extremes = [Math.min(...field), Math.max(...field)];
      for (let minute = 0; minute < 1_440; minute += 1) {
        const sunTint = groundSunTint(worldSun(minute));
        for (const variation of extremes) {
          const luminance = tintLuminance([
            sunTint[0] * variation,
            sunTint[1] * variation,
            sunTint[2] * variation,
          ]);
          darkest = Math.min(darkest, luminance);
          brightest = Math.max(brightest, luminance);
        }
      }
    }
    expect(darkest).toBeGreaterThanOrEqual(minimum);
    expect(brightest).toBeLessThanOrEqual(maximum);
    // The field has to actually do something, or the guard above is guarding nothing.
    expect(brightest - darkest).toBeGreaterThan(0.08);
  });

  test('drops the sun hue under a roof but keeps its level', () => {
    for (const minute of [360, 435, 780, 1_140, 1_320]) {
      const sun = worldSun(minute);
      const outdoor = groundSunTint(sun);
      const sheltered = groundSunTint(sun, true);
      // Neutral: a villa floor must not swing amber at dawn under a roof the sun never crossed.
      expect(sheltered[0]).toBe(sheltered[1]);
      expect(sheltered[1]).toBe(sheltered[2]);
      // But the level still tracks the sun, which is what lets the lamp glow read at night.
      expect(sheltered[0]).toBeCloseTo(tintLuminance(sheltered), 6);
      expect(Math.abs(tintLuminance(sheltered) - tintLuminance(outdoor))).toBeLessThan(0.12);
    }
    expect(tintLuminance(groundSunTint(worldSun(780), true)))
      .toBeGreaterThan(tintLuminance(groundSunTint(worldSun(60), true)));
  });

  test('darkens and warms toward night, and is brightest and neutral at solar noon', () => {
    const noon = groundSunTint(worldSun(780));
    const night = groundSunTint(worldSun(60));
    const sunset = groundSunTint(worldSun(1_260));
    expect(tintLuminance(noon)).toBeGreaterThan(tintLuminance(night));
    expect(tintLuminance(noon)).toBeGreaterThan(tintLuminance(sunset));
    // Noon is near-neutral; night leans blue; sunset leans red.
    expect(Math.abs(noon[0] - noon[2])).toBeLessThan(0.05);
    expect(night[2]).toBeGreaterThan(night[0]);
    expect(sunset[0]).toBeGreaterThan(sunset[2]);
  });
});
