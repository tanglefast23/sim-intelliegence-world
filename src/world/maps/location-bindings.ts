import type { CompiledInteractionV2, CompiledLocationBindingV2 } from './compiled-v2';
import { pointsInRect, tileKey, type TilePoint, type WorldMapV2 } from './schema';

function tileOrder(left: TilePoint, right: TilePoint): number {
  return left.y - right.y || left.x - right.x;
}

function uniqueTiles(tiles: readonly TilePoint[]): TilePoint[] {
  return [...new Map(tiles.map((tile) => [tileKey(tile), tile])).values()].sort(tileOrder);
}

export function compileLocationBindings(input: Readonly<{
  map: WorldMapV2;
  areaById: ReadonlyMap<string, WorldMapV2['areas'][number]>;
  interactionById: ReadonlyMap<string, CompiledInteractionV2>;
  blockedKeys: ReadonlySet<string>;
  knownLocationIds: ReadonlySet<string>;
}>): ReadonlyMap<string, CompiledLocationBindingV2> {
  const { map, areaById, interactionById, blockedKeys, knownLocationIds } = input;
  const result = new Map<string, CompiledLocationBindingV2>();
  for (const binding of [...map.locationBindings].sort((left, right) => left.locationId.localeCompare(right.locationId, 'en'))) {
    if (!knownLocationIds.has(binding.locationId)) {
      throw new Error(`Map ${map.id} has an unknown location binding: ${binding.locationId}`);
    }
    if (result.has(binding.locationId)) throw new Error(`Location binding IDs must be unique: ${binding.locationId}`);
    const areas = binding.areaIds.map((id) => {
      const area = areaById.get(id);
      if (!area) throw new Error(`Location ${binding.locationId} references unknown area ${id}.`);
      return area;
    });
    const candidates = uniqueTiles(areas.flatMap(({ bounds }) => pointsInRect(bounds))
      .filter((tile) => !blockedKeys.has(tileKey(tile))));
    const preferredApproaches = uniqueTiles(binding.preferredInteractionIds.flatMap((id) => {
      const interaction = interactionById.get(id);
      if (!interaction) throw new Error(`Location ${binding.locationId} references unknown interaction ${id}.`);
      return interaction.approachTiles;
    }).filter((tile) => !blockedKeys.has(tileKey(tile))));
    if (candidates.length === 0 || (binding.preferredInteractionIds.length > 0 && preferredApproaches.length === 0)) {
      throw new Error(`Location binding ${binding.locationId} has no valid candidate tiles.`);
    }
    result.set(binding.locationId, {
      locationId: binding.locationId,
      areaIds: [...binding.areaIds],
      preferredInteractionIds: [...binding.preferredInteractionIds],
      candidateTiles: candidates,
      preferredApproachTiles: preferredApproaches,
    });
  }

  if (!knownLocationIds.has(map.id)) throw new Error(`Map ${map.id} is not a registered location.`);
  const allWalkable = uniqueTiles(Array.from({ length: map.height }, (_, y) => (
    Array.from({ length: map.width }, (__, x) => ({ x, y }))
  )).flat().filter((tile) => !blockedKeys.has(tileKey(tile))));
  if (allWalkable.length === 0) throw new Error(`Map ${map.id} has no walkable cells.`);
  result.set(map.id, {
    locationId: map.id,
    areaIds: map.areas.map(({ id }) => id),
    preferredInteractionIds: [],
    candidateTiles: allWalkable,
    preferredApproachTiles: [],
  });
  return result;
}
