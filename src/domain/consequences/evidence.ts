import { EvidenceStateSchema } from '../state/models';
import type { WorldState } from '../state/schema';
import type { z } from 'zod';

export type EvidenceState = z.infer<typeof EvidenceStateSchema>;

export function nearbyWitnessNpcIds(
  state: WorldState,
  mapId: string,
  tile: Readonly<{ x: number; y: number }>,
  maximumDistance: number,
  excludedNpcIds: ReadonlySet<string>,
): string[] {
  return Object.values(state.npcs)
    .filter((npc) => {
      if (excludedNpcIds.has(npc.id) || npc.presence.kind !== 'active_local' || npc.presence.mapId !== mapId) return false;
      return Math.abs(npc.presence.tileX - tile.x) + Math.abs(npc.presence.tileY - tile.y) <= maximumDistance;
    })
    .map(({ id }) => id)
    .sort();
}

export function createCrimeEvidence(input: Readonly<{
  id: string;
  actionId: string;
  locationId: string;
  witnessNpcIds: readonly string[];
  createdAtMinute: number;
}>): EvidenceState {
  return EvidenceStateSchema.parse({
    id: input.id,
    actionId: input.actionId,
    locationId: input.locationId,
    witnessNpcIds: [...new Set(input.witnessNpcIds)].sort(),
    createdAtMinute: input.createdAtMinute,
    status: input.witnessNpcIds.length > 0 ? 'noticed' : 'unnoticed',
  });
}
