import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  WORLD_CELL,
  composeFrontFrame,
  loadCharacterSources,
  loadTileSources,
  renderTile,
  tokenFrameToBitmap,
  type CharacterSource,
} from './character-source';
import { buildPortraitEntries } from './build-portrait-atlas';
import { composeLateralFrame } from './lateral-legs';
import { blit, createBitmap, encodePng, type Bitmap } from './png';
import { deriveRearFrame } from './rear-frame';

export const ATLAS_GUTTER = 1;
export const WALK_FRAME_MILLISECONDS = 145;
export const ZOOM_LEVELS = [1, 2, 3] as const;
const ATLAS_WIDTH = 512;

export const WALK_DIRECTIONS = ['front', 'rear', 'left', 'right'] as const;
export const WALK_FRAMES = [1, 2] as const;

type Entry = Readonly<{
  name: string;
  sourceId: string;
  kind: 'world-character' | 'portrait' | 'tile';
  bitmap: Bitmap;
}>;

export type AtlasRect = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
  kind: Entry['kind'];
  sourceId: string;
}>;

export type AtlasIndex = Readonly<{
  version: 1;
  image: Readonly<{ width: number; height: number; colorType: 'rgba'; gutter: 1 }>;
  tileSize: 32;
  worldCell: typeof WORLD_CELL;
  walkFrameMilliseconds: 145;
  zoomLevels: typeof ZOOM_LEVELS;
  sprites: Readonly<Record<string, AtlasRect>>;
  characters: Readonly<Record<string, Readonly<{
    displayName: string;
    portrait: string;
    frames: Readonly<Record<string, string>>;
    sourceLayers: readonly ['legs', 'torso-and-clothing', 'head-and-face', 'hair', 'accessory', 'held-item'];
  }>>>;
  tiles: readonly string[];
}>;

function worldEntries(source: CharacterSource): Entry[] {
  const front = [composeFrontFrame(source, 0), composeFrontFrame(source, 1)] as const;
  const tokenFrames = {
    'front-1': front[0],
    'front-2': front[1],
    'rear-1': deriveRearFrame(front[0], source),
    'rear-2': deriveRearFrame(front[1], source),
    'left-1': composeLateralFrame(source, 'left', 0),
    'left-2': composeLateralFrame(source, 'left', 1),
    'right-1': composeLateralFrame(source, 'right', 0),
    'right-2': composeLateralFrame(source, 'right', 1),
  } as const;
  return Object.entries(tokenFrames).map(([frame, tokens]) => ({
    name: `character.${source.id}.${frame}`,
    sourceId: source.id,
    kind: 'world-character' as const,
    bitmap: tokenFrameToBitmap(tokens, source.palette),
  }));
}

function pack(entries: readonly Entry[]): { bitmap: Bitmap; sprites: Record<string, AtlasRect> } {
  let x = ATLAS_GUTTER;
  let y = ATLAS_GUTTER;
  let rowHeight = 0;
  const placements: { entry: Entry; x: number; y: number }[] = [];
  for (const entry of entries) {
    if (x + entry.bitmap.width + ATLAS_GUTTER > ATLAS_WIDTH) {
      x = ATLAS_GUTTER;
      y += rowHeight + ATLAS_GUTTER * 2;
      rowHeight = 0;
    }
    placements.push({ entry, x, y });
    x += entry.bitmap.width + ATLAS_GUTTER * 2;
    rowHeight = Math.max(rowHeight, entry.bitmap.height);
  }
  const height = y + rowHeight + ATLAS_GUTTER;
  const bitmap = createBitmap(ATLAS_WIDTH, height);
  const sprites: Record<string, AtlasRect> = {};
  for (const placement of placements) {
    blit(placement.entry.bitmap, bitmap, placement.x, placement.y);
    sprites[placement.entry.name] = {
      x: placement.x,
      y: placement.y,
      width: placement.entry.bitmap.width,
      height: placement.entry.bitmap.height,
      kind: placement.entry.kind,
      sourceId: placement.entry.sourceId,
    };
  }
  return { bitmap, sprites };
}

export function buildAtlas(root = process.cwd()): { png: Buffer; index: AtlasIndex } {
  const characters = loadCharacterSources(root);
  const tiles = loadTileSources(root);
  const entries: Entry[] = [
    ...tiles.map((tile) => ({
      name: `tile.${tile.id}`,
      sourceId: tile.id,
      kind: 'tile' as const,
      bitmap: renderTile(tile),
    })),
    ...characters.flatMap(worldEntries),
    ...buildPortraitEntries(characters),
  ];
  const { bitmap, sprites } = pack(entries);
  const index: AtlasIndex = {
    version: 1,
    image: { width: bitmap.width, height: bitmap.height, colorType: 'rgba', gutter: 1 },
    tileSize: 32,
    worldCell: WORLD_CELL,
    walkFrameMilliseconds: WALK_FRAME_MILLISECONDS,
    zoomLevels: ZOOM_LEVELS,
    sprites,
    characters: Object.fromEntries(characters.map((character) => [character.id, {
      displayName: character.displayName,
      portrait: `portrait.${character.id}`,
      frames: Object.fromEntries(WALK_DIRECTIONS.flatMap((direction) =>
        WALK_FRAMES.map((frame) => [
          `${direction}-${frame}`,
          `character.${character.id}.${direction}-${frame}`,
        ]),
      )),
      sourceLayers: [
        'legs',
        'torso-and-clothing',
        'head-and-face',
        'hair',
        'accessory',
        'held-item',
      ] as const,
    }])),
    tiles: tiles.map(({ id }) => `tile.${id}`),
  };
  return { png: encodePng(bitmap), index };
}

export function writeAtlas(root = process.cwd()): void {
  const outputDirectory = resolve(root, 'assets/generated');
  const { png, index } = buildAtlas(root);
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(resolve(outputDirectory, 'world-atlas.png'), png);
  writeFileSync(resolve(outputDirectory, 'atlas-index.json'), `${JSON.stringify(index, null, 2)}\n`);
  process.stdout.write(
    `World atlas: ${index.image.width}x${index.image.height}, ${Object.keys(index.sprites).length} reachable RGBA cells.\n`,
  );
}

if (require.main === module) {
  writeAtlas();
}
