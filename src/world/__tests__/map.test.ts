import northeastMapJson from '../../../content/maps/northeast.json';
import northwestMapJson from '../../../content/maps/northwest.json';
import southeastMapJson from '../../../content/maps/southeast.json';
import southwestMapJson from '../../../content/maps/southwest.json';
import productionLocations from '../../../content/world/locations/production.json';
import prototypeLocations from '../../../content/world/locations/prototype.json';
import { WORLD_MAP_CATALOG } from '../../application/runtime/map-catalog';
import { ATLAS_INDEX } from '../../render/atlas';
import { roofGroupAtV2 } from '../maps/compiled-v2';
import { buildWorldMapV2Catalog } from '../maps/catalog';
import { compileWorldMapV2 } from '../maps/compiler';
import { pointsInRect, tileKey, type WorldMapV2 } from '../maps/schema';
import { findCardinalPath } from '../pathfinding/astar';
import { NEIGHBORHOOD_ROUTES } from '../transfers/routes';

const KNOWN_SPRITES = new Set(ATLAS_INDEX.tiles);
const LOCATION_NEIGHBORHOODS = new Map(
  [...prototypeLocations, ...productionLocations].map(({ id, neighborhoodId }) => [id, neighborhoodId]),
);

function compile(candidate: unknown) {
  return compileWorldMapV2(candidate, {
    knownLocationIds: new Set(LOCATION_NEIGHBORHOODS.keys()),
    knownSprites: KNOWN_SPRITES,
    validateDensity: true,
  });
}

describe('northwest world map v2', () => {
  test('compiles one visible collision authority with final density profiles', () => {
    const map = WORLD_MAP_CATALOG.northwest_residential;
    expect(map.source).toEqual(expect.objectContaining({
      schemaVersion: 2,
      layoutRevision: 1,
      id: 'northwest_residential',
      width: 64,
      height: 48,
      tileSize: 32,
    }));
    expect(map.groundSprites).toHaveLength(64 * 48);
    expect(map.source.areas.map(({ id }) => id)).toEqual([
      'bedroom', 'bathroom', 'storage', 'kitchen', 'social', 'shoreglass-spa',
      'sunward-patio', 'villa-promenade', 'beach-market', 'public-beach',
    ]);
    expect(map.densityByAreaId.size).toBe(10);
    expect(new Set(map.staticSolidOwnerByTile.keys())).toEqual(map.blockedKeys);
  });

  test('all areas, portals, and the exterior are cardinally reachable', () => {
    const map = WORLD_MAP_CATALOG.northwest_residential;
    const start = map.source.spawns.protagonist!;
    for (const area of map.source.areas) {
      const target = pointsInRect(area.bounds).find((tile) => !map.blockedKeys.has(tileKey(tile)));
      expect(target).toBeDefined();
      expect(findCardinalPath({
        width: map.source.width,
        height: map.source.height,
        start,
        target: target!,
        blockedKeys: map.blockedKeys,
      }).status).toBe('found');
    }
    for (const portal of map.source.portals) {
      expect(findCardinalPath({
        width: map.source.width,
        height: map.source.height,
        start,
        target: portal.tile,
        blockedKeys: map.blockedKeys,
      }).status).toBe('found');
    }
  });

  test('uses the compiled roof mask through its door and restores it outside', () => {
    const map = WORLD_MAP_CATALOG.northwest_residential;
    expect(roofGroupAtV2(map, { x: 18, y: 18 })).toBe('protagonist-villa-roof');
    expect(roofGroupAtV2(map, { x: 15, y: 24 })).toBe('protagonist-villa-roof');
    expect(roofGroupAtV2(map, { x: 15, y: 25 })).toBeUndefined();
  });

  test('rejects blocked portals and unknown transparent-part sprites', () => {
    const blockedPortal = structuredClone(northwestMapJson) as WorldMapV2;
    blockedPortal.terrainSolids.push({ id: 'bad-portal', kind: 'other', bounds: { x: 63, y: 24, width: 1, height: 1 } });
    expect(() => compile(blockedPortal)).toThrow('Portal to-downtown is blocked');

    const unknownSprite = structuredClone(northwestMapJson) as WorldMapV2;
    unknownSprite.objects[0]!.renderParts[0]!.sprite = 'tile.not-real';
    expect(() => compile(unknownSprite)).toThrow('unknown atlas sprite');
  });
});

describe('four-neighborhood v2 catalog', () => {
  test('compiles the reciprocal square, bindings, and eight generated routes', () => {
    expect(Object.keys(WORLD_MAP_CATALOG)).toEqual([
      'northwest_residential', 'northeast_downtown', 'southwest_commercial', 'southeast_docks',
    ]);
    expect(Object.values(WORLD_MAP_CATALOG).map(({ source }) => source.portals.length)).toEqual([2, 2, 2, 2]);
    expect(NEIGHBORHOOD_ROUTES).toHaveLength(8);
    expect([...WORLD_MAP_CATALOG.southeast_docks.objectPartById.values()])
      .toContainEqual(expect.objectContaining({ objectId: 'ferry-landmark' }));
  });

  test('rejects portal drift from generated route identities', () => {
    const drifted = structuredClone(northeastMapJson) as WorldMapV2;
    drifted.portals[0]!.tile.y = 23;
    expect(() => buildWorldMapV2Catalog({
      northwest_residential: northwestMapJson,
      northeast_downtown: drifted,
      southwest_commercial: southwestMapJson,
      southeast_docks: southeastMapJson,
    }, {
      locationNeighborhoodById: LOCATION_NEIGHBORHOODS,
      knownSprites: KNOWN_SPRITES,
      validateDensity: true,
    })).toThrow();
  });
});
