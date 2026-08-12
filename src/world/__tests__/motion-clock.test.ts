import { WORLD_MAP_CATALOG } from '../../application/runtime/map-catalog';
import {
  CARDINAL_SEGMENT_MS,
  DIAGONAL_SEGMENT_MS,
  routeMotionProgress,
  snapWorldPoint,
  tileFootPoint,
} from '../movement/motion-clock';
import { tileKey } from '../maps/schema';
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
    for (let sample = 0; sample < 9; sample += 1) {
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
    expect(DIAGONAL_SEGMENT_MS).toBe(256.25);
    expect(committedAt).toBeGreaterThanOrEqual(DIAGONAL_SEGMENT_MS);
    expect(movement.direction).toBe('up');
    expect(movement.player).toEqual({ x: 19, y: 17 });
  });

  test('slows world travel by twenty percent', () => {
    expect(CARDINAL_SEGMENT_MS).toBe(181.25);
    expect(32 / CARDINAL_SEGMENT_MS).toBeCloseTo((32 / 145) * 0.8, 12);
  });

  test('eases only route starts and final stops while preserving exact endpoints', () => {
    expect(routeMotionProgress(0, true, true)).toBe(0);
    expect(routeMotionProgress(1, true, true)).toBe(1);
    expect(routeMotionProgress(0.25, true, false)).toBeLessThan(0.25);
    expect(routeMotionProgress(0.5, false, false)).toBe(0.5);
    expect(routeMotionProgress(0.75, false, true)).toBeGreaterThan(0.75);
  });

  test('keeps ease-in continuous across consecutive render frames', () => {
    const movement = requestMovement(MAP, createMovementState({ x: 2, y: 2 }), { x: 4, y: 2 });
    const first = advanceMovement(MAP, movement, 16).movement;
    const second = advanceMovement(MAP, first, 16).movement;
    const linearSecondX = tileFootPoint({ x: 2, y: 2 }).x + 32 * (32 / CARDINAL_SEGMENT_MS);
    expect(first.visualFoot.x).toBeGreaterThan(tileFootPoint({ x: 2, y: 2 }).x);
    expect(second.visualFoot.x).toBeGreaterThan(first.visualFoot.x);
    expect(second.visualFoot.x).toBeLessThan(linearSecondX);
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

  test('tracks pure horizontal runs across exact cardinal boundaries', () => {
    let movement = requestMovement(MAP, createMovementState({ x: 2, y: 2 }), { x: 6, y: 2 });
    const committedDistances: number[] = [];
    for (let index = 0; index < 80 && committedDistances.length < 3; index += 1) {
      const result = advanceMovement(MAP, movement, 16);
      movement = result.movement;
      if (result.committedTiles.length > 0) committedDistances.push(movement.horizontalRunDistance);
    }
    expect(committedDistances).toEqual([32, 64, 96]);
  });

  test('carries only a same-direction pending horizontal retarget', () => {
    let sameDirection = requestMovement(MAP, createMovementState({ x: 2, y: 2 }), { x: 4, y: 2 });
    sameDirection = advanceMovement(MAP, sameDirection, 32).movement;
    sameDirection = requestMovement(MAP, sameDirection, { x: 5, y: 2 });
    while (sameDirection.player.x === 2) sameDirection = advanceMovement(MAP, sameDirection, 50).movement;
    expect(sameDirection.direction).toBe('right');
    expect(sameDirection.horizontalRunDistance).toBe(32);

    let opposite = requestMovement(MAP, createMovementState({ x: 4, y: 2 }), { x: 6, y: 2 });
    opposite = advanceMovement(MAP, opposite, 32).movement;
    opposite = requestMovement(MAP, opposite, { x: 2, y: 2 });
    while (opposite.player.x === 4) opposite = advanceMovement(MAP, opposite, 50).movement;
    expect(opposite.direction).toBe('right');
    expect(opposite.horizontalRunDistance).toBe(0);
    opposite = advanceMovement(MAP, opposite, 16).movement;
    expect(opposite.direction).toBe('left');
    expect(opposite.horizontalRunDistance).toBeGreaterThan(0);
  });

  test('preserves active cancellation through commit, then resets the run', () => {
    let movement = requestMovement(MAP, createMovementState({ x: 2, y: 2 }), { x: 4, y: 2 });
    movement = advanceMovement(MAP, movement, 16).movement;
    const beforeCancel = movement.horizontalRunDistance;
    movement = cancelMovement(movement);
    expect(movement.horizontalRunDistance).toBe(beforeCancel);
    movement = advanceMovement(MAP, movement, 16).movement;
    expect(movement.horizontalRunDistance).toBeGreaterThan(beforeCancel);
    while (movement.segment) movement = advanceMovement(MAP, movement, 50).movement;
    expect(movement.status).toBe('idle');
    expect(movement.horizontalRunDistance).toBe(0);
  });

  test('resets before-start and blocked-at-commit waiting states', () => {
    const blocker = new Set([tileKey({ x: 3, y: 2 })]);
    const requested = requestMovement(MAP, createMovementState({ x: 2, y: 2 }), { x: 4, y: 2 });
    const blockedBeforeStart = advanceMovement(MAP, requested, 16, 1, blocker).movement;
    expect(blockedBeforeStart.status).toBe('waiting');
    expect(blockedBeforeStart.horizontalRunDistance).toBe(0);

    let blockedAtCommit = advanceMovement(MAP, requested, 32).movement;
    expect(blockedAtCommit.horizontalRunDistance).toBeGreaterThan(0);
    while (blockedAtCommit.segment?.elapsedMs !== blockedAtCommit.segment?.durationMs) {
      const result = advanceMovement(MAP, blockedAtCommit, 50, 1, blocker);
      blockedAtCommit = result.movement;
      if (blockedAtCommit.status === 'waiting') break;
    }
    expect(blockedAtCommit.status).toBe('waiting');
    expect(blockedAtCommit.horizontalRunDistance).toBe(0);
  });

  test('snaps presentation to physical pixels without changing world authority', () => {
    expect(snapWorldPoint({ x: 10.24, y: 20.76 }, 1, 2)).toEqual({ x: 10, y: 21 });
    expect(snapWorldPoint({ x: 10.24, y: 20.76 }, 2, 2)).toEqual({ x: 10.25, y: 20.75 });
    expect(snapWorldPoint({ x: 10.24, y: 20.76 }, 3, 2)).toEqual({ x: 10.166666666666666, y: 20.833333333333332 });
  });
});
