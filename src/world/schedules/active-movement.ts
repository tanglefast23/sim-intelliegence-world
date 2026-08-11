import { reduceCommand } from '../../domain/commands/reducer';
import { DomainCommandSchema } from '../../domain/commands/types';
import type { WorldState } from '../../domain/state/schema';
import type { CompiledMapV2 } from '../maps/compiled-v2';
import type { TilePoint } from '../maps/schema';
import { advanceMovement, createMovementState, requestMovement, stepMovement, type MovementState } from '../pathfinding/movement';

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

export function prepareActiveNpcMovement(
  map: CompiledMapV2,
  movement: MovementState,
  state: WorldState,
  npcId: string,
  dynamicBlockers: ReadonlySet<string> = new Set(),
): MovementState | undefined {
  const npc = state.npcs[npcId];
  if (!npc || npc.presence.kind !== 'active_local' || npc.presence.mapId !== map.source.id) return undefined;
  const authoritativeTile = { x: npc.presence.tileX, y: npc.presence.tileY };
  let current = movement.player.x === authoritativeTile.x && movement.player.y === authoritativeTile.y
    ? movement
    : createMovementState(authoritativeTile);
  const goal = npc.scheduleGoal;
  if (!goal || goal.mapId !== map.source.id) return current;
  const effectiveTarget = current.resumeTarget ?? current.target;
  const goalChanged = effectiveTarget?.x !== goal.tileX || effectiveTarget?.y !== goal.tileY;
  if ((current.status === 'idle' && current.path.length === 0) || current.status === 'unreachable' || goalChanged) {
    current = requestMovement(map, current, { x: goal.tileX, y: goal.tileY }, dynamicBlockers);
  }
  return current;
}

export function commitActiveNpcTile(
  state: WorldState,
  npcId: string,
  mapId: string,
  tile: TilePoint,
): WorldState {
  return reduceCommand(state, DomainCommandSchema.parse({
    type: 'move-npc',
    ...commandBase(state, 'move-npc', npcId),
    npcId,
    mapId,
    tileX: tile.x,
    tileY: tile.y,
  })).state;
}

export function finalizeActiveNpcMovement(
  map: CompiledMapV2,
  movement: MovementState,
  state: WorldState,
  npcId: string,
): WorldState {
  const npc = state.npcs[npcId];
  const goal = npc?.scheduleGoal;
  if (!npc || npc.presence.kind !== 'active_local' || !goal || goal.mapId !== map.source.id) return state;
  const reached = movement.player.x === goal.tileX && movement.player.y === goal.tileY && movement.status !== 'moving';
  if (!reached) return state;
  const transfer = Object.values(state.transfers).find((candidate) => (
    candidate.npcId === npcId && candidate.status === 'approaching_exit'
  ));
  const transferPortal = transfer ? map.portalById.get(transfer.edgePortalId) : undefined;
  const ownsTransferExit = transfer && transferPortal && goal.activityId === 'travel' &&
    goal.mapId === transfer.originMapId && goal.tileX === transferPortal.tile.x && goal.tileY === transferPortal.tile.y;
  return reduceCommand(state, DomainCommandSchema.parse(transfer && ownsTransferExit ? {
    type: 'depart-npc-transfer',
    ...commandBase(state, 'depart-transfer', npcId),
    npcId,
    transferId: transfer.id,
  } : {
    type: 'complete-npc-goal',
    ...commandBase(state, 'complete-goal', npcId),
    npcId,
  })).state;
}

export function movementForNpc(state: WorldState, npcId: string): MovementState | undefined {
  const npc = state.npcs[npcId];
  if (!npc || npc.presence.kind !== 'active_local') return undefined;
  return createMovementState({ x: npc.presence.tileX, y: npc.presence.tileY });
}

export function advanceActiveNpcMovement(
  map: CompiledMapV2,
  movement: MovementState,
  state: WorldState,
  npcId: string,
  dynamicBlockers: ReadonlySet<string> = new Set(),
): NpcMovementResult {
  const current = prepareActiveNpcMovement(map, movement, state, npcId, dynamicBlockers);
  if (!current) return { movement, worldState: state };
  const next = stepMovement(map, current, dynamicBlockers);
  let worldState = state;
  if (next.player.x !== current.player.x || next.player.y !== current.player.y) {
    worldState = commitActiveNpcTile(worldState, npcId, map.source.id, next.player);
  }
  worldState = finalizeActiveNpcMovement(map, next, worldState, npcId);
  return { movement: next, worldState };
}

export function advanceActiveNpcMovementFrame(
  map: CompiledMapV2,
  movement: MovementState,
  state: WorldState,
  npcId: string,
  elapsedMs: number,
  speed: number,
  dynamicBlockers: ReadonlySet<string> = new Set(),
): NpcMovementResult {
  const current = prepareActiveNpcMovement(map, movement, state, npcId, dynamicBlockers);
  if (!current) return { movement, worldState: state };
  const advanced = advanceMovement(map, current, elapsedMs, speed, dynamicBlockers);
  let worldState = state;
  for (const tile of advanced.committedTiles) {
    worldState = commitActiveNpcTile(worldState, npcId, map.source.id, tile);
  }
  const next = advanced.movement;
  worldState = finalizeActiveNpcMovement(map, next, worldState, npcId);
  return { movement: next, worldState };
}

export function activeNpcTile(state: WorldState, npcId: string, mapId: string): TilePoint | undefined {
  const presence = state.npcs[npcId]?.presence;
  return presence?.kind === 'active_local' && presence.mapId === mapId
    ? { x: presence.tileX, y: presence.tileY }
    : undefined;
}
