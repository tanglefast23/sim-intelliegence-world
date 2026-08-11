import { reduceCommand } from '../../domain/commands/reducer';
import { DomainCommandSchema } from '../../domain/commands/types';
import type { WorldState } from '../../domain/state/schema';
import { roofGroupAtV2, type CompiledMapV2 } from '../../world/maps/compiled-v2';
import { advanceMovement, stepMovement, type MovementState } from '../../world/pathfinding/movement';

function idPart(value: string): string {
  return value.replaceAll('_', '-');
}

export type RuntimeStepResult = Readonly<{
  movement: MovementState;
  worldState: WorldState;
}>;

export function commitPlayerTile(
  map: CompiledMapV2,
  movement: MovementState,
  worldState: WorldState,
  tile: Readonly<{ x: number; y: number }>,
): WorldState {
  const sequence = worldState.revision + 1;
  const mapId = map.source.id;
  const suffix = `${sequence}-${idPart(mapId)}-${tile.x}-${tile.y}`;
  const locationId = roofGroupAtV2(map, tile) ? 'protagonist_villa' : mapId;
  return reduceCommand(worldState, DomainCommandSchema.parse({
    type: 'move-protagonist',
    commandId: `command-move-${suffix}`,
    eventId: `event-move-${suffix}`,
    scheduledMinute: worldState.clock.absoluteMinute,
    priority: 0,
    mapId,
    locationId,
    tileX: tile.x,
    tileY: tile.y,
  })).state;
}

export function advanceWorldMovementFrame(
  map: CompiledMapV2,
  movement: MovementState,
  worldState: WorldState,
  elapsedMs: number,
  speed: number,
  dynamicBlockers: ReadonlySet<string> = new Set(),
): RuntimeStepResult {
  const advanced = advanceMovement(map, movement, elapsedMs, speed, dynamicBlockers);
  let state = worldState;
  for (const tile of advanced.committedTiles) state = commitPlayerTile(map, advanced.movement, state, tile);
  return { movement: advanced.movement, worldState: state };
}

export function advanceWorldMovement(
  map: CompiledMapV2,
  movement: MovementState,
  worldState: WorldState,
  dynamicBlockers: ReadonlySet<string> = new Set(),
): RuntimeStepResult {
  const nextMovement = stepMovement(map, movement, dynamicBlockers);
  if (
    nextMovement.player.x === movement.player.x &&
    nextMovement.player.y === movement.player.y
  ) {
    return { movement: nextMovement, worldState };
  }
  return { movement: nextMovement, worldState: commitPlayerTile(map, nextMovement, worldState, nextMovement.player) };
}
