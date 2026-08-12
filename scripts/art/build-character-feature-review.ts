import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { AtlasIndex, AtlasRect } from './build-world-atlas';
import { drawText } from './build-review-sheet';
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

function main(root = process.cwd()): void {
  const characterId = argument('--character');
  const outputRoot = resolve(root, argument('--output-root'));
  const generatedRoot = resolve(root, 'assets/generated');
  const atlas = decodePng(readFileSync(resolve(generatedRoot, 'world-atlas.png')));
  const index = JSON.parse(readFileSync(resolve(generatedRoot, 'atlas-index.json'), 'utf8')) as AtlasIndex;
  const character = index.characters[characterId];
  if (!character) throw new Error(`Unknown character ${characterId}.`);
  const scale = 6;
  const cardWidth = 156;
  const cardHeight = 202;
  const labelWidth = 128;
  const headerHeight = 30;
  const board = createBitmap(
    labelWidth + DIRECTIONS.length * cardWidth + 8,
    headerHeight + cardHeight * 2 + 8,
    parseHexColor('#17151b'),
  );
  const ink = parseHexColor('#f4e4a6');
  const muted = parseHexColor('#aaa4b0');
  drawText(board, '6X FINAL RENDER FEATURE REVIEW', 8, 8, ink, 2);
  DIRECTIONS.forEach((direction, column) => {
    drawText(board, direction.replace('-1', ''), labelWidth + column * cardWidth + 48, 20, muted);
  });

  ([
    ['HERO', 'protagonist', '#403927'],
    [character.displayName, characterId, '#243642'],
  ] as const).forEach(([label, id, background], row) => {
    const y = headerHeight + row * cardHeight;
    fillRect(board, 4, y + 4, labelWidth - 8, cardHeight - 8, parseHexColor('#2b2831'));
    drawText(board, label, 10, y + 92, ink, 2);
    DIRECTIONS.forEach((direction, column) => {
      const x = labelWidth + column * cardWidth;
      fillRect(board, x + 4, y + 4, cardWidth - 8, cardHeight - 8, parseHexColor(background));
      const rectangle = index.sprites[`character.${id}.${direction}`];
      if (!rectangle) throw new Error(`Missing character.${id}.${direction}.`);
      blitScaled(crop(atlas, rectangle), board, x + 6, y + 10, scale);
    });
  });

  mkdirSync(outputRoot, { recursive: true });
  const output = resolve(outputRoot, `${characterId}-feature-review-6x.png`);
  writeFileSync(output, encodePng(board), { flush: true });
  process.stdout.write(`Character feature review: ${output}\n`);
}

try {
  main();
} catch (error: unknown) {
  process.stderr.write(`Character feature review failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
