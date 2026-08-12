import type { WorldState } from '../domain/state/schema';
import type { CompiledLocationBindingV2 } from '../world/maps/compiled-v2';
import type { TilePoint } from '../world/maps/schema';

type JournalMarkerMap = Readonly<{
  areaById: ReadonlyMap<string, Readonly<{ entranceTiles: readonly TilePoint[] }>>;
  locationBindingById: ReadonlyMap<string, CompiledLocationBindingV2>;
}>;

export type JournalMapMarker = Readonly<{
  journalEntryId: string;
  locationId: string;
  tile: TilePoint;
}>;

export function journalMapMarkers(
  journal: WorldState['journal'],
  map: JournalMarkerMap,
): JournalMapMarker[] {
  const markers: JournalMapMarker[] = [];
  const markedLocationIds = new Set<string>();
  const entries = Object.values(journal).sort((left, right) => left.id.localeCompare(right.id, 'en'));
  for (const entry of entries) {
    const locationId = entry.locationId;
    if (!entry.markerVisible || entry.locationPrecision !== 'exact' || !locationId || markedLocationIds.has(locationId)) {
      continue;
    }
    const binding = map.locationBindingById.get(locationId);
    const entranceTile = binding?.areaIds
      .map((areaId) => map.areaById.get(areaId)?.entranceTiles[0])
      .find((tile) => tile !== undefined);
    const tile = entranceTile ?? binding?.preferredApproachTiles[0] ?? binding?.candidateTiles[0];
    if (!tile) continue;
    markedLocationIds.add(locationId);
    markers.push({ journalEntryId: entry.id, locationId, tile: { ...tile } });
  }
  return markers;
}
