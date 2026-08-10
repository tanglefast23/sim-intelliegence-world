import northwestMapJson from '../../../content/maps/northwest.json';
import { ATLAS_INDEX } from '../../render/atlas';
import { resolveClickTarget } from '../maps/hit-testing';
import { compileWorldMap, tileKey, type TilePoint } from '../maps/schema';
import { findCardinalPath } from '../pathfinding/astar';
import { createMovementState, requestMovement, stepMovement } from '../pathfinding/movement';

describe('deterministic cardinal movement', () => {
  test('uses one stable route for equal-cost ties and never adds a diagonal', () => {
    const input = {
      width: 4,
      height: 4,
      start: { x: 1, y: 1 },
      target: { x: 2, y: 2 },
      blockedKeys: new Set<string>(),
    } as const;
    const first = findCardinalPath(input);
    const second = findCardinalPath(input);
    expect(first).toEqual(second);
    expect(first).toEqual({
      status: 'found',
      path: [{ x: 2, y: 1 }, { x: 2, y: 2 }],
      visitedNodes: 3,
    });
    if (first.status === 'found') {
      let previous: TilePoint = input.start;
      for (const tile of first.path) {
        expect(Math.abs(tile.x - previous.x) + Math.abs(tile.y - previous.y)).toBe(1);
        previous = tile;
      }
    }
  });

  test('reports blocked targets and no-route targets separately', () => {
    expect(findCardinalPath({
      width: 3,
      height: 3,
      start: { x: 0, y: 0 },
      target: { x: 1, y: 0 },
      blockedKeys: new Set(['1,0']),
    })).toEqual({ status: 'unreachable', reason: 'blocked-target', visitedNodes: 0 });
    expect(findCardinalPath({
      width: 3,
      height: 3,
      start: { x: 0, y: 0 },
      target: { x: 2, y: 2 },
      blockedKeys: new Set(['1,0', '0,1']),
    })).toEqual({ status: 'unreachable', reason: 'no-route', visitedNodes: 1 });
  });

  test('a new click interrupts the old route and a moving blocker causes a replan', () => {
    const map = compileWorldMap(northwestMapJson, new Set(ATLAS_INDEX.tiles));
    const start = createMovementState({ x: 18, y: 18 });
    const first = requestMovement(map, start, { x: 18, y: 21 });
    expect(first.path[0]).toEqual({ x: 18, y: 19 });
    const interrupted = requestMovement(map, first, { x: 20, y: 18 });
    expect(interrupted.target).toEqual({ x: 20, y: 18 });
    expect(interrupted.path.at(-1)).toEqual({ x: 20, y: 18 });

    const blockedNext = new Set([tileKey({ x: 18, y: 19 })]);
    const replanned = stepMovement(map, first, blockedNext);
    expect(replanned.status).toBe('moving');
    expect(replanned.player).toEqual(start.player);
    expect(replanned.path[0]).not.toEqual({ x: 18, y: 19 });
    expect(replanned.path.at(-1)).toEqual({ x: 18, y: 21 });
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
