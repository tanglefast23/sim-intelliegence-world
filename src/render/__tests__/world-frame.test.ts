import northwestMapJson from '../../../content/maps/northwest.json';
import { createInitialState } from '../../domain/state/initial-state';
import { WorldStateSchema } from '../../domain/state/schema';
import { compileWorldMap, spawnAt } from '../../world/maps/schema';
import { createMovementState, requestMovement } from '../../world/pathfinding/movement';
import { advanceWorldMovement } from '../../application/runtime/world-runtime';
import { ATLAS_INDEX } from '../atlas';
import { WORLD_DEPTH } from '../depth';
import { buildWorldFrameState, WORLD_LAYER_ORDER } from '../world-frame';

const MAP = compileWorldMap(northwestMapJson, new Set(ATLAS_INDEX.tiles));
const ACTORS = {
  linda: spawnAt(MAP, 'linda'),
  'generic-resident': spawnAt(MAP, 'generic-resident'),
} as const;

function walkTo(target: { x: number; y: number }, initialState = createInitialState()) {
  let worldState = initialState;
  let movement = requestMovement(
    MAP,
    createMovementState({
      x: worldState.protagonist.worldPosition.tileX,
      y: worldState.protagonist.worldPosition.tileY,
    }),
    target,
  );
  while (movement.status === 'moving') {
    ({ movement, worldState } = advanceWorldMovement(MAP, movement, worldState));
  }
  return { movement, worldState };
}

describe('authoritative world frame', () => {
  test('uses the explicit floor-to-roof depth contract', () => {
    expect(WORLD_LAYER_ORDER.map((name) => WORLD_DEPTH[name])).toEqual([10, 20, 30, 40, 50, 60, 70]);
    expect(buildWorldFrameState(MAP, createInitialState(), ACTORS, 'down', 0).layerOrder).toEqual(WORLD_LAYER_ORDER);
  });

  test('sorts same-layer characters by tile row and stable ID before drawing', () => {
    const frame = buildWorldFrameState(MAP, createInitialState(), {
      linda: { x: 23, y: 30 },
      'generic-resident': { x: 29, y: 5 },
    }, 'down', 0);
    expect(frame.characters.map(({ id }) => id)).toEqual([
      'generic-resident', 'protagonist', 'linda',
    ]);
  });

  test('save and reload inside reconstruct the byte-identical first frame', () => {
    const inside = walkTo({ x: 16, y: 23 });
    const savedBytes = JSON.stringify(inside.worldState);
    const loaded = WorldStateSchema.parse(JSON.parse(savedBytes) as unknown);
    const before = buildWorldFrameState(MAP, inside.worldState, ACTORS, inside.movement.direction, 0);
    const after = buildWorldFrameState(MAP, loaded, ACTORS, inside.movement.direction, 0);
    expect(after.signature).toBe(before.signature);
    expect(after.hiddenRoofGroupId).toBe('protagonist-villa-roof');
    expect(loaded.protagonist.worldPosition).toEqual({ mapId: 'northwest_residential', tileX: 16, tileY: 23 });
  });

  test('leaving through the pathfindable door restores the roof only outside', () => {
    const doorway = walkTo({ x: 15, y: 24 });
    expect(buildWorldFrameState(MAP, doorway.worldState, ACTORS, doorway.movement.direction, 0).hiddenRoofGroupId)
      .toBe('protagonist-villa-roof');
    const outside = walkTo({ x: 15, y: 25 }, doorway.worldState);
    const outsideFrame = buildWorldFrameState(MAP, outside.worldState, ACTORS, outside.movement.direction, 0);
    expect(outsideFrame.hiddenRoofGroupId).toBeUndefined();
    expect(outsideFrame.visibleRoofGroupIds).toEqual(['protagonist-villa-roof']);
  });

  test('every committed movement event is one cardinal tile and state-owned', () => {
    const result = walkTo({ x: 21, y: 18 });
    expect(result.worldState.protagonist.worldPosition).toEqual({
      mapId: 'northwest_residential', tileX: 21, tileY: 18,
    });
    expect(result.worldState.eventLedger).toHaveLength(3);
    for (const event of result.worldState.eventLedger) {
      expect(event.type).toBe('protagonist-moved');
      if (event.type === 'protagonist-moved') {
        expect(Math.abs(event.toTileX - event.fromTileX) + Math.abs(event.toTileY - event.fromTileY)).toBe(1);
      }
    }
  });
});
