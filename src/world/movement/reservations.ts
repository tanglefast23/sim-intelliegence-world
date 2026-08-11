import { tileKey } from '../maps/schema';
import type { MovementState } from '../pathfinding/movement';

export type MovementActorClaim = Readonly<{
  actorId: string;
  movement: MovementState;
}>;

export function reservedDestination(movement: MovementState) {
  return movement.segment?.to ?? movement.path[0];
}

export function reservedTileKeys(movement: MovementState): readonly string[] {
  const keys = new Set<string>();
  const destination = reservedDestination(movement);
  if (destination && (movement.status === 'moving' || movement.status === 'waiting')) {
    keys.add(tileKey(destination));
  }
  for (const key of movement.latchedTurnCurve?.touchedTileKeys ?? []) keys.add(key);
  return [...keys].sort();
}

export function findHeadOnExchangePartners(
  actors: readonly MovementActorClaim[],
): Readonly<Record<string, string>> {
  const sorted = [...actors].sort((left, right) => (
    left.actorId === 'protagonist' ? -1 : right.actorId === 'protagonist' ? 1 : left.actorId.localeCompare(right.actorId, 'en')
  ));
  const partners: Record<string, string> = {};
  for (let leftIndex = 0; leftIndex < sorted.length; leftIndex += 1) {
    const left = sorted[leftIndex]!;
    if (partners[left.actorId]) continue;
    const leftDesired = reservedDestination(left.movement);
    if (!leftDesired) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < sorted.length; rightIndex += 1) {
      const right = sorted[rightIndex]!;
      if (partners[right.actorId]) continue;
      const rightDesired = reservedDestination(right.movement);
      if (!rightDesired) continue;
      if (
        tileKey(leftDesired) === tileKey(right.movement.player) &&
        tileKey(rightDesired) === tileKey(left.movement.player)
      ) {
        partners[left.actorId] = right.actorId;
        partners[right.actorId] = left.actorId;
        break;
      }
    }
  }
  return partners;
}

export function applyPassingOffset(
  actorId: string,
  partnerId: string,
  movement: MovementState,
): MovementState {
  const segment = movement.segment;
  if (!segment) return movement;
  const deltaX = segment.to.x - segment.from.x;
  const deltaY = segment.to.y - segment.from.y;
  const length = Math.hypot(deltaX, deltaY);
  if (length === 0) return movement;
  const progress = Math.max(0, Math.min(1, segment.elapsedMs / segment.durationMs));
  const magnitude = Math.sin(Math.PI * progress) * 3 * (actorId < partnerId ? -1 : 1);
  return {
    ...movement,
    visualFoot: {
      x: movement.visualFoot.x + (-deltaY / length) * magnitude,
      y: movement.visualFoot.y + (deltaX / length) * magnitude,
    },
  };
}
