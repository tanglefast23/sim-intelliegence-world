import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import northwestMapJson from '../../../../content/maps/northwest.json';
import { compileWorldMapV2 } from '../../maps/compiler';
import { pointsInRect, tileKey, WorldMapV2Schema } from '../../maps/schema';
import { visualBoundsIntersectTileWindow } from '../visual-bounds';

const SOURCE = WorldMapV2Schema.parse(northwestMapJson);
const KNOWN_LOCATIONS = new Set([SOURCE.id, ...SOURCE.locationBindings.map(({ locationId }) => locationId)]);

function compile(visualBoundsBySprite?: Readonly<Record<string, Readonly<{
  left: number;
  top: number;
  right: number;
  bottom: number;
}>>>) {
  return compileWorldMapV2(SOURCE, {
    knownLocationIds: KNOWN_LOCATIONS,
    validateDensity: false,
    visualBoundsBySprite,
  });
}

describe('immutable art presentation index', () => {
  test('is byte deterministic across fresh compiles and does not use save or simulation state', () => {
    const first = compile();
    const second = compile();
    expect(second.presentation).toEqual(first.presentation);
    expect(second.presentation.hash).toBe(first.presentation.hash);
    expect(Object.isFrozen(first.presentation)).toBe(true);
    expect(Object.isFrozen(first.presentation.ground)).toBe(true);
    expect(first.presentation.ground).toHaveLength(64 * 48);
    expect(first.presentation.mapId).toBe('northwest_residential');
    const source = readFileSync(resolve('src/world/presentation/art-presentation.ts'), 'utf8');
    expect(source).not.toMatch(/Math\.random|Date\.now|WorldState|reduceCommand|simulation/u);
  });

  test('keeps internal logical variants out of maps, saves, events, and public sprite validation', () => {
    const compiled = compile();
    expect(compiled.presentation.ground.some(({ logicalVariantId }) => logicalVariantId.endsWith('-a'))).toBe(true);
    expect(JSON.stringify(compiled.source)).not.toContain('logicalVariantId');
    expect(JSON.stringify(compiled.source)).not.toContain('boardwalk-a');
    for (const path of [
      'content/maps/northwest.json',
      'content/maps/northeast.json',
      'content/maps/southwest.json',
      'content/maps/southeast.json',
      'src/domain/state/schema.ts',
    ]) {
      expect(readFileSync(resolve(path), 'utf8')).not.toMatch(/logicalVariantId|\.variant\./u);
    }
  });

  test('keeps decals presentation-only and outside collision and interaction owners', () => {
    const compiled = compile();
    expect(compiled.presentation.decals.every(({ solid, interactive }) => !solid && !interactive)).toBe(true);
    expect(compiled.presentation.decals.every(({ tile }) => !compiled.staticSolidOwnerByTile.has(tileKey(tile)))).toBe(true);
    expect(compiled.presentation.transitions.every(({ solid, interactive }) => !solid && !interactive)).toBe(true);
    expect(compiled.presentation.transitions.every(({ sprite }) => sprite === null)).toBe(true);
  });

  test('derives authored roof cells without changing roof masks or ownership', () => {
    const compiled = compile();
    for (const roof of SOURCE.roofGroups) {
      const expected = new Set(roof.cells.flatMap(pointsInRect).map(tileKey));
      const presented = new Set(compiled.presentation.roofs
        .filter(({ roofGroupId }) => roofGroupId === roof.id)
        .map(({ tile }) => tileKey(tile)));
      expect(presented).toEqual(expected);
      expect(compiled.roofGroupById.get(roof.id)?.cellKeys).toEqual(expected);
    }
  });

  test('uses visual bounds for culling without changing any solid, route, or density authority', () => {
    const ordinary = compile();
    const overhang = compile({ 'tile.boardwalk': { left: -64, top: -64, right: 96, bottom: 96 } });
    expect(overhang.blockedKeys).toEqual(ordinary.blockedKeys);
    expect(overhang.staticSolidOwnerByTile).toEqual(ordinary.staticSolidOwnerByTile);
    expect(overhang.interactionById).toEqual(ordinary.interactionById);
    expect(overhang.densityByAreaId).toEqual(ordinary.densityByAreaId);
    expect(visualBoundsIntersectTileWindow(
      { x: 12, y: 12 },
      { left: -64, top: -64, right: 96, bottom: 96 },
      { minimumX: 10, minimumY: 10, maximumX: 10, maximumY: 10 },
    )).toBe(true);
    expect(visualBoundsIntersectTileWindow(
      { x: 12, y: 12 },
      { left: 0, top: 0, right: 32, bottom: 32 },
      { minimumX: 10, minimumY: 10, maximumX: 10, maximumY: 10 },
    )).toBe(false);
  });
});
