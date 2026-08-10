import { z } from 'zod';

import { StableIdSchema } from '../../domain/state/ids';
import type { CompiledMapV2 } from '../maps/compiled-v2';
import { TilePointSchema, type CompiledMap } from '../maps/schema';
import { GENERATED_NEIGHBORHOOD_ROUTES } from './generated-routes';

export const NeighborhoodRouteSchema = z.object({
  originMapId: StableIdSchema,
  destinationMapId: StableIdSchema,
  sourcePortalId: StableIdSchema,
  sourcePortalTile: TilePointSchema,
  destinationEntranceId: StableIdSchema,
  destinationEntranceTile: TilePointSchema,
}).strict();
export type NeighborhoodRoute = z.infer<typeof NeighborhoodRouteSchema>;

export const NEIGHBORHOOD_ROUTES: readonly NeighborhoodRoute[] =
  GENERATED_NEIGHBORHOOD_ROUTES.map((route) => NeighborhoodRouteSchema.parse(route));

export function routeBetween(originMapId: string, destinationMapId: string): NeighborhoodRoute {
  const route = NEIGHBORHOOD_ROUTES.find((candidate) => (
    candidate.originMapId === originMapId && candidate.destinationMapId === destinationMapId
  ));
  if (!route) throw new Error(`Maps ${originMapId} and ${destinationMapId} are not cardinal neighbors.`);
  return route;
}

export function deriveNeighborhoodRoutes(
  catalog: Readonly<Record<string, CompiledMapV2>>,
): readonly NeighborhoodRoute[] {
  return Object.values(catalog).flatMap((map) => map.source.portals.map((portal) => {
    const destination = catalog[portal.destinationMapId];
    const entrance = destination?.portalById.get(portal.destinationEntranceId);
    if (!destination || !entrance) {
      throw new Error(`Portal ${map.source.id}/${portal.id} has no compiled destination entrance.`);
    }
    return NeighborhoodRouteSchema.parse({
      originMapId: map.source.id,
      destinationMapId: portal.destinationMapId,
      sourcePortalId: portal.id,
      sourcePortalTile: portal.tile,
      destinationEntranceId: portal.destinationEntranceId,
      destinationEntranceTile: entrance.tile,
    });
  })).sort((left, right) => (
    left.originMapId.localeCompare(right.originMapId, 'en') ||
    left.sourcePortalId.localeCompare(right.sourcePortalId, 'en')
  ));
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
