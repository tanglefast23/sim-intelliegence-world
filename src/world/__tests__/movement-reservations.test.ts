import { advanceMovementFrame, type MovementFrameState } from '../../application/runtime/movement-frame';
import { WORLD_MAP_CATALOG } from '../../application/runtime/map-catalog';
import { createInitialState } from '../../domain/state/initial-state';
import { parseWorldState } from '../../domain/state/schema';
import { createMovementState, requestMovement } from '../pathfinding/movement';
import {
  applyPassingOffset,
  findHeadOnExchangePartners,
  reservedTileKeys,
} from '../movement/reservations';

describe('movement reservations', () => {
  test('detects one stable opposing edge pair', () => {
    const left = {
      ...createMovementState({ x: 1, y: 1 }),
      path: [{ x: 2, y: 1 }],
      status: 'moving' as const,
    };
    const right = {
      ...createMovementState({ x: 2, y: 1 }),
      path: [{ x: 1, y: 1 }],
      status: 'moving' as const,
    };
    expect(findHeadOnExchangePartners([
      { actorId: 'npc-z', movement: right },
      { actorId: 'protagonist', movement: left },
    ])).toEqual({ protagonist: 'npc-z', 'npc-z': 'protagonist' });
  });

  test('offsets paired actors on opposite sides only during the segment', () => {
    const base = createMovementState({ x: 1, y: 1 });
    const movement = {
      ...base,
      segment: { from: { x: 1, y: 1 }, to: { x: 2, y: 1 }, elapsedMs: 72.5, durationMs: 145 },
      visualFoot: { x: 64, y: 61 },
      status: 'moving' as const,
    };
    const left = applyPassingOffset('protagonist', 'resident', movement);
    const right = applyPassingOffset('resident', 'protagonist', movement);
    expect(left.visualFoot.y).toBe(58);
    expect(right.visualFoot.y).toBe(64);
  });

  test('holds the next path node as a reservation between segments', () => {
    const movement = {
      ...createMovementState({ x: 1, y: 1 }),
      path: [{ x: 2, y: 1 }, { x: 3, y: 1 }],
      status: 'moving' as const,
    };
    expect(reservedTileKeys(movement)).toEqual(['2,1']);
  });

  test('commits a head-on exchange atomically without an exposed overlap', () => {
    const initial = createInitialState();
    const worldState = parseWorldState({
      ...initial,
      protagonist: {
        ...initial.protagonist,
        locationId: 'northwest_residential',
        worldPosition: { mapId: 'northwest_residential', tileX: 18, tileY: 18 },
      },
      npcs: {
        ...initial.npcs,
        linda: {
          ...initial.npcs.linda!,
          presence: {
            kind: 'active_local',
            mapId: 'northwest_residential',
            locationId: 'northwest_residential',
            tileX: 19,
            tileY: 18,
          },
          scheduleGoal: {
            mapId: 'northwest_residential',
            locationId: 'northwest_residential',
            tileX: 18,
            tileY: 18,
            activityId: 'social',
            scheduledMinute: 480,
          },
        },
      },
    });
    let frame: MovementFrameState = {
      worldState,
      movement: requestMovement(
        WORLD_MAP_CATALOG.northwest_residential,
        createMovementState({ x: 18, y: 18 }),
        { x: 19, y: 18 },
      ),
      npcMovements: {
        linda: {
          ...createMovementState({ x: 19, y: 18 }),
          target: { x: 18, y: 18 },
          path: [{ x: 18, y: 18 }],
          status: 'moving' as const,
        },
      },
    };
    let exchanged = false;
    for (let index = 0; index < 12; index += 1) {
      frame = advanceMovementFrame(frame, 16, 1);
      const player = frame.worldState.protagonist.worldPosition;
      const linda = frame.worldState.npcs.linda?.presence;
      expect(linda?.kind).toBe('active_local');
      if (linda?.kind !== 'active_local') continue;
      expect(`${player.tileX},${player.tileY}`).not.toBe(`${linda.tileX},${linda.tileY}`);
      exchanged ||= player.tileX === 19 && player.tileY === 18 && linda.tileX === 18 && linda.tileY === 18;
    }
    expect(exchanged).toBe(true);
  });

  test('gives one shared next-tile claim to the stable higher-priority actor', () => {
    const initial = createInitialState();
    const worldState = parseWorldState({
      ...initial,
      protagonist: {
        ...initial.protagonist,
        worldPosition: { mapId: 'northwest_residential', tileX: 18, tileY: 18 },
      },
      npcs: {
        ...initial.npcs,
        linda: {
          ...initial.npcs.linda!,
          presence: {
            kind: 'active_local', mapId: 'northwest_residential', locationId: 'northwest_residential',
            tileX: 18, tileY: 20,
          },
          scheduleGoal: {
            mapId: 'northwest_residential', locationId: 'northwest_residential',
            tileX: 19, tileY: 19, activityId: 'social', scheduledMinute: 480,
          },
        },
      },
    });
    let frame: MovementFrameState = {
      worldState,
      movement: requestMovement(
        WORLD_MAP_CATALOG.northwest_residential,
        createMovementState({ x: 18, y: 18 }),
        { x: 19, y: 19 },
      ),
      npcMovements: {
        linda: requestMovement(
          WORLD_MAP_CATALOG.northwest_residential,
          createMovementState({ x: 18, y: 20 }),
          { x: 19, y: 19 },
        ),
      },
    };
    let playerWon = false;
    for (let index = 0; index < 16; index += 1) {
      frame = advanceMovementFrame(frame, 16, 1);
      const player = frame.worldState.protagonist.worldPosition;
      const linda = frame.worldState.npcs.linda?.presence;
      expect(linda?.kind).toBe('active_local');
      if (linda?.kind !== 'active_local') continue;
      expect(`${player.tileX},${player.tileY}`).not.toBe(`${linda.tileX},${linda.tileY}`);
      playerWon ||= player.tileX === 19 && player.tileY === 19 && linda.tileX === 18 && linda.tileY === 20;
    }
    expect(playerWon).toBe(true);
  });
});
