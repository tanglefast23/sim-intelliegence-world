import { WORLD_MAP_CATALOG } from '../../application/runtime/map-catalog';
import { segmentLength, tileFootPoint } from '../../world/movement/motion-clock';
import { TURN_RADIUS, type TurnCurve } from '../../world/movement/turn-curve';
import {
  advanceMovement,
  createMovementState,
  requestMovement,
  type MovementState,
} from '../../world/pathfinding/movement';
import {
  actorFootPlant,
  gaitAngleDegrees,
  gaitBobPixels,
  gaitStopLeanDegrees,
  gaitStridePhase,
  gaitTurnLeanDegrees,
  MAX_COMPOSED_ANGLE_DEGREES,
  STRIDE_PIXELS,
  TURN_LEAN_DEGREES,
} from '../gait';

const MAP = WORLD_MAP_CATALOG.northwest_residential;

function bob(travelDistance: number, overrides: Partial<Parameters<typeof gaitBobPixels>[0]> = {}) {
  return gaitBobPixels({ travelDistance, moving: true, reducedMotion: false, ...overrides });
}

/** Replays a route at a fixed 16 ms step, exactly as the deterministic evidence trace does. */
function replay(steps = 220): MovementState[] {
  let movement = requestMovement(MAP, createMovementState({ x: 18, y: 18 }), { x: 22, y: 22 });
  const frames: MovementState[] = [];
  for (let step = 0; step < steps; step += 1) {
    movement = advanceMovement(MAP, movement, 16).movement;
    frames.push(movement);
    if (movement.status === 'idle') break;
  }
  return frames;
}

describe('gait stride phase and bob', () => {
  test('is literal zero at every contact, and while standing still', () => {
    for (const distance of [0, STRIDE_PIXELS, 64, 96, 128]) {
      expect(bob(distance)).toBe(0);
      expect(gaitStridePhase(distance)).toBe(0);
    }
    expect(bob(16, { moving: false })).toBe(0);
    expect(bob(16, { reducedMotion: true })).toBe(0);
  });

  test('dips into the down pose after contact and peaks at the passing pose', () => {
    // The researched walk cycle: hips LOWEST just after the foot plants, HIGHEST at passing.
    // +y is down, so the down pose is positive and the passing pose is negative.
    expect(bob(0.1 * STRIDE_PIXELS)).toBeCloseTo(0.391, 3);
    expect(bob(0.25 * STRIDE_PIXELS)).toBeCloseTo(0.051, 3);
    expect(bob(0.5 * STRIDE_PIXELS)).toBeCloseTo(-1.2, 6);
    expect(bob(0.75 * STRIDE_PIXELS)).toBeCloseTo(-0.949, 3);
    for (let phase = 0.02; phase < 0.2; phase += 0.02) {
      expect(bob(phase * STRIDE_PIXELS)).toBeGreaterThan(0);
    }
  });

  test('wraps without a seam and stays inside two world pixels peak to peak', () => {
    expect(Math.abs(bob(STRIDE_PIXELS * 0.9999) - bob(0))).toBeLessThan(0.01);
    let low = 0;
    let high = 0;
    for (let step = 0; step < 2_000; step += 1) {
      const value = bob((step / 2_000) * STRIDE_PIXELS);
      low = Math.min(low, value);
      high = Math.max(high, value);
    }
    expect(high - low).toBeLessThanOrEqual(2);
  });

  test('repeats every stride, so the cycle is a true loop', () => {
    for (const phase of [0.13, 0.37, 0.61, 0.88]) {
      expect(bob((3 + phase) * STRIDE_PIXELS)).toBeCloseTo(bob(phase * STRIDE_PIXELS), 12);
    }
  });
});

describe('gait turn lean', () => {
  // A corner at (10, 10) entered heading right and left heading down.
  const rightThenDown: TurnCurve = {
    start: { x: 330, y: 349 },
    control: { x: 336, y: 349 },
    end: { x: 336, y: 355 },
    touchedTileKeys: [],
  };
  const rightThenUp: TurnCurve = { ...rightThenDown, end: { x: 336, y: 343 } };
  const downThenRight: TurnCurve = {
    start: { x: 336, y: 343 },
    control: { x: 336, y: 349 },
    end: { x: 342, y: 349 },
    touchedTileKeys: [],
  };

  test('leans toward the inside of the corner, with the sign pinned', () => {
    // Travelling right and turning down: the arc curves away to the left in screen x, so the body
    // must tip LEFT (negative). Asserting the sign by value, because an outward lean would still
    // "flip with handedness" and would still be wrong.
    expect(gaitTurnLeanDegrees({
      turnCurve: rightThenDown, foot: rightThenDown.control, reducedMotion: false,
    })).toBe(-TURN_LEAN_DEGREES);
    expect(gaitTurnLeanDegrees({
      turnCurve: rightThenUp, foot: rightThenUp.control, reducedMotion: false,
    })).toBe(-TURN_LEAN_DEGREES);
    // Travelling down and turning right: the arc curves to the right, so the body tips RIGHT.
    expect(gaitTurnLeanDegrees({
      turnCurve: downThenRight, foot: downThenRight.control, reducedMotion: false,
    })).toBe(TURN_LEAN_DEGREES);
  });

  test('peaks at the apex and self-cancels on the way out', () => {
    // The apex of a 90-degree corner sits hypot(1.5, 1.5) = 2.12 px from the control point, so the
    // ramp cannot reach 1. This is why the constant is 9 rather than 6.
    const apex = {
      x: 0.25 * rightThenDown.start.x + 0.5 * rightThenDown.control.x + 0.25 * rightThenDown.end.x,
      y: 0.25 * rightThenDown.start.y + 0.5 * rightThenDown.control.y + 0.25 * rightThenDown.end.y,
    };
    const atApex = gaitTurnLeanDegrees({ turnCurve: rightThenDown, foot: apex, reducedMotion: false });
    expect(Math.abs(atApex)).toBeCloseTo(5.818, 2);
    expect(gaitTurnLeanDegrees({
      turnCurve: rightThenDown,
      foot: { x: rightThenDown.control.x - TURN_RADIUS, y: rightThenDown.control.y },
      reducedMotion: false,
    })).toBe(0);
  });

  test('is literal zero without a curve and under reduced motion', () => {
    const foot = rightThenDown.control;
    expect(gaitTurnLeanDegrees({ turnCurve: undefined, foot, reducedMotion: false })).toBe(0);
    expect(gaitTurnLeanDegrees({ turnCurve: rightThenDown, foot, reducedMotion: true })).toBe(0);
  });
});

describe('gait stop lean', () => {
  const stop = (stopProgress: number | undefined, direction: 'left' | 'right' | 'up' = 'right') =>
    gaitStopLeanDegrees({ direction, stopProgress, reducedMotion: false });

  test('reaches exactly zero as the actor arrives, so the stop cannot pop', () => {
    // q = 1 is the frame `status` flips to idle. A q^2 envelope would peak here and snap to zero,
    // which is a visible three-pixel pop at every horizontal stop.
    expect(stop(1)).toBe(0);
    expect(stop(0)).toBe(0);
  });

  test('peaks at two thirds through the final segment, pitched back against travel', () => {
    expect(stop(2 / 3)).toBeCloseTo(-5, 6);
    expect(stop(2 / 3, 'left')).toBeCloseTo(5, 6);
    for (const q of [0.2, 0.4, 0.55, 0.8, 0.95]) {
      expect(Math.abs(stop(q))).toBeLessThan(Math.abs(stop(2 / 3)));
    }
  });

  test('is literal zero off the final segment, vertically, and under reduced motion', () => {
    expect(stop(undefined)).toBe(0);
    expect(stop(0.5, 'up')).toBe(0);
    expect(gaitStopLeanDegrees({ direction: 'right', stopProgress: 0.5, reducedMotion: true })).toBe(0);
  });
});

describe('composed angle', () => {
  test('caps the total, because the shipped wobble alone already reaches fifteen degrees', () => {
    expect(gaitAngleDegrees(15, 9, 5)).toBe(MAX_COMPOSED_ANGLE_DEGREES);
    expect(gaitAngleDegrees(-15, -9, -5)).toBe(-MAX_COMPOSED_ANGLE_DEGREES);
    expect(gaitAngleDegrees(4, -1, 0.5)).toBeCloseTo(3.5, 12);
  });
});

describe('foot plants', () => {
  test('fire once per stride and alternate feet in step with walkFrame', () => {
    const frames = replay().filter((movement) => movement.status === 'moving' && movement.segment);
    expect(frames.length).toBeGreaterThan(10);
    for (const movement of frames) {
      const plant = actorFootPlant('protagonist', movement)!;
      expect(plant.index).toBe(Math.floor(movement.travelDistance / STRIDE_PIXELS));
      expect(plant.foot).toBe(movement.walkFrame);
      expect(plant.distanceSincePixels).toBeGreaterThanOrEqual(0);
      expect(plant.distanceSincePixels).toBeLessThan(STRIDE_PIXELS);
      expect(plant.direction).toBe(movement.direction);
    }
    const indices = [...new Set(frames.map((movement) => (
      actorFootPlant('protagonist', movement)!.index
    )))];
    expect(indices.length).toBeGreaterThanOrEqual(3);
  });

  test('back-projects the contact point exactly on a mid-route segment', () => {
    // Exact ONLY mid-route: on a route's first and last segment the foot advances at eased progress
    // while travelDistance accumulates linearly, so the two diverge by up to about 4.8 px.
    const midRoute = replay().find((movement) => {
      const segment = movement.segment;
      if (!segment || movement.status !== 'moving') return false;
      const beyondFirst = movement.travelDistance > segmentLength(segment.from, segment.to);
      return beyondFirst && movement.path.length > 1 && !movement.latchedTurnCurve;
    })!;
    expect(midRoute).toBeDefined();
    const segment = midRoute.segment!;
    const from = tileFootPoint(segment.from);
    const to = tileFootPoint(segment.to);
    const length = segmentLength(segment.from, segment.to);
    const plant = actorFootPlant('protagonist', midRoute)!;
    expect(plant.worldX).toBeCloseTo(
      midRoute.visualFoot.x - ((to.x - from.x) / length) * plant.distanceSincePixels, 9,
    );
    expect(plant.worldY).toBeCloseTo(
      midRoute.visualFoot.y - ((to.y - from.y) / length) * plant.distanceSincePixels, 9,
    );
  });

  test('is undefined when the actor is not walking', () => {
    expect(actorFootPlant('protagonist', createMovementState({ x: 18, y: 18 }))).toBeUndefined();
  });
});

describe('determinism', () => {
  test('never mutates the movement state it reads', () => {
    const movement = replay().find(({ status }) => status === 'moving')!;
    const before = JSON.stringify(movement);
    gaitBobPixels({ travelDistance: movement.travelDistance, moving: true, reducedMotion: false });
    gaitTurnLeanDegrees({
      turnCurve: movement.latchedTurnCurve, foot: movement.visualFoot, reducedMotion: false,
    });
    gaitStopLeanDegrees({ direction: movement.direction, stopProgress: 0.5, reducedMotion: false });
    actorFootPlant('protagonist', movement);
    expect(JSON.stringify(movement)).toBe(before);
  });

  test('two fixed-step replays produce byte-identical gait output', () => {
    const sample = (frames: readonly MovementState[]) => frames.map((movement) => ({
      bob: gaitBobPixels({
        travelDistance: movement.travelDistance,
        moving: movement.status === 'moving',
        reducedMotion: false,
      }),
      turn: gaitTurnLeanDegrees({
        turnCurve: movement.latchedTurnCurve, foot: movement.visualFoot, reducedMotion: false,
      }),
      plant: actorFootPlant('protagonist', movement) ?? null,
    }));
    expect(JSON.stringify(sample(replay()))).toBe(JSON.stringify(sample(replay())));
  });
});
