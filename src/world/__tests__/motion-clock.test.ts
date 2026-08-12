import { WORLD_MAP_CATALOG } from '../../application/runtime/map-catalog';
import {
  CARDINAL_SEGMENT_MS,
  DIAGONAL_SEGMENT_MS,
  snapWorldPoint,
  tileFootPoint,
} from '../movement/motion-clock';
import {
  advanceMovement,
  cancelMovement,
  createMovementState,
  requestMovement,
} from '../pathfinding/movement';

const MAP = WORLD_MAP_CATALOG.northwest_residential;

describe('continuous movement clock', () => {
  test('samples more than five positions before one cardinal tile commits', () => {
    let movement = requestMovement(MAP, createMovementState({ x: 18, y: 18 }), { x: 18, y: 19 });
    const samples: number[] = [];
    for (let sample = 0; sample < 7; sample += 1) {
      const result = advanceMovement(MAP, movement, 16);
      movement = result.movement;
      samples.push(movement.visualFoot.y);
      if (result.committedTiles.length > 0) break;
    }
    expect(new Set(samples).size).toBeGreaterThanOrEqual(5);
    expect(movement.player).toEqual({ x: 18, y: 18 });
    const final = advanceMovement(MAP, movement, 50);
    expect(final.committedTiles).toEqual([{ x: 18, y: 19 }]);
    expect(final.movement.player).toEqual({ x: 18, y: 19 });
  });

  test('uses true-distance diagonal timing and rear facing for upward diagonals', () => {
    let movement = requestMovement(MAP, createMovementState({ x: 18, y: 18 }), { x: 19, y: 17 });
    let committedAt = 0;
    for (let index = 0; index < 20; index += 1) {
      const result = advanceMovement(MAP, movement, 16);
      movement = result.movement;
      committedAt += 16;
      if (result.committedTiles.length > 0) break;
    }
    expect(DIAGONAL_SEGMENT_MS).toBe(205);
    expect(committedAt).toBeGreaterThanOrEqual(DIAGONAL_SEGMENT_MS);
    expect(movement.direction).toBe('up');
    expect(movement.player).toEqual({ x: 19, y: 17 });
  });

  test('clamps a long frame and preserves progress while paused', () => {
    const requested = requestMovement(MAP, createMovementState({ x: 18, y: 18 }), { x: 18, y: 19 });
    const clamped = advanceMovement(MAP, requested, 10_000).movement;
    expect(clamped.segment?.elapsedMs).toBe(50);
    const paused = advanceMovement(MAP, clamped, 50, 0).movement;
    expect(paused).toEqual(clamped);
  });

  test('finishes the active segment before an interrupt or stop', () => {
    let movement = requestMovement(MAP, createMovementState({ x: 18, y: 18 }), { x: 18, y: 20 });
    movement = advanceMovement(MAP, movement, 32).movement;
    const visualBefore = movement.visualFoot;
    movement = requestMovement(MAP, movement, { x: 19, y: 19 });
    expect(movement.visualFoot).toEqual(visualBefore);
    expect(movement.pendingTarget).toEqual({ x: 19, y: 19 });
    movement = cancelMovement(movement);
    expect(movement.stopAfterSegment).toBe(true);
    while (movement.segment) movement = advanceMovement(MAP, movement, 50).movement;
    expect(movement.status).toBe('idle');
    expect(movement.visualFoot).toEqual(tileFootPoint(movement.player));
  });

  test('snaps presentation to physical pixels without changing world authority', () => {
    expect(snapWorldPoint({ x: 10.24, y: 20.76 }, 1, 2)).toEqual({ x: 10, y: 21 });
    expect(snapWorldPoint({ x: 10.24, y: 20.76 }, 1.5, 2)).toEqual({
      x: 10.333333333333334,
      y: 20.666666666666668,
    });
    expect(snapWorldPoint({ x: 10.24, y: 20.76 }, 2, 2)).toEqual({ x: 10.25, y: 20.75 });
    expect(snapWorldPoint({ x: 10.24, y: 20.76 }, 3, 2)).toEqual({ x: 10.166666666666666, y: 20.833333333333332 });
  });
});
