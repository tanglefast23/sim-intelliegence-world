import { createHash } from 'node:crypto';

import { buildAtlas } from '../build-world-atlas';
import {
  composeFrontFrame,
  composePortrait,
  loadCharacterSources,
  loadTransparentPartSources,
  loadTileSources,
  loadWallSources,
  tokenFrameToBitmap,
} from '../character-source';
import { composeLateralFrame } from '../lateral-legs';
import { decodePng } from '../png';
import { CHARACTER_IDS } from '../../../src/render/atlas';

function alphaMask(frame: readonly string[]): string {
  return frame.map((row) => [...row].map((token) => token === '.' ? '.' : '#').join('')).join('\n');
}

function pixelHex(bitmap: ReturnType<typeof decodePng>, offset: number): string {
  return `#${[0, 1, 2].map((channel) => (bitmap.data[offset + channel] as number).toString(16).padStart(2, '0')).join('')}`;
}

function rectanglePixels(
  bitmap: ReturnType<typeof decodePng>,
  rectangle: Readonly<{ x: number; y: number; width: number; height: number }>,
): Buffer {
  const result = Buffer.alloc(rectangle.width * rectangle.height * 4);
  for (let row = 0; row < rectangle.height; row += 1) {
    const sourceStart = ((rectangle.y + row) * bitmap.width + rectangle.x) * 4;
    bitmap.data.copy(result, row * rectangle.width * 4, sourceStart, sourceStart + rectangle.width * 4);
  }
  return result;
}

const LOCKED_GROUND_PIXEL_HASHES = {
  'tile.warm-sand': 'c82ebb11f2f07bf9bc69ccd00ec5e92c7ec1f9da739fba7cba8163339a54c071',
  'tile.dune-grass': '9dd3d52ada1aaa8ca87f23091b25cba4fd9f33af48ebe3235de0a21b805f2d3f',
  'tile.villa-floor': 'c12ca3f56e41f1a83ec909ded5c1a5b8177b8f8c205538b8ffa2e2fff54381f7',
  'tile.spa-stone': 'de5fa395f039a75981e07518aa980a5841bab72129d68ad7a2d9b8e0a4ee25a2',
  'tile.plaza-paver': 'f2e83eb06ee2c5369f0b6f8db0efd95c1b8ebc077f11b557ea465c45f7e6a132',
  'tile.boardwalk': '4af1ca85ae8ae8f086343f76de336691458b33d9f5d9ce86510aa13079cf30fe',
  'tile.shallow-water': '745015a16e0967be417fa6c0d5ade243ac21db5e9fcf0e7177ccb320c5d6d704',
  'tile.garden-soil': 'bc7db30e0a2de879d9db1ea0bc2fce738d5369caa3266101df76255ffb5ef973',
  'tile.pale-concrete': 'e3974445102834d044a1255dc462b0eeae96ec3d7dedd5a4f44de48d805e7773',
  'tile.dark-asphalt': '3288d056c58f872e36c6583767c6ec0ac9b827fe1b9f222f012ef73a01ea3ccd',
} as const;

describe('deterministic SI World atlas generation', () => {
  test('produces a byte-identical RGBA atlas and stable index', () => {
    const first = buildAtlas();
    const second = buildAtlas();
    expect(first.png.equals(second.png)).toBe(true);
    expect(first.index).toEqual(second.index);
    expect(first.png[25]).toBe(6);
    expect(first.index.version).toBe(2);
    expect(first.index.image).toMatchObject({ colorType: 'rgba', gutter: 1 });
    expect(Object.keys(first.index.sprites)).toHaveLength(187);
    expect(first.index.tiles).toHaveLength(97);
    expect(first.index.groundCells).toHaveLength(10);
    expect(first.index.transparentPartCells).toHaveLength(87);
    expect(createHash('sha256').update(first.png).digest('hex')).toHaveLength(64);
  });

  test('keeps all atlas cells inside the generated image', () => {
    const { index } = buildAtlas();
    for (const rectangle of Object.values(index.sprites)) {
      expect(rectangle.x).toBeGreaterThanOrEqual(0);
      expect(rectangle.y).toBeGreaterThanOrEqual(0);
      expect(rectangle.x + rectangle.width).toBeLessThanOrEqual(index.image.width);
      expect(rectangle.y + rectangle.height).toBeLessThanOrEqual(index.image.height);
    }
  });

  test('keeps one transparent pixel between every packed cell', () => {
    const { png, index } = buildAtlas();
    const bitmap = decodePng(png);
    for (const rectangle of Object.values(index.sprites)) {
      for (let y = Math.max(0, rectangle.y - 1); y <= Math.min(bitmap.height - 1, rectangle.y + rectangle.height); y += 1) {
        for (const x of [rectangle.x - 1, rectangle.x + rectangle.width]) {
          if (x >= 0 && x < bitmap.width) {
            expect(bitmap.data[(y * bitmap.width + x) * 4 + 3]).toBe(0);
          }
        }
      }
      for (let x = Math.max(0, rectangle.x - 1); x <= Math.min(bitmap.width - 1, rectangle.x + rectangle.width); x += 1) {
        for (const y of [rectangle.y - 1, rectangle.y + rectangle.height]) {
          if (y >= 0 && y < bitmap.height) {
            expect(bitmap.data[(y * bitmap.width + x) * 4 + 3]).toBe(0);
          }
        }
      }
    }
  });

  test('builds ten distinct identities from the six named source layers', () => {
    const sources = loadCharacterSources();
    expect(sources.map(({ id }) => id).sort()).toEqual([...CHARACTER_IDS].sort());
    const silhouettes = new Set(sources.map((source) => alphaMask(composeFrontFrame(source, 0))));
    expect(silhouettes.size).toBeGreaterThanOrEqual(7);
    for (const source of sources) {
      expect(Object.keys(source.sourceLayers)).toEqual([
        'legs', 'torsoAndClothing', 'headAndFace', 'hair', 'accessory', 'heldItem',
      ]);
      expect(composeFrontFrame(source, 0)).not.toEqual(composeFrontFrame(source, 1));
      const frontBitmap = tokenFrameToBitmap(composeFrontFrame(source, 0), source.palette);
      const portraitBitmap = tokenFrameToBitmap(composePortrait(source), source.palette);
      const colors = new Set(Array.from({ length: frontBitmap.width * frontBitmap.height }, (_unused, pixel) =>
        frontBitmap.data[pixel * 4 + 3] === 0 ? 'transparent' : pixelHex(frontBitmap, pixel * 4),
      ));
      const portraitColors = new Set(Array.from(
        { length: portraitBitmap.width * portraitBitmap.height },
        (_unused, pixel) => portraitBitmap.data[pixel * 4 + 3] === 0
          ? 'transparent'
          : pixelHex(portraitBitmap, pixel * 4),
      ));
      expect(colors).toContain(source.palette.K);
      expect(colors).toContain(source.palette[source.identityTokens.hair]);
      expect(colors).toContain(source.palette[source.identityTokens.clothing]);
      expect(colors).toContain(source.palette[source.identityTokens.skin]);
      expect(portraitColors).toContain(source.palette.K);
      expect(portraitColors).toContain(source.palette[source.identityTokens.hair]);
      expect(portraitColors).toContain(source.palette[source.identityTokens.clothing]);
      expect(portraitColors).toContain(source.palette[source.identityTokens.skin]);
    }
  });

  test('uses front billboard bodies with authored lateral legs', () => {
    for (const source of loadCharacterSources()) {
      const left = composeLateralFrame(source, 'left', 0);
      const right = composeLateralFrame(source, 'right', 0);
      expect(left.slice(0, 21)).toEqual(right.slice(0, 21));
      expect(left.slice(21)).not.toEqual(right.slice(21));
      expect(left.flatMap((row) => [...row]).filter((token) => token === 'W').length).toBeGreaterThan(5);
      expect(right.flatMap((row) => [...row]).filter((token) => token === 'W').length).toBeGreaterThan(5);
    }
  });

  test('keeps ten original opaque 32x32 ground cells byte stable', () => {
    const tiles = loadTileSources();
    expect(tiles).toHaveLength(10);
    expect(new Set(tiles.map(({ id }) => id)).size).toBe(10);
    expect(tiles.every(({ cellClass }) => cellClass === 'ground')).toBe(true);
    const { png, index } = buildAtlas();
    const bitmap = decodePng(png);
    for (const [name, expectedHash] of Object.entries(LOCKED_GROUND_PIXEL_HASHES)) {
      const rectangle = index.sprites[name];
      expect(rectangle).toMatchObject({ kind: 'tile', cellClass: 'ground', wallAdjacencyMask: null });
      const pixels = rectanglePixels(bitmap, rectangle!);
      expect([...pixels].filter((_value, offset) => offset % 4 === 3).every((alpha) => alpha === 255)).toBe(true);
      expect(createHash('sha256').update(pixels).digest('hex')).toBe(expectedHash);
    }
  });

  test('keeps authored object parts transparent and covers every functional role', () => {
    const authoredParts = loadTransparentPartSources();
    expect(new Set(authoredParts.map(({ role }) => role))).toEqual(new Set([
      'door', 'furniture', 'sign', 'fixture', 'plant', 'landmark',
    ]));
    const { png, index } = buildAtlas();
    const bitmap = decodePng(png);
    for (const name of index.transparentPartCells) {
      const rectangle = index.sprites[name];
      expect(rectangle).toMatchObject({ kind: 'tile', cellClass: 'transparent-part' });
      const alphas = [...rectanglePixels(bitmap, rectangle!)]
        .filter((_value, offset) => offset % 4 === 3);
      expect(alphas).toContain(0);
      expect(alphas).toContain(255);
    }
  });

  test('maps every orthogonal wall mask to a generated transparent cell', () => {
    const { index } = buildAtlas();
    const walls = loadWallSources();
    expect(walls.map(({ id }) => id)).toEqual(['villa', 'downtown', 'commercial', 'civic']);
    for (const wall of walls) {
      expect(index.walls[wall.id]).toEqual(Array.from({ length: 16 }, (_unused, mask) =>
        `tile.wall-${wall.id}-${mask.toString(16)}`));
      index.walls[wall.id]!.forEach((name, mask) => {
        expect(index.sprites[name]).toMatchObject({
          kind: 'tile',
          sourceId: wall.id,
          cellClass: 'transparent-part',
          wallAdjacencyMask: mask,
        });
      });
    }
  });
});
