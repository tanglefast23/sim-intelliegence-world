import type { WorldState } from '../../domain/state/schema';
import { tileKey } from '../../world/maps/schema';
import type { MapId } from '../../world/maps/catalog';
import { advanceMovement, type MovementAdvance, type MovementState } from '../../world/pathfinding/movement';
import {
  applyPassingOffset,
  findHeadOnExchangePartners,
  reservedTileKeys,
} from '../../world/movement/reservations';
import {
  advanceActiveNpcMovementFrame,
  commitActiveNpcTile,
  finalizeActiveNpcMovement,
  movementForNpc,
  prepareActiveNpcMovement,
} from '../../world/schedules/active-movement';
import { WORLD_MAP_CATALOG } from './map-catalog';
import { advanceWorldMovementFrame, commitPlayerTile } from './world-runtime';

export type MovementFrameState = Readonly<{
  movement: MovementState;
  npcMovements: Readonly<Record<string, MovementState>>;
  worldState: WorldState;
}>;

function actorPriority(left: string, right: string): number {
  if (left === 'protagonist') return right === 'protagonist' ? 0 : -1;
  if (right === 'protagonist') return 1;
  return left.localeCompare(right, 'en');
}

function actorBlockers(
  state: WorldState,
  mapId: string,
  movements: Readonly<Record<string, MovementState>>,
  actorId: string,
): Set<string> {
  const blockers = new Set<string>();
  for (const stateId of Object.keys(state.npcs).sort()) {
    if (stateId === actorId) continue;
    const presence = state.npcs[stateId]?.presence;
    if (presence?.kind === 'active_local' && presence.mapId === mapId) {
      blockers.add(tileKey({ x: presence.tileX, y: presence.tileY }));
      if (actorPriority(stateId, actorId) < 0) {
        for (const key of reservedTileKeys(movements[stateId] ?? movementForNpc(state, stateId)!)) blockers.add(key);
      }
    }
  }
  return blockers;
}

function addPlayerClaims(blockers: Set<string>, movement: MovementState): void {
  blockers.add(tileKey(movement.player));
  for (const key of reservedTileKeys(movement)) blockers.add(key);
}

function removeActorClaims(blockers: Set<string>, movement: MovementState): void {
  blockers.delete(tileKey(movement.player));
  for (const key of reservedTileKeys(movement)) blockers.delete(key);
}

function movementForActor(
  actorId: string,
  playerMovement: MovementState,
  npcMovements: Readonly<Record<string, MovementState>>,
): MovementState | undefined {
  return actorId === 'protagonist' ? playerMovement : npcMovements[actorId];
}

function setActorMovement(
  actorId: string,
  movement: MovementState,
  playerMovement: MovementState,
  npcMovements: Record<string, MovementState>,
): MovementState {
  if (actorId === 'protagonist') return movement;
  npcMovements[actorId] = movement;
  return playerMovement;
}

function commitActorTile(
  actorId: string,
  result: MovementAdvance,
  state: WorldState,
  mapId: MapId,
): WorldState {
  const tile = result.committedTiles[0];
  if (!tile) return state;
  return actorId === 'protagonist'
    ? commitPlayerTile(WORLD_MAP_CATALOG[mapId], result.movement, state, tile)
    : commitActiveNpcTile(state, actorId, mapId, tile);
}

export function advanceMovementFrame(
  current: MovementFrameState,
  elapsedMs: number,
  speed: number,
): MovementFrameState {
  if (speed <= 0) return current;
  const mapId = current.worldState.protagonist.worldPosition.mapId as MapId;
  const map = WORLD_MAP_CATALOG[mapId];
  let state = current.worldState;
  let playerMovement = current.movement;
  const movements: Record<string, MovementState> = {};

  for (const stateId of Object.keys(state.npcs).sort()) {
    const base = current.npcMovements[stateId] ?? movementForNpc(state, stateId);
    if (!base) continue;
    const prepared = prepareActiveNpcMovement(map, base, state, stateId);
    if (prepared) movements[stateId] = prepared;
  }

  const exchangePartners = findHeadOnExchangePartners([
    { actorId: 'protagonist', movement: playerMovement },
    ...Object.entries(movements).map(([actorId, movement]) => ({ actorId, movement })),
  ]);
  const processed = new Set<string>();
  const actorIds = ['protagonist', ...Object.keys(movements).sort()].sort(actorPriority);

  for (const actorId of actorIds) {
    if (processed.has(actorId)) continue;
    const partnerId = exchangePartners[actorId];
    if (!partnerId || processed.has(partnerId)) continue;
    const actorMovement = movementForActor(actorId, playerMovement, movements);
    const partnerMovement = movementForActor(partnerId, playerMovement, movements);
    if (!actorMovement || !partnerMovement) continue;

    const actorBlockerSet = actorBlockers(state, mapId, movements, actorId);
    if (actorId !== 'protagonist') addPlayerClaims(actorBlockerSet, playerMovement);
    removeActorClaims(actorBlockerSet, partnerMovement);
    const partnerBlockerSet = actorBlockers(state, mapId, movements, partnerId);
    if (partnerId !== 'protagonist') addPlayerClaims(partnerBlockerSet, playerMovement);
    removeActorClaims(partnerBlockerSet, actorMovement);

    const actorResult = advanceMovement(map, actorMovement, elapsedMs, speed, actorBlockerSet);
    const partnerResult = advanceMovement(map, partnerMovement, elapsedMs, speed, partnerBlockerSet);
    const actorCommitted = actorResult.committedTiles.length > 0;
    const partnerCommitted = partnerResult.committedTiles.length > 0;

    if (actorCommitted && partnerCommitted) {
      const orderedResults = [
        { actorId, result: actorResult },
        { actorId: partnerId, result: partnerResult },
      ].sort((left, right) => actorPriority(left.actorId, right.actorId));
      for (const item of orderedResults) state = commitActorTile(item.actorId, item.result, state, mapId);
      playerMovement = setActorMovement(actorId, actorResult.movement, playerMovement, movements);
      playerMovement = setActorMovement(partnerId, partnerResult.movement, playerMovement, movements);
      for (const item of orderedResults) {
        if (item.actorId !== 'protagonist') {
          state = finalizeActiveNpcMovement(map, item.result.movement, state, item.actorId);
        }
      }
    } else {
      const nextActor = actorCommitted ? actorMovement : actorResult.movement;
      const nextPartner = partnerCommitted ? partnerMovement : partnerResult.movement;
      playerMovement = setActorMovement(
        actorId,
        applyPassingOffset(actorId, partnerId, nextActor),
        playerMovement,
        movements,
      );
      playerMovement = setActorMovement(
        partnerId,
        applyPassingOffset(partnerId, actorId, nextPartner),
        playerMovement,
        movements,
      );
    }
    processed.add(actorId);
    processed.add(partnerId);
  }

  if (!processed.has('protagonist')) {
    const playerBlockers = actorBlockers(state, mapId, movements, 'protagonist');
    const player = advanceWorldMovementFrame(map, playerMovement, state, elapsedMs, speed, playerBlockers);
    playerMovement = player.movement;
    state = player.worldState;
  }

  for (const stateId of Object.keys(movements).sort()) {
    if (processed.has(stateId)) continue;
    const blockers = actorBlockers(state, mapId, movements, stateId);
    addPlayerClaims(blockers, playerMovement);
    const result = advanceActiveNpcMovementFrame(
      map,
      movements[stateId]!,
      state,
      stateId,
      elapsedMs,
      speed,
      blockers,
    );
    movements[stateId] = result.movement;
    state = result.worldState;
  }

  const movementIds = Object.keys(movements);
  if (
    state === current.worldState && playerMovement === current.movement &&
    movementIds.length === Object.keys(current.npcMovements).length &&
    movementIds.every((id) => movements[id] === current.npcMovements[id])
  ) return current;
  return { movement: playerMovement, npcMovements: movements, worldState: state };
}
