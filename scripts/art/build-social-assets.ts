import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  composePortrait,
  loadCharacterSources,
  loadTileSources,
  renderTile,
  tokenFrameToBitmap,
  type CharacterSource,
  type DrawCommand,
} from './character-source';
import {
  blit,
  blitScaled,
  createBitmap,
  decodePng,
  encodePng,
  fillRect,
  parseHexColor,
  setPixel,
  type Bitmap,
  type Rgba,
} from './png';

const PROFILE_SIZE = 64;
const PROFILE_SCALE = 16;

function readPixel(bitmap: Bitmap, x: number, y: number): Rgba {
  const offset = (y * bitmap.width + x) * 4;
  return [
    bitmap.data[offset] as number,
    bitmap.data[offset + 1] as number,
    bitmap.data[offset + 2] as number,
    bitmap.data[offset + 3] as number,
  ];
}

function crop(source: Bitmap, x: number, y: number, width: number, height: number): Bitmap {
  if (x < 0 || y < 0 || x + width > source.width || y + height > source.height) {
    throw new Error(`Crop ${x},${y} ${width}x${height} exceeds ${source.width}x${source.height}.`);
  }
  const output = createBitmap(width, height);
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      setPixel(output, column, row, readPixel(source, x + column, y + row));
    }
  }
  return output;
}

function paintTextureCircle(
  target: Bitmap,
  texture: Bitmap,
  centerX: number,
  centerY: number,
  radius: number,
): void {
  for (let y = 0; y < target.height; y += 1) {
    for (let x = 0; x < target.width; x += 1) {
      const distanceSquared = (x - centerX) ** 2 + (y - centerY) ** 2;
      if (distanceSquared <= radius ** 2) {
        setPixel(target, x, y, readPixel(texture, x % texture.width, y % texture.height));
      }
    }
  }
}

function buildProfileSource(source: CharacterSource): CharacterSource {
  const faceCommands: DrawCommand[] = [
    { kind: 'rect', token: 'K', x: 7, y: 7, width: 26, height: 25 },
    { kind: 'rect', token: 'K', x: 5, y: 15, width: 30, height: 9 },
    { kind: 'rect', token: 'S', x: 8, y: 8, width: 24, height: 23 },
    { kind: 'rect', token: 'S', x: 6, y: 17, width: 28, height: 5 },
    { kind: 'rect', token: 'K', x: 11, y: 16, width: 6, height: 1 },
    { kind: 'rect', token: 'K', x: 23, y: 16, width: 6, height: 1 },
    { kind: 'rect', token: 'E', x: 11, y: 18, width: 6, height: 3 },
    { kind: 'rect', token: 'E', x: 23, y: 18, width: 6, height: 3 },
    { kind: 'rect', token: 'K', x: 14, y: 19, width: 2, height: 2 },
    { kind: 'rect', token: 'K', x: 24, y: 19, width: 2, height: 2 },
    { kind: 'pixels', token: 's', points: [[28, 24], [20, 26], [19, 27]] },
    { kind: 'rect', token: 'K', x: 17, y: 28, width: 6, height: 2 },
  ];
  const hairCommands: DrawCommand[] = [
    { kind: 'rect', token: 'K', x: 8, y: 3, width: 24, height: 9 },
    { kind: 'rect', token: 'H', x: 10, y: 5, width: 20, height: 7 },
    { kind: 'rect', token: 'K', x: 6, y: 8, width: 6, height: 10 },
    { kind: 'rect', token: 'K', x: 28, y: 8, width: 6, height: 10 },
    { kind: 'rect', token: 'H', x: 8, y: 9, width: 4, height: 8 },
    { kind: 'rect', token: 'H', x: 28, y: 9, width: 4, height: 8 },
    {
      kind: 'pixels',
      token: 'H',
      points: [[12, 12], [13, 12], [14, 13], [15, 13], [16, 13], [17, 12], [18, 12], [19, 11], [20, 11], [21, 11], [22, 10], [23, 10], [24, 9], [25, 9], [26, 8], [27, 8]],
    },
    { kind: 'pixels', token: 'h', points: [[13, 6], [14, 6], [15, 6], [18, 5], [19, 5], [20, 5], [10, 9], [11, 9]] },
  ];
  return {
    ...source,
    displayName: 'Island Protagonist',
    palette: {
      ...source.palette,
      H: '#11171a',
      h: '#2b373c',
      S: '#d39a68',
      s: '#99613f',
      C: '#275f56',
      c: '#183d38',
    },
    portraitLayers: {
      ...source.portraitLayers,
      headAndFace: { commands: faceCommands },
      hair: { commands: hairCommands },
      accessory: { commands: [] },
    },
  };
}

function buildProfile(root: string): Bitmap {
  const protagonist = loadCharacterSources(root).find(({ id }) => id === 'protagonist');
  if (!protagonist) throw new Error('The protagonist character source is missing.');
  const tiles = loadTileSources(root);
  const waterSource = tiles.find(({ id }) => id === 'shallow-water');
  if (!waterSource) throw new Error('The profile background tile is missing.');

  const profile = createBitmap(PROFILE_SIZE, PROFILE_SIZE, parseHexColor('#17201b'));
  paintTextureCircle(profile, renderTile(waterSource), 32, 32, 30);
  const gold = parseHexColor('#f5dd9d');
  for (const [x, y] of [[7, 10], [8, 10], [7, 11], [55, 10], [56, 10], [56, 11], [7, 52], [8, 52], [8, 53], [55, 52], [56, 52], [55, 53]] as const) {
    setPixel(profile, x, y, gold);
  }

  const profileSource = buildProfileSource(protagonist);
  const portrait = tokenFrameToBitmap(composePortrait(profileSource), profileSource.palette);
  blit(portrait, profile, 12, 12);

  const output = createBitmap(PROFILE_SIZE * PROFILE_SCALE, PROFILE_SIZE * PROFILE_SCALE, parseHexColor('#17201b'));
  blitScaled(profile, output, 0, 0, PROFILE_SCALE);
  return output;
}

function buildCover(root: string): Bitmap {
  const phaseRoot = resolve(root, 'artifacts/phase-10');
  const villa = decodePng(readFileSync(resolve(phaseRoot, 'world-1x.png')));
  const island = decodePng(readFileSync(resolve(phaseRoot, 'world-loop-complete.png')));
  const ferry = decodePng(readFileSync(resolve(phaseRoot, 'world-ferry.png')));
  const output = createBitmap(1500, 500, parseHexColor('#17201b'));

  blit(crop(villa, 240, 80, 500, 500), output, 0, 0);
  blit(crop(island, 390, 0, 500, 500), output, 500, 0);
  blit(crop(ferry, 680, 80, 500, 500), output, 1000, 0);

  const seam = parseHexColor('#17201b');
  const gold = parseHexColor('#ad7640');
  fillRect(output, 496, 0, 8, 500, seam);
  fillRect(output, 499, 0, 2, 500, gold);
  fillRect(output, 996, 0, 8, 500, seam);
  fillRect(output, 999, 0, 2, 500, gold);
  return output;
}

export function writeSocialAssets(root = process.cwd()): void {
  const outputRoot = resolve(root, 'output/social');
  mkdirSync(outputRoot, { recursive: true });
  const profilePath = resolve(outputRoot, 'si-world-profile-hfm-asian-man-1024.png');
  const coverPath = resolve(outputRoot, 'si-world-cover-real-renderer-1500x500.png');
  writeFileSync(profilePath, encodePng(buildProfile(root)));
  writeFileSync(coverPath, encodePng(buildCover(root)));
  process.stdout.write(`Social profile: ${profilePath}\nSocial cover: ${coverPath}\n`);
}

if (require.main === module) {
  writeSocialAssets();
}
