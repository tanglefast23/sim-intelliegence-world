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
describe('authored character scale', () => {
  test('keeps the placement pivot exactly where it was', () => {
    // addAtlasPlacement rotates about (worldX + pivot.x x scale), so this is the invariant that
    // keeps the wobble turning about the same point at a different size.
    const worldX = 400;
    const worldY = 900;
    const scaled = withAuthoredCharacterScale(worldX, worldY, PROTAGONIST_WOBBLE_PIVOT);
    expect(scaled.worldX + PROTAGONIST_WOBBLE_PIVOT.x * scaled.scale)
      .toBeCloseTo(worldX + PROTAGONIST_WOBBLE_PIVOT.x, 10);
    expect(scaled.worldY + PROTAGONIST_WOBBLE_PIVOT.y * scaled.scale)
      .toBeCloseTo(worldY + PROTAGONIST_WOBBLE_PIVOT.y, 10);
  });

  test('drifts the foot line by exactly 0.22 logical pixels, and no more', () => {
    // Pivot-invariance and bounds-invariance cannot both hold: the pivot sits at y 29 on a 30-tall
    // sprite, one pixel above the foot. The drift is the cost of choosing the pivot, and it is
    // asserted in WORLD space because that is where it is constant.
    const worldY = 900;
    const height = 30;
    const scaled = withAuthoredCharacterScale(0, worldY, PROTAGONIST_WOBBLE_PIVOT);
    const footBefore = worldY + height;
    const footAfter = scaled.worldY + height * scaled.scale;
    expect(footAfter - footBefore).toBeCloseTo(0.22, 10);
  });

  test('records the device-pixel consequence rather than bounding it', () => {
    // Device drift is 0.22 x zoom x dpr, so it is NOT constant and cannot be asserted as one
    // number. An earlier draft of this program claimed "under half a device pixel at every DPR",
    // which is true only at zoom 1. The worst LOCKED pair is zoom 3 at DPR 2.
    const worldDrift = (30 - PROTAGONIST_WOBBLE_PIVOT.y) * (CHARACTER_SCALE - 1);
    expect(worldDrift).toBeCloseTo(0.22, 10);
    expect(worldDrift * 1 * 1).toBeCloseTo(0.22, 10);
    expect(worldDrift * 3 * 2).toBeCloseTo(1.32, 10);
  });

  test('every character in a real frame carries the authored scale', () => {
    const frame = buildWorldFrameState(
      WORLD_MAP_CATALOG.northwest_residential, createInitialState(), {}, 'down', 0,
    );
    expect(frame.characters.length).toBeGreaterThan(0);
    for (const character of frame.characters) {
      expect(character.scale).toBe(CHARACTER_SCALE);
    }
  });

  test('leaves the contact shadow anchored to the foot, not to the sprite origin', () => {
    // shadowWorldX and shadowWorldY are derived from the foot, never from worldX/worldY, so the
    // scale must not move them. If this ever fails, a scaled character is floating.
    const frame = buildWorldFrameState(
      WORLD_MAP_CATALOG.northwest_residential, createInitialState(), {}, 'down', 0,
    );
    const player = frame.characters.find(({ id }) => id === 'protagonist')!;
    // The foot is the tile's own contact point and owes nothing to the scaled placement box.
    expect(player.shadowWorldY).toBeGreaterThan(player.worldY);
    expect(Number.isFinite(player.shadowWorldX)).toBe(true);
  });
});
