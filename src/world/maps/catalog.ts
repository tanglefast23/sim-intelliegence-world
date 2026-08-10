import { compileWorldMap, type CompiledMap, type WorldMap } from './schema';
import { assertNeighborhoodRoutes } from '../transfers/routes';

export const MAP_IDS = [
  'northwest_residential',
  'northeast_downtown',
  'southwest_commercial',
  'southeast_docks',
] as const;
export type MapId = typeof MAP_IDS[number];

export type WorldMapCatalog = Readonly<Record<MapId, CompiledMap>>;

const OPPOSITE_EDGE: Readonly<Record<WorldMap['portals'][number]['edge'], WorldMap['portals'][number]['edge']>> = {
  north: 'south',
  east: 'west',
  south: 'north',
  west: 'east',
};

function assertReciprocalPortals(catalog: WorldMapCatalog): void {
  for (const map of Object.values(catalog)) {
    for (const portal of map.source.portals) {
      const destination = catalog[portal.destinationMapId as MapId];
      if (!destination) throw new Error(`Portal ${map.source.id}/${portal.id} references an unknown map.`);
      const entrance = destination.source.portals.find(({ id }) => id === portal.destinationEntranceId);
      if (!entrance) throw new Error(`Portal ${map.source.id}/${portal.id} references an unknown entrance.`);
      if (
        entrance.edge !== OPPOSITE_EDGE[portal.edge] ||
        entrance.destinationMapId !== map.source.id ||
        entrance.destinationEntranceId !== portal.id
      ) {
        throw new Error(`Portal ${map.source.id}/${portal.id} is not reciprocal.`);
      }
      if (
        ((portal.edge === 'east' || portal.edge === 'west') && portal.tile.y !== entrance.tile.y) ||
        ((portal.edge === 'north' || portal.edge === 'south') && portal.tile.x !== entrance.tile.x)
      ) {
        throw new Error(`Portal ${map.source.id}/${portal.id} is not aligned with its entrance.`);
      }
    }
  }
}

export function buildWorldMapCatalog(
  candidates: Readonly<Record<MapId, unknown>>,
  knownSprites: ReadonlySet<string>,
): WorldMapCatalog {
  const catalog = {
    northwest_residential: compileWorldMap(candidates.northwest_residential, knownSprites),
    northeast_downtown: compileWorldMap(candidates.northeast_downtown, knownSprites),
    southwest_commercial: compileWorldMap(candidates.southwest_commercial, knownSprites),
    southeast_docks: compileWorldMap(candidates.southeast_docks, knownSprites),
  } satisfies WorldMapCatalog;
  assertReciprocalPortals(catalog);
  assertNeighborhoodRoutes(catalog);
  const northwestAreas = new Set(catalog.northwest_residential.source.areas.map(({ id }) => id));
  for (const required of ['bedroom', 'bathroom', 'kitchen', 'storage', 'social']) {
    if (!northwestAreas.has(required)) throw new Error(`Northwest villa is missing ${required}.`);
  }
  const docks = catalog.southeast_docks.source;
  if (!docks.props.some(({ id }) => id === 'ferry-terminal') || docks.interactions.length !== 0) {
    throw new Error('The docks must show the ferry terminal without a usable interaction.');
  }
  return catalog;
}
