import { WORLD_MAP_CATALOG } from '../../application/runtime/map-catalog';
import { tickWorld } from '../../application/runtime/tick';
import { createInitialState } from '../../domain/state/initial-state';
import { WorldStateSchema } from '../../domain/state/schema';
import { tileKey } from '../maps/schema';
import { advanceActiveNpcMovement, movementForNpc } from '../schedules/active-movement';

describe('active resident schedules', () => {
  test('a named resident pathfinds to a same-map schedule goal without teleporting', () => {
    let worldState = createInitialState();
    let movement = movementForNpc(worldState, 'linda')!;
    const visited = [tileKey(movement.player)];
    for (let step = 0; step < 40 && worldState.npcs.linda?.scheduleGoal; step += 1) {
      ({ movement, worldState } = advanceActiveNpcMovement(
        WORLD_MAP_CATALOG.northwest_residential,
        movement,
        worldState,
        'linda',
      ));
      visited.push(tileKey(movement.player));
    }
    expect(worldState.npcs.linda?.presence).toEqual({
      kind: 'active_local', mapId: 'northwest_residential', locationId: 'northwest_residential', tileX: 28, tileY: 30,
    });
    expect(worldState.npcs.linda?.scheduleGoal).toBeUndefined();
    expect(new Set(visited).size).toBeGreaterThan(2);
  });

  test('an active resident reaches the exit before becoming in transit', () => {
    const initial = createInitialState();
    let worldState = tickWorld(WorldStateSchema.parse({
      ...initial,
      clock: { ...initial.clock, absoluteMinute: 719 },
      npcs: {
        ...initial.npcs,
        generic_resident: {
          ...initial.npcs.generic_resident!,
          presence: { kind: 'inactive', mapId: 'northwest_residential', locationId: 'northwest_residential', tileX: 29, tileY: 33 },
          scheduleGoal: undefined,
        },
      },
    }), 1_000);
    const transfer = Object.values(worldState.transfers).find(({ npcId }) => npcId === 'linda')!;
    expect(transfer.status).toBe('approaching_exit');
    let movement = movementForNpc(worldState, 'linda')!;
    for (let step = 0; step < 100 && worldState.npcs.linda?.presence.kind === 'active_local'; step += 1) {
      ({ movement, worldState } = advanceActiveNpcMovement(
        WORLD_MAP_CATALOG.northwest_residential,
        movement,
        worldState,
        'linda',
      ));
    }
    expect(worldState.npcs.linda?.presence).toEqual({ kind: 'in_transit', transferId: transfer.id });
    expect(worldState.transfers[transfer.id]).toEqual(expect.objectContaining({
      status: 'in_transit',
      departureMinute: 720,
      arrivalMinute: 750,
    }));
    expect(movement.player).toEqual({ x: 32, y: 47 });
  });

  test('an underscore-bearing state ID produces valid movement command IDs', () => {
    let worldState = createInitialState();
    let movement = movementForNpc(worldState, 'generic_resident')!;
    ({ movement, worldState } = advanceActiveNpcMovement(
      WORLD_MAP_CATALOG.northwest_residential,
      movement,
      worldState,
      'generic_resident',
    ));
    expect(worldState.npcs.generic_resident?.presence).toEqual(expect.objectContaining({ kind: 'active_local' }));
    expect(worldState.eventLedger.at(-1)?.eventId).toMatch(/^event-move-npc-generic-resident-/u);
  });

  test('an NPC retries a dynamically blocked goal after the blocker moves', () => {
    let worldState = createInitialState();
    let movement = movementForNpc(worldState, 'generic_resident')!;
    ({ movement, worldState } = advanceActiveNpcMovement(
      WORLD_MAP_CATALOG.northwest_residential,
      movement,
      worldState,
      'generic_resident',
      new Set(['27,28']),
    ));
    expect(movement.status).toBe('unreachable');
    const blockedState = worldState;
    ({ movement, worldState } = advanceActiveNpcMovement(
      WORLD_MAP_CATALOG.northwest_residential,
      movement,
      worldState,
      'generic_resident',
    ));
    expect(movement.status).toBe('moving');
    expect(worldState.revision).toBe(blockedState.revision + 1);
  });
});
