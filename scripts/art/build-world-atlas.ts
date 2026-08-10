import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  WORLD_CELL,
  composeFrontFrame,
  loadCharacterSources,
  loadTransparentPartSources,
  loadTileSources,
  loadWallSources,
  renderTile,
  renderWallVariant,
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
  cellClass: 'ground' | 'transparent-part' | null;
  wallAdjacencyMask: number | null;
  bitmap: Bitmap;
}>;

export type AtlasRect = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
  kind: Entry['kind'];
  sourceId: string;
  cellClass: Entry['cellClass'];
  wallAdjacencyMask: number | null;
}>;

export type AtlasIndex = Readonly<{
  version: 2;
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
  groundCells: readonly string[];
  transparentPartCells: readonly string[];
  walls: Readonly<Record<string, readonly string[]>>;
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
    cellClass: null,
    wallAdjacencyMask: null,
    bitmap: tokenFrameToBitmap(tokens, source.palette),
  }));
}

function pack(entries: readonly Entry[]): { bitmap: Bitmap; sprites: Record<string, AtlasRect> } {
  const names = entries.map(({ name }) => name);
  if (new Set(names).size !== names.length) {
    throw new Error('Atlas entry names must be unique.');
  }
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
      cellClass: placement.entry.cellClass,
      wallAdjacencyMask: placement.entry.wallAdjacencyMask,
    };
  }
  return { bitmap, sprites };
}

export function buildAtlas(root = process.cwd()): { png: Buffer; index: AtlasIndex } {
  const characters = loadCharacterSources(root);
  const groundCells = loadTileSources(root);
  const wallSources = loadWallSources(root);
  const transparentParts = loadTransparentPartSources(root);
  const groundEntries: Entry[] = groundCells.map((tile) => ({
    name: `tile.${tile.id}`,
    sourceId: tile.id,
    kind: 'tile' as const,
    cellClass: 'ground' as const,
    wallAdjacencyMask: null,
    bitmap: renderTile(tile),
  }));
  const wallEntries: Entry[] = wallSources.flatMap((wall) =>
    Array.from({ length: 16 }, (_unused, adjacencyMask) => ({
      name: `tile.wall-${wall.id}-${adjacencyMask.toString(16)}`,
      sourceId: wall.id,
      kind: 'tile' as const,
      cellClass: 'transparent-part' as const,
      wallAdjacencyMask: adjacencyMask,
      bitmap: renderWallVariant(wall, adjacencyMask),
    })),
  );
  const partEntries: Entry[] = transparentParts.map((part) => ({
    name: `tile.${part.id}`,
    sourceId: part.id,
    kind: 'tile' as const,
    cellClass: 'transparent-part' as const,
    wallAdjacencyMask: null,
    bitmap: renderTile(part),
  }));
  const tileEntries = [...groundEntries, ...wallEntries, ...partEntries];
  const entries: Entry[] = [
    ...tileEntries,
    ...characters.flatMap(worldEntries),
    ...buildPortraitEntries(characters).map((entry) => ({
      ...entry,
      cellClass: null,
      wallAdjacencyMask: null,
    })),
  ];
  const { bitmap, sprites } = pack(entries);
  const index: AtlasIndex = {
    version: 2,
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
    tiles: tileEntries.map(({ name }) => name),
    groundCells: groundEntries.map(({ name }) => name),
    transparentPartCells: [...wallEntries, ...partEntries].map(({ name }) => name),
    walls: Object.fromEntries(wallSources.map(({ id }) => [
      id,
      Array.from({ length: 16 }, (_unused, adjacencyMask) =>
        `tile.wall-${id}-${adjacencyMask.toString(16)}`),
    ])),
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
