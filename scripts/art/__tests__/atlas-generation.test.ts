import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import revisionPixelHashes from '../../../assets/source/art/revision-1-pixel-hashes.json';
import { buildAtlas, validateAtlasArtifacts, writeAtlas } from '../build-world-atlas';
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

function rgbaAt(bitmap: ReturnType<typeof decodePng>, x: number, y: number): readonly number[] {
  const offset = (y * bitmap.width + x) * 4;
  return [...bitmap.data.subarray(offset, offset + 4)];
}

function aggregatePublicCellHash(
  bitmap: ReturnType<typeof decodePng>,
  sprites: ReturnType<typeof buildAtlas>['index']['sprites'],
  publicIds: readonly string[],
): string {
  const hash = createHash('sha256');
  for (const id of [...publicIds].sort()) {
    const rectangle = sprites[id];
    if (!rectangle) throw new Error(`Missing public cell ${id}.`);
    hash.update(`${id}\0${rectangle.width}x${rectangle.height}\0`);
    hash.update(rectanglePixels(bitmap, rectangle));
  }
  return hash.digest('hex');
}

describe('deterministic SI World atlas generation', () => {
  test('produces a byte-identical RGBA atlas and stable index', () => {
    const first = buildAtlas();
    const second = buildAtlas();
    expect(first.png.equals(second.png)).toBe(true);
    expect(first.index).toEqual(second.index);
    expect(first.report).toEqual(second.report);
    expect(first.png[25]).toBe(6);
    expect(first.index.version).toBe(3);
    expect(first.index.artRevision).toBe(1);
    expect(first.index.image).toMatchObject({ colorType: 'rgba', gutter: 1 });
    expect(Object.keys(first.index.sprites)).toHaveLength(187);
    expect(first.index.tiles).toHaveLength(97);
    expect(first.index.groundCells).toHaveLength(10);
    expect(first.index.transparentPartCells).toHaveLength(87);
    expect(createHash('sha256').update(first.png).digest('hex')).toBe(first.index.image.sha256);
    expect(first.index.publicSpriteIds).toEqual(Object.keys(first.index.sprites));
    expect(first.index.internalReviewSpriteIds).toEqual([]);
    expect(first.report.forecast).toMatchObject({ rawRectangleArea: 714_744, width: 1024 });
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

  test('extrudes every edge and corner without uncontrolled transparent RGB', () => {
    const { png, index } = buildAtlas();
    const bitmap = decodePng(png);
    for (const rectangle of Object.values(index.sprites)) {
      for (let y = 0; y < rectangle.height; y += 1) {
        expect(rgbaAt(bitmap, rectangle.x - 1, rectangle.y + y)).toEqual(rgbaAt(bitmap, rectangle.x, rectangle.y + y));
        expect(rgbaAt(bitmap, rectangle.x + rectangle.width, rectangle.y + y)).toEqual(
          rgbaAt(bitmap, rectangle.x + rectangle.width - 1, rectangle.y + y),
        );
      }
      for (let x = 0; x < rectangle.width; x += 1) {
        expect(rgbaAt(bitmap, rectangle.x + x, rectangle.y - 1)).toEqual(rgbaAt(bitmap, rectangle.x + x, rectangle.y));
        expect(rgbaAt(bitmap, rectangle.x + x, rectangle.y + rectangle.height)).toEqual(
          rgbaAt(bitmap, rectangle.x + x, rectangle.y + rectangle.height - 1),
        );
      }
      expect(rgbaAt(bitmap, rectangle.x - 1, rectangle.y - 1)).toEqual(rgbaAt(bitmap, rectangle.x, rectangle.y));
      expect(rgbaAt(bitmap, rectangle.x + rectangle.width, rectangle.y + rectangle.height)).toEqual(
        rgbaAt(bitmap, rectangle.x + rectangle.width - 1, rectangle.y + rectangle.height - 1),
      );
    }
    for (let offset = 0; offset < bitmap.data.length; offset += 4) {
      if (bitmap.data[offset + 3] === 0) {
        expect([...bitmap.data.subarray(offset, offset + 3)]).toEqual([0, 0, 0]);
      }
    }
  });

  test('rejects a partial or stale candidate before replacement', () => {
    const built = buildAtlas();
    const staleIndex = JSON.parse(JSON.stringify(built.index)) as typeof built.index;
    (staleIndex.image as { sha256: string }).sha256 = '0'.repeat(64);
    expect(() => validateAtlasArtifacts(built.png, staleIndex, built.report)).toThrow('digest');
    expect(() => validateAtlasArtifacts(Buffer.from('not png'), built.index, built.report)).toThrow();
    const foreignVisibilityIndex = JSON.parse(JSON.stringify(built.index)) as typeof built.index;
    (foreignVisibilityIndex.publicSpriteIds as string[])[0] = 'tile.foreign-id';
    expect(() => validateAtlasArtifacts(built.png, foreignVisibilityIndex, built.report)).toThrow(
      'missing or has the wrong visibility',
    );
  });

  test('does not rewrite the ten authoritative character sources', () => {
    const characterRoot = resolve(process.cwd(), 'assets/source/characters');
    const before = Object.fromEntries(readdirSync(characterRoot).sort().map((name) => [
      name,
      createHash('sha256').update(readFileSync(resolve(characterRoot, name))).digest('hex'),
    ]));
    writeAtlas();
    const after = Object.fromEntries(readdirSync(characterRoot).sort().map((name) => [
      name,
      createHash('sha256').update(readFileSync(resolve(characterRoot, name))).digest('hex'),
    ]));
    expect(Object.keys(after)).toHaveLength(10);
    expect(after).toEqual(before);
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

  test('keeps every public inner cell and ten opaque ground cells byte stable', () => {
    const tiles = loadTileSources();
    expect(tiles).toHaveLength(10);
    expect(new Set(tiles.map(({ id }) => id)).size).toBe(10);
    expect(tiles.every(({ cellClass }) => cellClass === 'ground')).toBe(true);
    const { png, index } = buildAtlas();
    const bitmap = decodePng(png);
    expect(aggregatePublicCellHash(bitmap, index.sprites, index.publicSpriteIds)).toBe(
      revisionPixelHashes.allPublicCellsAggregateSha256,
    );
    expect(revisionPixelHashes.artRevision).toBe(1);
    for (const [name, expectedHash] of Object.entries(revisionPixelHashes.cells)) {
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
