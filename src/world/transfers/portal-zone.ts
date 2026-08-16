import type { CompiledMapV2 } from '../maps/compiled-v2';
import { tileKey, type TilePoint } from '../maps/schema';

export type PortalV2 = CompiledMapV2['source']['portals'][number];

/** Tiles either side of the portal tile, along its edge. */
export const PORTAL_ZONE_HALF_WIDTH = 3;
/** Tiles inward from the edge, including the portal tile itself. */
export const PORTAL_ZONE_DEPTH = 3;

const INWARD: Readonly<Record<PortalV2['edge'], TilePoint>> = {
  north: { x: 0, y: 1 },
  south: { x: 0, y: -1 },
  west: { x: 1, y: 0 },
  east: { x: -1, y: 0 },
};

/**
 * The walkable pad around a portal. The player travels by standing anywhere on it, so the pad
 * only keeps tiles that are reachable from the portal tile without crossing a blocker.
 */
export function portalZoneTiles(map: CompiledMapV2, portal: PortalV2): readonly TilePoint[] {
  const inward = INWARD[portal.edge];
  const along = { x: inward.y === 0 ? 0 : 1, y: inward.x === 0 ? 0 : 1 };
  const candidates = new Map<string, TilePoint>();
  for (let depth = 0; depth < PORTAL_ZONE_DEPTH; depth += 1) {
    for (let offset = -PORTAL_ZONE_HALF_WIDTH; offset <= PORTAL_ZONE_HALF_WIDTH; offset += 1) {
      const tile = {
        x: portal.tile.x + inward.x * depth + along.x * offset,
        y: portal.tile.y + inward.y * depth + along.y * offset,
      };
      if (tile.x < 0 || tile.y < 0 || tile.x >= map.source.width || tile.y >= map.source.height) continue;
      if (map.blockedKeys.has(tileKey(tile))) continue;
      candidates.set(tileKey(tile), tile);
    }
  }
  const reached = new Map<string, TilePoint>();
  const queue: TilePoint[] = [portal.tile];
  reached.set(tileKey(portal.tile), portal.tile);
  while (queue.length > 0) {
    const tile = queue.shift()!;
    for (const step of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
      const next = { x: tile.x + step.x, y: tile.y + step.y };
      const key = tileKey(next);
      if (reached.has(key) || !candidates.has(key)) continue;
      reached.set(key, next);
      queue.push(next);
    }
  }
  return [...reached.values()].sort((left, right) => left.y - right.y || left.x - right.x);
}

export function portalZoneContains(map: CompiledMapV2, portal: PortalV2, tile: TilePoint): boolean {
  return portalZoneTiles(map, portal).some((zoneTile) => zoneTile.x === tile.x && zoneTile.y === tile.y);
}

export function portalAtTile(map: CompiledMapV2, tile: TilePoint): PortalV2 | undefined {
  return map.source.portals.find((portal) => portalZoneContains(map, portal, tile));
}
