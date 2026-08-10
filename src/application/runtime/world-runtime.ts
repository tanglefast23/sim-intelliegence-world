import { reduceCommand } from '../../domain/commands/reducer';
import { DomainCommandSchema } from '../../domain/commands/types';
import type { WorldState } from '../../domain/state/schema';
import { roofGroupAtV2, type CompiledMapV2 } from '../../world/maps/compiled-v2';
import { stepMovement, type MovementState } from '../../world/pathfinding/movement';

function idPart(value: string): string {
  return value.replaceAll('_', '-');
}

export type RuntimeStepResult = Readonly<{
  movement: MovementState;
  worldState: WorldState;
}>;

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
  const sequence = worldState.revision + 1;
  const mapId = map.source.id;
  const suffix = `${sequence}-${idPart(mapId)}-${nextMovement.player.x}-${nextMovement.player.y}`;
  const locationId = roofGroupAtV2(map, nextMovement.player) ? 'protagonist_villa' : mapId;
  const result = reduceCommand(worldState, DomainCommandSchema.parse({
    type: 'move-protagonist',
    commandId: `command-move-${suffix}`,
    eventId: `event-move-${suffix}`,
    scheduledMinute: worldState.clock.absoluteMinute,
    priority: 0,
    mapId,
    locationId,
    tileX: nextMovement.player.x,
    tileY: nextMovement.player.y,
  }));
  return { movement: nextMovement, worldState: result.state };
}
