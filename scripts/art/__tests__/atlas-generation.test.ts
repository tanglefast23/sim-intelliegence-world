import { createHash } from 'node:crypto';

import { buildAtlas } from '../build-world-atlas';
import {
  composeFrontFrame,
  composePortrait,
  loadCharacterSources,
  loadTileSources,
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

describe('deterministic SI World atlas generation', () => {
  test('produces a byte-identical RGBA atlas and stable index', () => {
    const first = buildAtlas();
    const second = buildAtlas();
    expect(first.png.equals(second.png)).toBe(true);
    expect(first.index).toEqual(second.index);
    expect(first.png[25]).toBe(6);
    expect(first.index.image).toMatchObject({ colorType: 'rgba', gutter: 1 });
    expect(Object.keys(first.index.sprites)).toHaveLength(100);
    expect(first.index.tiles).toHaveLength(10);
    expect(createHash('sha256').update(first.png).digest('hex')).toHaveLength(64);
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

  test('contains ten original 32x32 environment tiles', () => {
    const tiles = loadTileSources();
    expect(tiles).toHaveLength(10);
    expect(new Set(tiles.map(({ id }) => id)).size).toBe(10);
  });
});
