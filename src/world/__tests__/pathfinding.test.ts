import { WORLD_MAP_CATALOG } from '../../application/runtime/map-catalog';
import { resolveClickTarget } from '../maps/hit-testing';
import { tileKey, type TilePoint } from '../maps/schema';
import { findPath } from '../pathfinding/astar';
import {
  advanceMovement,
  createMovementState,
  requestMovement,
  stepMovement,
  type MovementState,
} from '../pathfinding/movement';

describe('deterministic natural movement', () => {
  test('uses one stable direct diagonal route for equal inputs', () => {
    const input = {
      width: 4,
      height: 4,
      start: { x: 1, y: 1 },
      target: { x: 2, y: 2 },
      blockedKeys: new Set<string>(),
    } as const;
    const first = findPath(input);
    const second = findPath(input);
    expect(first).toEqual(second);
    expect(first).toEqual({
      status: 'found',
      path: [{ x: 2, y: 2 }],
      totalCost: 14,
      visitedNodes: 2,
    });
    if (first.status === 'found') {
      let previous: TilePoint = input.start;
      for (const tile of first.path) {
        expect(Math.max(Math.abs(tile.x - previous.x), Math.abs(tile.y - previous.y))).toBe(1);
        previous = tile;
      }
    }
  });

  test('reports blocked targets and no-route targets separately', () => {
    expect(findPath({
      width: 3,
      height: 3,
      start: { x: 0, y: 0 },
      target: { x: 1, y: 0 },
      blockedKeys: new Set(['1,0']),
    })).toEqual({ status: 'unreachable', reason: 'blocked-target', visitedNodes: 0 });
    expect(findPath({
      width: 3,
      height: 3,
      start: { x: 0, y: 0 },
      target: { x: 2, y: 2 },
      blockedKeys: new Set(['1,0', '0,1']),
    })).toEqual({ status: 'unreachable', reason: 'no-route', visitedNodes: 1 });
  });

  test.each([
    ['horizontal side', new Set(['2,1'])],
    ['vertical side', new Set(['1,2'])],
    ['both sides', new Set(['2,1', '1,2'])],
  ])('does not cut a blocked %s on a diagonal', (_label, blockedKeys) => {
    const result = findPath({
      width: 4,
      height: 4,
      start: { x: 1, y: 1 },
      target: { x: 2, y: 2 },
      blockedKeys,
    });
    expect(result.status).toBe('found');
    if (result.status !== 'found') return;
    expect(result.path[0]).not.toEqual({ x: 2, y: 2 });
    expect(result.totalCost).toBeGreaterThan(14);
  });

  test('a new click interrupts the old route and a moving blocker causes a stable wait', () => {
    const map = WORLD_MAP_CATALOG.northwest_residential;
    const start = createMovementState({ x: 18, y: 18 });
    const first = requestMovement(map, start, { x: 18, y: 20 });
    expect(first.path[0]).toEqual({ x: 18, y: 19 });
    const interrupted = requestMovement(map, first, { x: 19, y: 18 });
    expect(interrupted.target).toEqual({ x: 19, y: 18 });
    expect(interrupted.path.at(-1)).toEqual({ x: 19, y: 18 });

    const blockedNext = new Set([tileKey({ x: 18, y: 19 })]);
    const replanned = stepMovement(map, first, blockedNext);
    expect(replanned.status).toBe('waiting');
    expect(replanned.player).toEqual(start.player);
    expect(replanned.path[0]).toEqual({ x: 18, y: 19 });
    expect(replanned.path.at(-1)).toEqual({ x: 18, y: 20 });
  });

  test('plans a new route around current dynamic occupancy', () => {
    const map = WORLD_MAP_CATALOG.northwest_residential;
    const movement = requestMovement(
      map,
      createMovementState({ x: 18, y: 18 }),
      { x: 20, y: 20 },
      new Set([tileKey({ x: 19, y: 19 })]),
    );
    expect(movement.path).not.toContainEqual({ x: 19, y: 19 });
    expect(movement.path.at(-1)).toEqual({ x: 20, y: 20 });
  });

  test('replans once around a blocker that stays in the next tile', () => {
    const map = WORLD_MAP_CATALOG.northwest_residential;
    const blocker = new Set([tileKey({ x: 18, y: 19 })]);
    let movement = requestMovement(map, createMovementState({ x: 18, y: 18 }), { x: 18, y: 20 });
    for (let attempt = 0; attempt < 12; attempt += 1) {
      movement = advanceMovement(map, movement, 50, 1, blocker).movement;
    }
    expect(movement.path[0]).not.toEqual({ x: 18, y: 19 });
    expect(movement.blockedReplanAttempted).toBe(false);
    expect(movement.status).toBe('moving');
  });

  test('uses a stable yield route after four failed claims when the target is still occupied', () => {
    const map = WORLD_MAP_CATALOG.northwest_residential;
    const blocker = new Set([tileKey({ x: 18, y: 19 }), tileKey({ x: 18, y: 20 })]);
    let movement = requestMovement(map, createMovementState({ x: 18, y: 18 }), { x: 18, y: 20 });
    for (let attempt = 0; attempt < 12; attempt += 1) {
      movement = advanceMovement(map, movement, 50, 1, blocker).movement;
    }
    expect(movement.blockedAttempts).toBe(0);
    expect(movement.resumeTarget).toEqual({ x: 18, y: 20 });
    expect(movement.target).not.toEqual(movement.resumeTarget);
    expect(movement.status).toBe('moving');
  });

  test('keeps the original goal through a second yield search', () => {
    const map = WORLD_MAP_CATALOG.northwest_residential;
    const originalTarget = { x: 22, y: 22 };
    const blocker = new Set([tileKey({ x: 18, y: 19 }), tileKey({ x: 18, y: 20 })]);
    let movement: MovementState = {
      ...requestMovement(map, createMovementState({ x: 18, y: 18 }), { x: 18, y: 20 }),
      resumeTarget: originalTarget,
    };
    for (let attempt = 0; attempt < 12; attempt += 1) {
      movement = advanceMovement(map, movement, 50, 1, blocker).movement;
    }
    expect(movement.resumeTarget).toEqual(originalTarget);
    expect(movement.target).not.toEqual(originalTarget);
    expect(movement.status).toBe('moving');
  });

  test('keeps a started corner curve latched after a replacement click', () => {
    const map = WORLD_MAP_CATALOG.northwest_residential;
    let movement: MovementState = {
      ...createMovementState({ x: 18, y: 18 }),
      target: { x: 19, y: 19 },
      path: [{ x: 18, y: 19 }, { x: 19, y: 19 }],
      status: 'moving' as const,
    };
    movement = advanceMovement(map, movement, 50).movement;
    movement = advanceMovement(map, movement, 50).movement;
    movement = advanceMovement(map, movement, 20).movement;
    expect(movement.latchedTurnCurve).toBeDefined();
    const beforeClickX = movement.visualFoot.x;
    movement = requestMovement(map, movement, { x: 17, y: 19 });
    movement = advanceMovement(map, movement, 5).movement;
    expect(movement.latchedTurnCurve).toBeDefined();
    expect(movement.visualFoot.x).toBeGreaterThanOrEqual(beforeClickX);
  });

  test('starts each new route on the first gait frame', () => {
    const map = WORLD_MAP_CATALOG.northwest_residential;
    let movement = requestMovement(map, createMovementState({ x: 18, y: 18 }), { x: 18, y: 19 });
    for (let index = 0; index < 4; index += 1) movement = advanceMovement(map, movement, 50).movement;
    expect(movement.status).toBe('idle');
    expect(movement.travelDistance).toBe(0);
    movement = requestMovement(map, movement, { x: 19, y: 19 });
    movement = advanceMovement(map, movement, 16).movement;
    expect(movement.walkFrame).toBe(0);
  });

  test('click priority is UI, NPC, object, interaction, then floor with stable ID ties', () => {
    const candidates = [
      { id: 'floor', kind: 'floor' as const },
      { id: 'interaction', kind: 'interaction' as const },
      { id: 'z-npc', kind: 'npc' as const },
      { id: 'a-npc', kind: 'npc' as const },
      { id: 'object', kind: 'object' as const },
    ];
    expect(resolveClickTarget(candidates)?.id).toBe('a-npc');
    expect(resolveClickTarget([...candidates, { id: 'hud', kind: 'ui' as const }])?.id).toBe('hud');
  });
});
