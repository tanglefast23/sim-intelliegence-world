import { WORLD_MAP_CATALOG } from '../map-catalog';
import { tileKey } from '../../../world/maps/schema';
import {
  PORTAL_ZONE_DEPTH,
  PORTAL_ZONE_HALF_WIDTH,
  portalAtTile,
  portalZoneTiles,
} from '../../../world/transfers/portal-zone';

describe('portal travel zones', () => {
  test('each portal owns a walkable pad around its tile', () => {
    for (const map of Object.values(WORLD_MAP_CATALOG)) {
      for (const portal of map.source.portals) {
        const tiles = portalZoneTiles(map, portal);
        expect(tiles).toContainEqual(portal.tile);
        expect(tiles.length).toBeGreaterThan(PORTAL_ZONE_HALF_WIDTH * 2);
        expect(tiles.length).toBeLessThanOrEqual((PORTAL_ZONE_HALF_WIDTH * 2 + 1) * PORTAL_ZONE_DEPTH);
        for (const tile of tiles) {
          expect(map.blockedKeys.has(tileKey(tile))).toBe(false);
          expect(portalAtTile(map, tile)).toEqual(portal);
        }
      }
    }
  });

  test('the pad stays near its own edge', () => {
    const map = WORLD_MAP_CATALOG.northwest_residential;
    const portal = map.portalById.get('to-downtown')!;
    expect(portalZoneTiles(map, portal).every(({ x }) => x >= 63 - PORTAL_ZONE_DEPTH)).toBe(true);
    expect(portalAtTile(map, { x: 32, y: 24 })).toBeUndefined();
  });
});
