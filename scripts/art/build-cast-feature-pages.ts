import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { AtlasIndex, AtlasRect } from './build-world-atlas';
import { drawText } from './build-review-sheet';
import { CHARACTER_LOOKS } from './character-look-roster';
import {
  blitScaled,
  createBitmap,
  decodePng,
  encodePng,
  fillRect,
  parseHexColor,
  setPixel,
  type Bitmap,
} from './png';

const DIRECTIONS = ['front-1', 'rear-1', 'left-1', 'right-1'] as const;

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function crop(source: Bitmap, rectangle: AtlasRect): Bitmap {
  const target = createBitmap(rectangle.width, rectangle.height);
  for (let y = 0; y < rectangle.height; y += 1) {
    for (let x = 0; x < rectangle.width; x += 1) {
      const sourceOffset = ((rectangle.y + y) * source.width + rectangle.x + x) * 4;
      const alpha = source.data[sourceOffset + 3] as number;
      if (alpha === 0) continue;
      setPixel(target, x, y, [
        source.data[sourceOffset] as number,
        source.data[sourceOffset + 1] as number,
        source.data[sourceOffset + 2] as number,
        alpha,
      ]);
    }
  }
  return target;
}

function renderPage(
  atlas: Bitmap,
  index: AtlasIndex,
  pageCharacters: readonly string[],
  pageNumber: number,
): Bitmap {
  const scale = 6;
  const labelWidth = 132;
  const cardWidth = 154;
  const rowHeight = 194;
  const headerHeight = 30;
  const ids = ['protagonist', ...pageCharacters];
  const board = createBitmap(
    labelWidth + DIRECTIONS.length * cardWidth + 8,
    headerHeight + ids.length * rowHeight + 6,
    parseHexColor('#17151b'),
  );
  const ink = parseHexColor('#f4e4a6');
  const muted = parseHexColor('#aaa4b0');
  drawText(board, `FULL CAST FEATURE REVIEW PAGE ${pageNumber}`, 8, 8, ink, 2);
  DIRECTIONS.forEach((direction, column) => {
    drawText(board, direction.replace('-1', ''), labelWidth + column * cardWidth + 48, 20, muted);
  });
  ids.forEach((id, row) => {
    const character = index.characters[id];
    if (!character) throw new Error(`Unknown character ${id}.`);
    const y = headerHeight + row * rowHeight;
    const isHero = id === 'protagonist';
    fillRect(board, 4, y + 4, labelWidth - 8, rowHeight - 8, parseHexColor(isHero ? '#403927' : '#2b2831'));
    drawText(board, isHero ? 'HERO' : character.displayName, 10, y + 88, ink, isHero ? 2 : 1);
    DIRECTIONS.forEach((direction, column) => {
      const x = labelWidth + column * cardWidth;
      fillRect(board, x + 4, y + 4, cardWidth - 8, rowHeight - 8, parseHexColor(isHero ? '#403927' : '#243642'));
      const rectangle = index.sprites[`character.${id}.${direction}`];
      if (!rectangle) throw new Error(`Missing character.${id}.${direction}.`);
      blitScaled(crop(atlas, rectangle), board, x + 5, y + 7, scale);
    });
  });
  return board;
}

function main(root = process.cwd()): void {
  const outputRoot = resolve(root, argument('--output-root'));
  const generatedRoot = resolve(root, 'assets/generated');
  const atlas = decodePng(readFileSync(resolve(generatedRoot, 'world-atlas.png')));
  const index = JSON.parse(readFileSync(resolve(generatedRoot, 'atlas-index.json'), 'utf8')) as AtlasIndex;
  const cast = CHARACTER_LOOKS.map(({ id }) => id).filter((id) => id !== 'protagonist');
  mkdirSync(outputRoot, { recursive: true });
  const pageSize = 5;
  for (let offset = 0; offset < cast.length; offset += pageSize) {
    const pageNumber = Math.floor(offset / pageSize) + 1;
    const output = resolve(outputRoot, `cast-feature-review-page-${pageNumber}-6x.png`);
    writeFileSync(output, encodePng(renderPage(atlas, index, cast.slice(offset, offset + pageSize), pageNumber)), {
      flush: true,
    });
    process.stdout.write(`Cast feature review: ${output}\n`);
  }
}

try {
  main();
} catch (error: unknown) {
  process.stderr.write(`Cast feature review failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
