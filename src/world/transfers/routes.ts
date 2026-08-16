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

/**
 * The next leg an actor should walk to reach `destinationMapId`.
 *
 * Halcyra is a 2x2 grid, so two map pairs are diagonal and share no portal:
 * northwest/southeast and northeast/southwest. This used to throw for those, and because it is
 * called from the schedule tick inside a React render, one NPC with a diagonal schedule goal took
 * the whole interface down with an uncaught error.
 *
 * A diagonal now returns the FIRST LEG through a shared cardinal neighbour. The caller books that
 * transfer, the actor arrives one map closer, and the next tick asks again and gets a direct route.
 * A cardinal pair still returns exactly the route it always did, so nothing that worked before
 * changes — only the case that used to throw behaves differently.
 */
export function routeBetween(originMapId: string, destinationMapId: string): NeighborhoodRoute {
  const direct = NEIGHBORHOOD_ROUTES.find((candidate) => (
    candidate.originMapId === originMapId && candidate.destinationMapId === destinationMapId
  ));
  if (direct) return direct;
  // NEIGHBORHOOD_ROUTES is sorted by origin then portal id, so the chosen leg is deterministic.
  const firstLeg = NEIGHBORHOOD_ROUTES.find((candidate) => (
    candidate.originMapId === originMapId &&
    NEIGHBORHOOD_ROUTES.some((onward) => (
      onward.originMapId === candidate.destinationMapId &&
      onward.destinationMapId === destinationMapId
    ))
  ));
  if (firstLeg) return firstLeg;
  throw new Error(`Maps ${originMapId} and ${destinationMapId} are not connected.`);
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
