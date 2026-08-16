import { WORLD_MAP_CATALOG } from '../../application/runtime/map-catalog';
import { createInitialState } from '../../domain/state/initial-state';
import { PROTAGONIST_WOBBLE_PIVOT } from '../protagonist-wobble';
import { buildWorldFrameState, CHARACTER_SCALE, withAuthoredCharacterScale } from '../world-frame';

/**
 * Handoff technique 4b: the authored character scale.
 *
 * The only item in this program that changes the size of a gameplay-legibility element, and the
 * only one that moves a required mask. It ships alone and last for both reasons.
 */
const WIDTH = 24;
const HEIGHT = 30;

describe('authored character scale', () => {
  test('keeps the sprite a whole number of pixels on both axes', () => {
    // This is why the scale is 7/6 and not the spike's 1.22. 24 x 1.22 = 29.28 and
    // 30 x 1.22 = 36.6: a fractional SIZE puts the quad's far edges on fractional world
    // coordinates however the near edge is anchored, so whole-pixel placement — a locked hard
    // constraint — is broken by the scale itself and no anchor rescues it.
    expect(WIDTH * CHARACTER_SCALE).toBe(28);
    expect(HEIGHT * CHARACTER_SCALE).toBe(35);
    expect(Number.isInteger(WIDTH * CHARACTER_SCALE)).toBe(true);
    expect(Number.isInteger(HEIGHT * CHARACTER_SCALE)).toBe(true);
  });

  test('shifts by whole pixels, so the placement stays on the lattice', () => {
    const scaled = withAuthoredCharacterScale(400, 900);
    expect(Number.isInteger(scaled.worldX)).toBe(true);
    expect(Number.isInteger(scaled.worldY)).toBe(true);
  });

  test('leaves the foot line exactly where it was', () => {
    // The visible property: a figure standing on a floor must not sink or hover. Exact, not close.
    const worldY = 900;
    const scaled = withAuthoredCharacterScale(400, worldY);
    expect(scaled.worldY + HEIGHT * scaled.scale).toBe(worldY + HEIGHT);
  });

  test('leaves the pivot x exact and drifts its y by a sixth of a pixel', () => {
    // Whole-pixel placement, the foot line and the rotation pivot cannot all three be exact at a
    // non-integer scale. The pivot's y is what gives, because it is the only one of the three that
    // is neither a locked constraint nor visible as a figure standing on a floor.
    const worldX = 400;
    const worldY = 900;
    const scaled = withAuthoredCharacterScale(worldX, worldY);

    expect(scaled.worldX + PROTAGONIST_WOBBLE_PIVOT.x * scaled.scale).toBe(worldX + PROTAGONIST_WOBBLE_PIVOT.x);

    const pivotYBefore = worldY + PROTAGONIST_WOBBLE_PIVOT.y;
    const pivotYAfter = scaled.worldY + PROTAGONIST_WOBBLE_PIVOT.y * scaled.scale;
    expect(pivotYBefore - pivotYAfter).toBeCloseTo(1 / 6, 10);
  });

  test('records the device-pixel consequence rather than bounding it', () => {
    // The pivot drift is in WORLD space, so its device-space size scales with zoom and DPR. An
    // earlier draft of this program claimed "under half a device pixel at every DPR", which is
    // true only at zoom 1. The worst LOCKED pair is zoom 3 at DPR 2.
    const worldDrift = 1 / 6;
    expect(worldDrift * 1 * 1).toBeCloseTo(0.1667, 4);
    expect(worldDrift * 3 * 2).toBeCloseTo(1, 4);
  });

  test('every character in a real frame carries the authored scale', () => {
    const frame = buildWorldFrameState(
      WORLD_MAP_CATALOG.northwest_residential, createInitialState(), {}, 'down', 0,
    );
    expect(frame.characters.length).toBeGreaterThan(0);
    for (const character of frame.characters) {
      expect(character.scale).toBe(CHARACTER_SCALE);
      expect(Number.isInteger(character.worldX)).toBe(true);
      expect(Number.isInteger(character.worldY)).toBe(true);
    }
  });

  test('leaves the contact shadow anchored to the foot, not to the sprite origin', () => {
    // shadowWorldX and shadowWorldY derive from the foot, never from worldX/worldY, so the scale
    // must not move them. If this fails, a scaled character is floating.
    const frame = buildWorldFrameState(
      WORLD_MAP_CATALOG.northwest_residential, createInitialState(), {}, 'down', 0,
    );
    const player = frame.characters.find(({ id }) => id === 'protagonist')!;
    expect(player.shadowWorldY).toBeGreaterThan(player.worldY);
    expect(Number.isFinite(player.shadowWorldX)).toBe(true);
  });
});
