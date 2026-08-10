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
} from './png';

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

export function writeReviewSheet(root = process.cwd()): void {
  const generatedRoot = resolve(root, 'assets/generated');
  const atlas = decodePng(readFileSync(resolve(generatedRoot, 'world-atlas.png')));
  const index = JSON.parse(readFileSync(resolve(generatedRoot, 'atlas-index.json'), 'utf8')) as AtlasIndex;
  const sheet = createBitmap(940, 125 + Object.keys(index.characters).length * 166, parseHexColor('#17151b'));

  fillRect(sheet, 12, 12, 916, 78, parseHexColor('#27252d'));
  index.tiles.forEach((name, tileIndex) => {
    drawSprite(sheet, atlas, index, name, 22 + tileIndex * 90, 20, 2);
  });

  const directions = ['front-1', 'front-2', 'rear-1', 'rear-2', 'left-1', 'left-2', 'right-1', 'right-2'];
  Object.keys(index.characters).sort().forEach((characterId, characterIndex) => {
    const panelY = 105 + characterIndex * 166;
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

  const outputRoot = resolve(root, 'artifacts/phase-04');
  mkdirSync(outputRoot, { recursive: true });
  writeFileSync(resolve(outputRoot, 'atlas-review.png'), encodePng(sheet));
  process.stdout.write(`Art review sheet: ${resolve(outputRoot, 'atlas-review.png')}\n`);
}

if (require.main === module) {
  writeReviewSheet();
}
