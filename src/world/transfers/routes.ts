import { z } from 'zod';

import { StableIdSchema } from '../../domain/state/ids';
import { TilePointSchema, type CompiledMap } from '../maps/schema';

export const NeighborhoodRouteSchema = z.object({
  originMapId: StableIdSchema,
  destinationMapId: StableIdSchema,
  sourcePortalId: StableIdSchema,
  sourcePortalTile: TilePointSchema,
  destinationEntranceId: StableIdSchema,
  destinationEntranceTile: TilePointSchema,
}).strict();
export type NeighborhoodRoute = z.infer<typeof NeighborhoodRouteSchema>;

export const NEIGHBORHOOD_ROUTES: readonly NeighborhoodRoute[] = [
  { originMapId: 'northwest_residential', destinationMapId: 'northeast_downtown', sourcePortalId: 'to-downtown', sourcePortalTile: { x: 63, y: 24 }, destinationEntranceId: 'from-residential', destinationEntranceTile: { x: 0, y: 24 } },
  { originMapId: 'northeast_downtown', destinationMapId: 'northwest_residential', sourcePortalId: 'from-residential', sourcePortalTile: { x: 0, y: 24 }, destinationEntranceId: 'to-downtown', destinationEntranceTile: { x: 63, y: 24 } },
  { originMapId: 'northwest_residential', destinationMapId: 'southwest_commercial', sourcePortalId: 'to-commercial', sourcePortalTile: { x: 32, y: 47 }, destinationEntranceId: 'from-residential', destinationEntranceTile: { x: 32, y: 0 } },
  { originMapId: 'southwest_commercial', destinationMapId: 'northwest_residential', sourcePortalId: 'from-residential', sourcePortalTile: { x: 32, y: 0 }, destinationEntranceId: 'to-commercial', destinationEntranceTile: { x: 32, y: 47 } },
  { originMapId: 'northeast_downtown', destinationMapId: 'southeast_docks', sourcePortalId: 'to-docks', sourcePortalTile: { x: 32, y: 47 }, destinationEntranceId: 'from-downtown', destinationEntranceTile: { x: 32, y: 0 } },
  { originMapId: 'southeast_docks', destinationMapId: 'northeast_downtown', sourcePortalId: 'from-downtown', sourcePortalTile: { x: 32, y: 0 }, destinationEntranceId: 'to-docks', destinationEntranceTile: { x: 32, y: 47 } },
  { originMapId: 'southwest_commercial', destinationMapId: 'southeast_docks', sourcePortalId: 'to-docks', sourcePortalTile: { x: 63, y: 24 }, destinationEntranceId: 'from-commercial', destinationEntranceTile: { x: 0, y: 24 } },
  { originMapId: 'southeast_docks', destinationMapId: 'southwest_commercial', sourcePortalId: 'from-commercial', sourcePortalTile: { x: 0, y: 24 }, destinationEntranceId: 'to-docks', destinationEntranceTile: { x: 63, y: 24 } },
].map((route) => NeighborhoodRouteSchema.parse(route));

export function routeBetween(originMapId: string, destinationMapId: string): NeighborhoodRoute {
  const route = NEIGHBORHOOD_ROUTES.find((candidate) => (
    candidate.originMapId === originMapId && candidate.destinationMapId === destinationMapId
  ));
  if (!route) throw new Error(`Maps ${originMapId} and ${destinationMapId} are not cardinal neighbors.`);
  return route;
}

export function assertNeighborhoodRoutes(catalog: Readonly<Record<string, CompiledMap>>): void {
  const portals = Object.values(catalog).flatMap((map) => map.source.portals.map((portal) => ({ map, portal })));
  if (NEIGHBORHOOD_ROUTES.length !== portals.length) {
    throw new Error('The neighborhood route table must contain exactly one route per portal.');
  }
  for (const { map, portal } of portals) {
    const route = NEIGHBORHOOD_ROUTES.find((candidate) => (
      candidate.originMapId === map.source.id && candidate.sourcePortalId === portal.id
    ));
    if (
      !route ||
      route.destinationMapId !== portal.destinationMapId ||
      route.destinationEntranceId !== portal.destinationEntranceId ||
      route.sourcePortalTile.x !== portal.tile.x ||
      route.sourcePortalTile.y !== portal.tile.y
    ) {
      throw new Error(`The route for ${map.source.id}/${portal.id} does not match the map content.`);
    }
    const destination = catalog[route.destinationMapId];
    const entrance = destination?.source.portals.find(({ id }) => id === route.destinationEntranceId);
    if (
      !entrance ||
      route.destinationEntranceTile.x !== entrance.tile.x ||
      route.destinationEntranceTile.y !== entrance.tile.y
    ) {
      throw new Error(`The destination tile for ${map.source.id}/${portal.id} does not match the map content.`);
    }
  }
}
