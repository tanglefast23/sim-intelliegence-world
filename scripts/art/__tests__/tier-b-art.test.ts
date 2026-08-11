import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import authorityBaseline from '../../../assets/source/art/phase-31-content-authority-baseline.json';
import revision4PixelHashes from '../../../assets/source/art/revision-4-pixel-hashes.json';
import northeastMap from '../../../content/maps/northeast.json';
import southeastMap from '../../../content/maps/southeast.json';
import southwestMap from '../../../content/maps/southwest.json';
import { WORLD_MAP_CATALOG } from '../../../src/application/runtime/map-catalog';
import { ART_PRESENTATION_REVISION, MATERIAL_RECIPE_BY_ID } from '../../../src/world/presentation/recipes';
import { buildAtlas } from '../build-world-atlas';
import { buildContentAuthorityReport } from '../content-authority';
import { decodePng } from '../png';

const MAP_OVERRIDE_PREFIXES = {
  northeast_downtown: ['tile.boardwalk-neon-', 'tile.plaza-paver-neon-', 'tile.warm-sand-neon-'],
  southwest_commercial: ['tile.boardwalk-palm-', 'tile.pale-concrete-palm-', 'tile.warm-sand-palm-'],
  southeast_docks: ['tile.boardwalk-harbor-', 'tile.pale-concrete-harbor-', 'tile.plaza-paver-harbor-'],
} as const;

const CHANGED_EXISTING_SPRITES = [
  'tile.counter-left', 'tile.sign-neon', 'tile.sign-market', 'tile.sign-civic',
  'tile.fixture-lamp', 'tile.fixture-planter',
  'tile.landmark-ferry-left', 'tile.landmark-ferry-right',
  ...['downtown', 'commercial', 'civic'].flatMap((family) =>
    Array.from({ length: 16 }, (_unused, mask) => `tile.wall-${family}-${mask.toString(16)}`)),
] as const;

const NEW_SPRITES = [
  'tile.dark-asphalt-b',
  ...['a', 'b'].flatMap((variant) => [
    `tile.boardwalk-neon-${variant}`,
    `tile.boardwalk-palm-${variant}`,
    `tile.boardwalk-harbor-${variant}`,
    `tile.plaza-paver-neon-${variant}`,
    `tile.plaza-paver-harbor-${variant}`,
    `tile.pale-concrete-palm-${variant}`,
    `tile.pale-concrete-harbor-${variant}`,
  ]),
  ...['a', 'b', 'c', 'd'].flatMap((variant) => [
    `tile.warm-sand-neon-${variant}`,
    `tile.warm-sand-palm-${variant}`,
  ]),
] as const;

const LOCKED_SUNWARD_SPRITES = [
  'tile.warm-sand', 'tile.warm-sand-b', 'tile.warm-sand-c', 'tile.warm-sand-d',
  'tile.villa-floor', 'tile.villa-floor-b', 'tile.villa-floor-c', 'tile.villa-floor-d',
  'tile.plaza-paver', 'tile.plaza-paver-b', 'tile.boardwalk', 'tile.boardwalk-b',
  'tile.open-door', 'tile.closed-door', 'tile.closed-locked-door',
  'tile.bed-head', 'tile.bed-foot', 'tile.sofa-left', 'tile.sofa-right',
  'tile.table-left', 'tile.table-right', 'tile.counter-right', 'tile.sign-spa', 'tile.plant-palm',
  'tile.roof-sunward-base', 'tile.roof-sunward-edge', 'tile.roof-sunward-corner',
  ...Array.from({ length: 16 }, (_unused, mask) => `tile.wall-villa-${mask.toString(16)}`),
] as const;

function rectanglePixels(
  bitmap: ReturnType<typeof decodePng>,
  rectangle: Readonly<{ x: number; y: number; width: number; height: number }>,
): Buffer {
  const pixels = Buffer.alloc(rectangle.width * rectangle.height * 4);
  for (let row = 0; row < rectangle.height; row += 1) {
    const sourceStart = ((rectangle.y + row) * bitmap.width + rectangle.x) * 4;
    bitmap.data.copy(pixels, row * rectangle.width * 4, sourceStart, sourceStart + rectangle.width * 4);
  }
  return pixels;
}

function cellHash(pixels: Buffer): string {
  return createHash('sha256').update(pixels).digest('hex');
}

function alphaCount(pixels: Buffer): number {
  return [...pixels].filter((_value, offset) => offset % 4 === 3 && pixels[offset] !== 0).length;
}

function alphaMask(pixels: Buffer): string {
  return [...pixels].filter((_value, offset) => offset % 4 === 3)
    .map((alpha) => alpha === 0 ? '0' : '1').join('');
}

describe('Phase 31 Tier B shared and district art', () => {
  const built = buildAtlas();
  const bitmap = decodePng(built.png);
  const revision4Cells = revision4PixelHashes.cells as Readonly<Record<string, string>>;

  test('uses revision 6 map-specific material cells without changing public map sprites', () => {
    expect(ART_PRESENTATION_REVISION).toBe(6);
    for (const id of NEW_SPRITES) expect(built.index.publicSpriteIds).toContain(id);
    expect(MATERIAL_RECIPE_BY_ID['dark-asphalt']?.publicVariantSprites).toEqual([
      'tile.dark-asphalt', 'tile.dark-asphalt-b',
    ]);
    for (const [mapId, prefixes] of Object.entries(MAP_OVERRIDE_PREFIXES)) {
      const map = WORLD_MAP_CATALOG[mapId as keyof typeof WORLD_MAP_CATALOG];
      for (const prefix of prefixes) {
        const cells = map.presentation.ground.filter(({ sprite }) => sprite.startsWith(prefix));
        expect(cells.length).toBeGreaterThan(0);
      }
    }
  });

  test('changes only the intended existing art and preserves completed Sunward families', () => {
    for (const id of CHANGED_EXISTING_SPRITES) {
      const rectangle = built.index.sprites[id];
      expect(rectangle).toBeDefined();
      expect(revision4Cells[id]).toBeDefined();
      expect(cellHash(rectanglePixels(bitmap, rectangle!))).not.toBe(revision4Cells[id]);
    }
    for (const id of LOCKED_SUNWARD_SPRITES) {
      const rectangle = built.index.sprites[id];
      expect(rectangle).toBeDefined();
      expect(cellHash(rectanglePixels(bitmap, rectangle!))).toBe(revision4Cells[id]);
    }
  });

  test('gives all Tier B wall masks visible, unique, structural identities', () => {
    for (const family of ['downtown', 'commercial', 'civic'] as const) {
      const hashes = (built.index.walls[family] ?? []).map((id) => {
        const pixels = rectanglePixels(bitmap, built.index.sprites[id]!);
        expect(alphaCount(pixels)).toBeGreaterThanOrEqual(500);
        return cellHash(pixels);
      });
      expect(hashes).toHaveLength(16);
      expect(new Set(hashes).size).toBe(16);
    }
    for (let mask = 0; mask < 16; mask += 1) {
      const masks = ['downtown', 'commercial', 'civic'].map((family) => alphaMask(rectanglePixels(
        bitmap,
        built.index.sprites[`tile.wall-${family}-${mask.toString(16)}`]!,
      )));
      expect(new Set(masks).size).toBe(3);
    }
  });

  test('keeps every Tier B solid footprint visibly represented at the same offset', () => {
    for (const map of [northeastMap, southwestMap, southeastMap]) {
      for (const object of map.objects) {
        for (const footprint of object.solidFootprints) {
          for (let y = 0; y < footprint.bounds.height; y += 1) {
            for (let x = 0; x < footprint.bounds.width; x += 1) {
              const offsetX = footprint.bounds.x + x;
              const offsetY = footprint.bounds.y + y;
              const part = object.renderParts.find(({ offset }) => offset.x === offsetX && offset.y === offsetY);
              expect(part).toBeDefined();
              const rectangle = built.index.sprites[part!.sprite];
              expect(rectangle).toBeDefined();
              expect(alphaCount(rectanglePixels(bitmap, rectangle!))).toBeGreaterThanOrEqual(128);
            }
          }
        }
      }
    }
  });

  test('keeps Tier B content authority byte-for-byte at the Phase 30 baseline', () => {
    expect(buildContentAuthorityReport()).toEqual(authorityBaseline);
    for (const map of [northeastMap, southwestMap, southeastMap]) {
      expect(map.layoutRevision).toBe(1);
      expect(map.roofGroups).toHaveLength(0);
      expect(map.doors).toHaveLength(0);
    }
  });

  test('records the district rules and explicit roof and door N/A cases', () => {
    const bible = readFileSync(resolve(process.cwd(), 'docs/art/halcyra-art-bible.md'), 'utf8');
    expect(bible).toContain('## 19. Phase 31 Tier B district family ledger');
    for (const label of ['Neon Crescent', 'Palm Exchange', 'Harbor Authority', 'Downtown', 'Commercial', 'Civic']) {
      expect(bible).toContain(label);
    }
    expect(bible).toContain('Roof and door review is `N/A`');
  });
});
