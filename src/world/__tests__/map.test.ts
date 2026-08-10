import northwestMapJson from '../../../content/maps/northwest.json';
import northeastMapJson from '../../../content/maps/northeast.json';
import southwestMapJson from '../../../content/maps/southwest.json';
import southeastMapJson from '../../../content/maps/southeast.json';
import { ATLAS_INDEX } from '../../render/atlas';
import { findCardinalPath } from '../pathfinding/astar';
import {
  compileWorldMap,
  pointsInRect,
  roofGroupAt,
  spawnAt,
  tileKey,
  type WorldMap,
} from '../maps/schema';
import { buildWorldMapCatalog } from '../maps/catalog';
import { NEIGHBORHOOD_ROUTES } from '../transfers/routes';

const KNOWN_SPRITES = new Set(ATLAS_INDEX.tiles);

describe('northwest world map', () => {
  test('compiles the locked 64x48 layers and validates all authored references', () => {
    const map = compileWorldMap(northwestMapJson, KNOWN_SPRITES);
    expect(map.source).toEqual(expect.objectContaining({
      id: 'northwest_residential',
      width: 64,
      height: 48,
      tileSize: 32,
    }));
    expect(map.groundSprites).toHaveLength(64 * 48);
    expect(map.source.areas.map(({ id }) => id)).toEqual([
      'bedroom', 'bathroom', 'storage', 'kitchen', 'social',
    ]);
    expect(map.source.portals.map(({ edge }) => edge)).toEqual(['east', 'south']);
  });

  test('all five villa areas and the exterior are cardinally reachable', () => {
    const map = compileWorldMap(northwestMapJson, KNOWN_SPRITES);
    const start = spawnAt(map, 'protagonist');
    for (const area of map.source.areas) {
      const target = pointsInRect(area.bounds).find((tile) => !map.blockedKeys.has(tileKey(tile)));
      expect(target).toBeDefined();
      const result = findCardinalPath({
        width: map.source.width,
        height: map.source.height,
        start,
        target: target!,
        blockedKeys: map.blockedKeys,
      });
      expect(result.status).toBe('found');
    }
    expect(findCardinalPath({
      width: map.source.width,
      height: map.source.height,
      start,
      target: { x: 16, y: 25 },
      blockedKeys: map.blockedKeys,
    }).status).toBe('found');
  });

  test('keeps the roof hidden through its door tile and restores it outside', () => {
    const map = compileWorldMap(northwestMapJson, KNOWN_SPRITES);
    expect(roofGroupAt(map, { x: 18, y: 18 })).toBe('protagonist-villa-roof');
    expect(roofGroupAt(map, { x: 15, y: 24 })).toBe('protagonist-villa-roof');
    expect(roofGroupAt(map, { x: 15, y: 25 })).toBeUndefined();
  });

  test('rejects blocked portals and unknown sprites', () => {
    const blockedPortal = structuredClone(northwestMapJson) as WorldMap;
    blockedPortal.collision.rectangles.push({ id: 'bad-portal', x: 63, y: 24, width: 1, height: 1 });
    expect(() => compileWorldMap(blockedPortal, KNOWN_SPRITES)).toThrow('Portal to-downtown is blocked');

    const unknownSprite = structuredClone(northwestMapJson) as WorldMap;
    unknownSprite.props[0]!.sprite = 'tile.not-real';
    expect(() => compileWorldMap(unknownSprite, KNOWN_SPRITES)).toThrow('unknown atlas sprite');
  });
});

describe('four-neighborhood catalog', () => {
  test('compiles the reciprocal 2x2 square and its eight routes', () => {
    const catalog = buildWorldMapCatalog({
      northwest_residential: northwestMapJson,
      northeast_downtown: northeastMapJson,
      southwest_commercial: southwestMapJson,
      southeast_docks: southeastMapJson,
    }, KNOWN_SPRITES);
    expect(Object.keys(catalog)).toEqual([
      'northwest_residential', 'northeast_downtown', 'southwest_commercial', 'southeast_docks',
    ]);
    expect(Object.values(catalog).map(({ source }) => source.portals.length)).toEqual([2, 2, 2, 2]);
    expect(NEIGHBORHOOD_ROUTES).toHaveLength(8);
    expect(catalog.southeast_docks.source.props).toContainEqual(expect.objectContaining({ id: 'ferry-terminal' }));
    expect(catalog.southeast_docks.source.interactions).toEqual([]);
  });

  test('rejects route drift from map content', () => {
    const drifted = structuredClone(northeastMapJson);
    drifted.portals[0]!.tile.y = 23;
    expect(() => buildWorldMapCatalog({
      northwest_residential: northwestMapJson,
      northeast_downtown: drifted,
      southwest_commercial: southwestMapJson,
      southeast_docks: southeastMapJson,
    }, KNOWN_SPRITES)).toThrow();
  });
});
