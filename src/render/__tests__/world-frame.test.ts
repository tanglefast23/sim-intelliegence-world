import { WORLD_MAP_CATALOG } from '../../application/runtime/map-catalog';
import { createInitialState } from '../../domain/state/initial-state';
import { WorldStateSchema } from '../../domain/state/schema';
import { createMovementState, requestMovement } from '../../world/pathfinding/movement';
import { advanceWorldMovement } from '../../application/runtime/world-runtime';
import { WORLD_DEPTH } from '../depth';
import { buildWorldFrameState, WORLD_LAYER_ORDER } from '../world-frame';

const MAP = WORLD_MAP_CATALOG.northwest_residential;
const ACTORS = {
  linda: { tile: MAP.source.spawns.linda!, visualId: 'linda' },
  generic_resident: { tile: MAP.source.spawns.generic_resident!, visualId: 'generic-resident' },
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
      linda: { tile: { x: 23, y: 30 }, visualId: 'linda' },
      generic_resident: { tile: { x: 29, y: 5 }, visualId: 'generic-resident' },
    }, 'down', 0);
    expect(frame.characters.map(({ id }) => id)).toEqual([
      'generic_resident', 'protagonist', 'linda',
    ]);
  });

  test('uses independent continuous anchors, directions, and foot frames per actor', () => {
    const frame = buildWorldFrameState(MAP, createInitialState(), {
      linda: {
        tile: { x: 23, y: 30 },
        visualId: 'linda',
        direction: 'left',
        visualFoot: { x: 748.5, y: 988 },
        walkFrame: 1,
        moving: true,
      },
    }, 'up', 0, {
      visualFoot: { x: 592, y: 606.5 },
      walkFrame: 0,
      moving: true,
      reducedMotion: false,
      horizontalRunDistance: 16,
    });
    const player = frame.characters.find(({ id }) => id === 'protagonist')!;
    const linda = frame.characters.find(({ id }) => id === 'linda')!;
    expect(player.sprite).toContain('.rear-1');
    expect(linda.sprite).toContain('.left-2');
    expect(player.worldY).not.toBe(Math.round(player.worldY));
    expect(linda.worldX).not.toBe(Math.round(linda.worldX));
    expect(player.angleDegrees).toBe(0);
    expect(linda.angleDegrees).toBe(0);
  });

  test('rotates every rounded character during a pure horizontal run', () => {
    const frame = buildWorldFrameState(MAP, createInitialState(), {
      linda: {
        tile: { x: 23, y: 30 },
        visualId: 'linda',
        direction: 'right',
        visualFoot: { x: 752, y: 989 },
        walkFrame: 1,
        moving: true,
        horizontalRunDistance: 16,
      },
    }, 'right', 1, {
      visualFoot: { x: 592, y: 606 },
      walkFrame: 1,
      moving: true,
      reducedMotion: false,
      horizontalRunDistance: 16,
    });
    const player = frame.characters.find(({ id }) => id === 'protagonist')!;
    const linda = frame.characters.find(({ id }) => id === 'linda')!;
    expect(player.angleDegrees).toBeCloseTo(10.416666, 5);
    expect(player.worldX).toBe(581);
    expect(player.worldY).toBe(578);
    expect(player.shadowWorldX).toBe(586);
    expect(linda.angleDegrees).toBeCloseTo(10.416666, 5);
    expect(linda.worldX).toBe(741);
    expect(linda.worldY).toBe(961);
    expect(linda.shadowWorldX).toBe(746);
  });

  test('reduced motion keeps horizontal travel upright without moving the shadow', () => {
    const frame = buildWorldFrameState(MAP, createInitialState(), {}, 'left', 0, {
      visualFoot: { x: 584, y: 606 },
      walkFrame: 0,
      moving: true,
      reducedMotion: true,
      horizontalRunDistance: 16,
    });
    const player = frame.characters.find(({ id }) => id === 'protagonist')!;
    expect(player.angleDegrees).toBe(0);
    expect(player.worldX).toBe(572);
    expect(player.worldY).toBe(579);
    expect(player.shadowWorldX).toBe(577);
  });

  test('uses restrained talk and reaction poses before adding more walk frames', () => {
    const reaction = buildWorldFrameState(MAP, createInitialState(), {
      linda: { tile: { x: 23, y: 30 }, visualId: 'linda', pose: 'reaction', poseFrame: 1 },
    }, 'down', 0).characters.find(({ id }) => id === 'linda')!;
    const talk = buildWorldFrameState(MAP, createInitialState(), {
      linda: { tile: { x: 23, y: 30 }, visualId: 'linda', pose: 'talk', poseFrame: 1 },
    }, 'down', 0).characters.find(({ id }) => id === 'linda')!;
    const reduced = buildWorldFrameState(MAP, createInitialState(), {
      linda: { tile: { x: 23, y: 30 }, visualId: 'linda', pose: 'reaction', poseFrame: 1, reducedMotion: true },
    }, 'down', 0).characters.find(({ id }) => id === 'linda')!;
    expect(reaction).toMatchObject({ angleDegrees: -4, worldY: 959 });
    expect(talk).toMatchObject({ angleDegrees: 2, worldY: 960 });
    expect(reduced).toMatchObject({ angleDegrees: 0, worldY: 962 });
  });

  test('save and reload inside reconstruct the byte-identical first frame', () => {
    const inside = walkTo({ x: 16, y: 23 });
    const savedBytes = JSON.stringify(inside.worldState);
    const loaded = WorldStateSchema.parse(JSON.parse(savedBytes) as unknown);
    const before = buildWorldFrameState(MAP, inside.worldState, ACTORS, inside.movement.direction, 0);
    const after = buildWorldFrameState(MAP, loaded, ACTORS, inside.movement.direction, 0);
    expect(after).toEqual(before);
    expect(after.hiddenRoofGroupId).toBe('protagonist-villa-roof');
    expect(loaded.protagonist.worldPosition).toEqual({ mapId: 'northwest_residential', tileX: 16, tileY: 23 });
  });

  test('leaving through the pathfindable door restores the roof only outside', () => {
    const doorway = walkTo({ x: 17, y: 24 });
    expect(buildWorldFrameState(MAP, doorway.worldState, ACTORS, doorway.movement.direction, 0).hiddenRoofGroupId)
      .toBe('protagonist-villa-roof');
    const outside = walkTo({ x: 17, y: 25 }, doorway.worldState);
    const outsideFrame = buildWorldFrameState(MAP, outside.worldState, ACTORS, outside.movement.direction, 0);
    expect(outsideFrame.hiddenRoofGroupId).toBeUndefined();
    expect(outsideFrame.visibleRoofGroupIds).toEqual(['protagonist-villa-roof']);
  });

  test('every committed movement event is one adjacent tile and state-owned', () => {
    const result = walkTo({ x: 19, y: 20 });
    expect(result.worldState.protagonist.worldPosition).toEqual({
      mapId: 'northwest_residential', tileX: 19, tileY: 20,
    });
    expect(result.worldState.eventLedger).toHaveLength(2);
    for (const event of result.worldState.eventLedger) {
      expect(event.type).toBe('protagonist-moved');
      if (event.type === 'protagonist-moved') {
        expect(Math.max(
          Math.abs(event.toTileX - event.fromTileX),
          Math.abs(event.toTileY - event.fromTileY),
        )).toBe(1);
      }
    }
  });
});
