import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { AtlasIndex, AtlasRect } from './build-world-atlas';
import {
  blitScaled,
  createBitmap,
  decodePng,
  encodePng,
  fillRect,
  parseHexColor,
  type Bitmap,
  type Rgba,
} from './png';

const PIXEL_FONT: Readonly<Record<string, readonly string[]>> = {
  ' ': ['000', '000', '000', '000', '000'],
  '-': ['000', '000', '111', '000', '000'],
  '.': ['000', '000', '000', '000', '010'],
  '/': ['001', '001', '010', '100', '100'],
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['110', '001', '111', '100', '111'],
  '3': ['110', '001', '111', '001', '110'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '110', '001', '110'],
  '6': ['011', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '110'],
  A: ['010', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  C: ['011', '100', '100', '100', '011'],
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'],
  F: ['111', '100', '110', '100', '100'],
  G: ['011', '100', '101', '101', '011'],
  H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  J: ['001', '001', '001', '101', '010'],
  K: ['101', '101', '110', '101', '101'],
  L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'],
  N: ['101', '111', '111', '111', '101'],
  O: ['010', '101', '101', '101', '010'],
  P: ['110', '101', '110', '100', '100'],
  Q: ['010', '101', '101', '111', '011'],
  R: ['110', '101', '110', '101', '101'],
  S: ['011', '100', '010', '001', '110'],
  T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '111'],
  V: ['101', '101', '101', '101', '010'],
  W: ['101', '101', '111', '111', '101'],
  X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'],
  Z: ['111', '001', '010', '100', '111'],
};

export function drawText(bitmap: Bitmap, source: string, x: number, y: number, color: Rgba, scale = 1): void {
  [...source.toUpperCase()].forEach((character, characterIndex) => {
    const glyph = PIXEL_FONT[character] ?? PIXEL_FONT[' '] as readonly string[];
    glyph.forEach((row, rowIndex) => {
      [...row].forEach((pixel, columnIndex) => {
        if (pixel === '1') {
          fillRect(bitmap, x + (characterIndex * 4 + columnIndex) * scale, y + rowIndex * scale, scale, scale, color);
        }
      });
    });
  });
}

function crop(source: Bitmap, rectangle: AtlasRect): Bitmap {
  const target = createBitmap(rectangle.width, rectangle.height);
  for (let y = 0; y < rectangle.height; y += 1) {
    for (let x = 0; x < rectangle.width; x += 1) {
      const sourceOffset = ((rectangle.y + y) * source.width + rectangle.x + x) * 4;
      const targetOffset = (y * target.width + x) * 4;
      source.data.copy(target.data, targetOffset, sourceOffset, sourceOffset + 4);
    }
  }
  return target;
}

function drawSprite(
  sheet: Bitmap,
  atlas: Bitmap,
  index: AtlasIndex,
  name: string,
  x: number,
  y: number,
  scale: number,
): void {
  const rectangle = index.sprites[name];
  if (!rectangle) {
    throw new Error(`Review sheet cannot find atlas cell ${name}.`);
  }
  blitScaled(crop(atlas, rectangle), sheet, x, y, scale);
}

export function writeReviewSheet(outputRoot: string, root = process.cwd()): readonly string[] {
  const generatedRoot = resolve(root, 'assets/generated');
  const atlas = decodePng(readFileSync(resolve(generatedRoot, 'world-atlas.png')));
  const index = JSON.parse(readFileSync(resolve(generatedRoot, 'atlas-index.json'), 'utf8')) as AtlasIndex;
  const groundColumns = 10;
  const groundRows = Math.ceil(index.groundCells.length / groundColumns);
  const groundPanelHeight = 22 + groundRows * 72;
  const sheet = createBitmap(
    940,
    groundPanelHeight + 20 + Object.keys(index.characters).length * 166,
    parseHexColor('#17151b'),
  );

  fillRect(sheet, 12, 12, 916, groundPanelHeight - 12, parseHexColor('#27252d'));
  index.groundCells.forEach((name, tileIndex) => {
    drawSprite(
      sheet,
      atlas,
      index,
      name,
      22 + (tileIndex % groundColumns) * 90,
      20 + Math.floor(tileIndex / groundColumns) * 72,
      2,
    );
  });

  const directions = ['front-1', 'front-2', 'rear-1', 'rear-2', 'left-1', 'left-2', 'right-1', 'right-2'];
  Object.keys(index.characters).sort().forEach((characterId, characterIndex) => {
    const panelY = groundPanelHeight + characterIndex * 166;
    fillRect(sheet, 12, panelY, 916, 150, parseHexColor(characterIndex % 2 === 0 ? '#23222a' : '#292630'));
    directions.forEach((direction, frameIndex) => {
      drawSprite(
        sheet,
        atlas,
        index,
        `character.${characterId}.${direction}`,
        24 + frameIndex * 88,
        panelY + 30,
        3,
      );
    });
    drawSprite(sheet, atlas, index, `portrait.${characterId}`, 755, panelY + 9, 3);
  });

  mkdirSync(outputRoot, { recursive: true });
  const characterReviewPath = resolve(outputRoot, 'characters-3x.png');
  writeFileSync(characterReviewPath, encodePng(sheet));
  process.stdout.write(`Character review sheet: ${characterReviewPath}\n`);

  const previewCells = [...index.groundCells, ...index.transparentPartCells];
  const columns = 6;
  const cardWidth = 196;
  const cardHeight = 142;
  const margin = 16;
  const headerHeight = 50;
  const rows = Math.ceil(previewCells.length / columns);
  const preview = createBitmap(
    margin * 2 + columns * cardWidth,
    headerHeight + rows * cardHeight + margin,
    parseHexColor('#15171b'),
  );
  const ink = parseHexColor('#f2df9b');
  const mutedInk = parseHexColor('#9ca7a4');
  const dark = parseHexColor('#20242a');
  const light = parseHexColor('#e6e0cf');
  drawText(preview, 'HALCYRA FUNCTIONAL ATLAS', margin, 12, ink, 2);
  drawText(preview, 'NATIVE 1X ON DARK AND LIGHT / NEAREST 3X ON SPLIT BACKGROUND', margin, 34, mutedInk);
  previewCells.forEach((name, indexInPreview) => {
    const column = indexInPreview % columns;
    const row = Math.floor(indexInPreview / columns);
    const cardX = margin + column * cardWidth;
    const cardY = headerHeight + row * cardHeight;
    fillRect(preview, cardX + 2, cardY + 2, cardWidth - 6, cardHeight - 6, parseHexColor('#292c32'));
    drawText(preview, name, cardX + 8, cardY + 8, ink);
    fillRect(preview, cardX + 8, cardY + 24, 38, 38, dark);
    fillRect(preview, cardX + 50, cardY + 24, 38, 38, light);
    drawSprite(preview, atlas, index, name, cardX + 11, cardY + 27, 1);
    drawSprite(preview, atlas, index, name, cardX + 53, cardY + 27, 1);
    fillRect(preview, cardX + 94, cardY + 24, 49, 98, dark);
    fillRect(preview, cardX + 143, cardY + 24, 49, 98, light);
    drawSprite(preview, atlas, index, name, cardX + 95, cardY + 25, 3);
    drawText(preview, '1X', cardX + 8, cardY + 68, mutedInk);
    drawText(preview, '1X', cardX + 50, cardY + 68, mutedInk);
    drawText(preview, '3X', cardX + 94, cardY + 126, mutedInk);
  });
  const atlasReviewPath = resolve(outputRoot, 'atlas-cells-1x-3x.png');
  writeFileSync(atlasReviewPath, encodePng(preview));
  process.stdout.write(`Functional atlas preview: ${atlasReviewPath}\n`);
  return [characterReviewPath, atlasReviewPath];
}
