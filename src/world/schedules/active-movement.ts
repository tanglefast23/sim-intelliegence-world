import { reduceCommand } from '../../domain/commands/reducer';
import { DomainCommandSchema } from '../../domain/commands/types';
import type { WorldState } from '../../domain/state/schema';
import type { CompiledMap, TilePoint } from '../maps/schema';
import { createMovementState, requestMovement, stepMovement, type MovementState } from '../pathfinding/movement';

export type NpcMovementResult = Readonly<{ movement: MovementState; worldState: WorldState }>;

function commandBase(state: WorldState, kind: string, npcId: string) {
  const suffix = `${kind}-${npcId.replaceAll('_', '-')}-${state.revision + 1}-${state.clock.absoluteMinute}`;
  return {
    commandId: `command-${suffix}`,
    eventId: `event-${suffix}`,
    scheduledMinute: state.clock.absoluteMinute,
    priority: 0,
  } as const;
}

export function movementForNpc(state: WorldState, npcId: string): MovementState | undefined {
  const npc = state.npcs[npcId];
  if (!npc || npc.presence.kind !== 'active_local') return undefined;
  return createMovementState({ x: npc.presence.tileX, y: npc.presence.tileY });
}

export function advanceActiveNpcMovement(
  map: CompiledMap,
  movement: MovementState,
  state: WorldState,
  npcId: string,
  dynamicBlockers: ReadonlySet<string> = new Set(),
): NpcMovementResult {
  const npc = state.npcs[npcId];
  if (!npc || npc.presence.kind !== 'active_local' || npc.presence.mapId !== map.source.id) {
    return { movement, worldState: state };
  }
  const authoritativeTile = { x: npc.presence.tileX, y: npc.presence.tileY };
  let current = movement.player.x === authoritativeTile.x && movement.player.y === authoritativeTile.y
    ? movement
    : createMovementState(authoritativeTile);
  const goal = npc.scheduleGoal;
  if (!goal || goal.mapId !== map.source.id) return { movement: current, worldState: state };
  const goalChanged = current.target?.x !== goal.tileX || current.target?.y !== goal.tileY;
  if ((current.status === 'idle' && current.path.length === 0) || current.status === 'unreachable' || goalChanged) {
    current = requestMovement(map, current, { x: goal.tileX, y: goal.tileY }, dynamicBlockers);
  }
  const next = stepMovement(map, current, dynamicBlockers);
  let worldState = state;
  if (next.player.x !== authoritativeTile.x || next.player.y !== authoritativeTile.y) {
    worldState = reduceCommand(worldState, DomainCommandSchema.parse({
      type: 'move-npc',
      ...commandBase(worldState, 'move-npc', npcId),
      npcId,
      mapId: map.source.id,
      tileX: next.player.x,
      tileY: next.player.y,
    })).state;
  }
  const reached = next.player.x === goal.tileX && next.player.y === goal.tileY && next.status !== 'moving';
  if (!reached) return { movement: next, worldState };
  const transfer = Object.values(worldState.transfers).find((candidate) => (
    candidate.npcId === npcId && candidate.status === 'approaching_exit'
  ));
  const transferPortal = transfer
    ? map.source.portals.find(({ id }) => id === transfer.edgePortalId)
    : undefined;
  const ownsTransferExit = transfer && transferPortal && goal.activityId === 'travel' &&
    goal.mapId === transfer.originMapId && goal.tileX === transferPortal.tile.x && goal.tileY === transferPortal.tile.y;
  if (transfer && ownsTransferExit) {
    worldState = reduceCommand(worldState, DomainCommandSchema.parse({
      type: 'depart-npc-transfer',
      ...commandBase(worldState, 'depart-transfer', npcId),
      npcId,
      transferId: transfer.id,
    })).state;
  } else {
    worldState = reduceCommand(worldState, DomainCommandSchema.parse({
      type: 'complete-npc-goal',
      ...commandBase(worldState, 'complete-goal', npcId),
      npcId,
    })).state;
  }
  return { movement: next, worldState };
}

export function activeNpcTile(state: WorldState, npcId: string, mapId: string): TilePoint | undefined {
  const presence = state.npcs[npcId]?.presence;
  return presence?.kind === 'active_local' && presence.mapId === mapId
    ? { x: presence.tileX, y: presence.tileY }
    : undefined;
}
