import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { z } from 'zod';

import { createBitmap, parseHexColor, setPixel, type Bitmap, type Rgba } from './png';

export const WORLD_CELL = { width: 24, height: 30 } as const;
export const PORTRAIT_CELL = { width: 40, height: 44 } as const;
export const TILE_CELL = { width: 32, height: 32 } as const;

const TokenSchema = z.string().regex(/^[A-Za-z0-9]$/u);
const ColorSchema = z.string().regex(/^#[0-9a-f]{6}$/iu);

const RectCommandSchema = z.object({
  kind: z.literal('rect'),
  token: TokenSchema,
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
}).strict();

const PixelsCommandSchema = z.object({
  kind: z.literal('pixels'),
  token: TokenSchema,
  points: z.array(z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()])).min(1),
}).strict();

export const DrawCommandSchema = z.discriminatedUnion('kind', [RectCommandSchema, PixelsCommandSchema]);
export type DrawCommand = z.infer<typeof DrawCommandSchema>;

const StaticLayerSchema = z.object({ commands: z.array(DrawCommandSchema) }).strict();
const FrameLayerSchema = z.object({
  frontFrames: z.tuple([z.array(DrawCommandSchema), z.array(DrawCommandSchema)]),
  lateralFrames: z.tuple([z.array(DrawCommandSchema), z.array(DrawCommandSchema)]),
}).strict();

const SourceLayersSchema = z.object({
  legs: FrameLayerSchema,
  torsoAndClothing: StaticLayerSchema,
  headAndFace: StaticLayerSchema,
  hair: StaticLayerSchema,
  accessory: StaticLayerSchema,
  heldItem: StaticLayerSchema.optional(),
}).strict();

const PortraitLayersSchema = z.object({
  legs: StaticLayerSchema,
  torsoAndClothing: StaticLayerSchema,
  headAndFace: StaticLayerSchema,
  hair: StaticLayerSchema,
  accessory: StaticLayerSchema,
  heldItem: StaticLayerSchema.optional(),
}).strict();

export const CharacterSourceSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]+$/u),
  displayName: z.string().min(1).max(40),
  cell: z.object({ width: z.literal(24), height: z.literal(30) }).strict(),
  portraitCell: z.object({ width: z.literal(40), height: z.literal(44) }).strict(),
  palette: z.record(TokenSchema, ColorSchema),
  identityTokens: z.object({ hair: TokenSchema, clothing: TokenSchema, skin: TokenSchema }).strict(),
  rearStyle: z.object({
    head: TokenSchema,
    lower: TokenSchema,
    clothing: TokenSchema,
    torsoDetailTokens: z.array(TokenSchema),
  }).strict(),
  sourceLayers: SourceLayersSchema,
  portraitLayers: PortraitLayersSchema,
}).strict();

export type CharacterSource = z.infer<typeof CharacterSourceSchema>;
export type TokenFrame = string[];

const BaseTileSourceSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]+$/u),
  palette: z.record(TokenSchema, ColorSchema),
  commands: z.array(DrawCommandSchema),
});

export const GroundCellSourceSchema = BaseTileSourceSchema.extend({
  cellClass: z.literal('ground'),
  backgroundToken: TokenSchema,
}).strict();
export type GroundCellSource = z.infer<typeof GroundCellSourceSchema>;

export const TransparentPartSourceSchema = BaseTileSourceSchema.extend({
  cellClass: z.literal('transparent-part'),
  role: z.enum(['door', 'furniture', 'sign', 'fixture', 'plant', 'landmark']),
}).strict();
export type TransparentPartSource = z.infer<typeof TransparentPartSourceSchema>;

export const PresentationCellSourceSchema = BaseTileSourceSchema.extend({
  cellClass: z.literal('presentation'),
  role: z.enum(['transition', 'decal', 'roof']),
  backgroundToken: TokenSchema.optional(),
}).strict();
export type PresentationCellSource = z.infer<typeof PresentationCellSourceSchema>;

const MultiTileCompositionSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]+$/u),
  columns: z.number().int().min(2).max(4),
  rows: z.number().int().min(1).max(4),
  partIds: z.array(z.string().regex(/^[a-z][a-z0-9-]+$/u)).min(2).max(16),
}).strict().refine(({ columns, rows, partIds }) => partIds.length === columns * rows, {
  message: 'Multi-tile composition part count must match its grid.',
});
export type MultiTileComposition = z.infer<typeof MultiTileCompositionSchema>;

const WallModulesSchema = z.object({
  north: z.array(DrawCommandSchema),
  east: z.array(DrawCommandSchema),
  south: z.array(DrawCommandSchema),
  west: z.array(DrawCommandSchema),
  core: z.array(DrawCommandSchema),
}).strict();

const WallPaletteSourceSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]+$/u),
  palette: z.record(TokenSchema, ColorSchema),
}).strict();

export type WallSource = Readonly<{
  id: string;
  palette: Readonly<Record<string, string>>;
  modules: z.infer<typeof WallModulesSchema>;
}>;

export type TileSource = GroundCellSource | TransparentPartSource | PresentationCellSource;

const TileCollectionSchema = z.object({
  version: z.literal(2),
  tiles: z.array(GroundCellSourceSchema).min(8).max(48),
  parts: z.array(TransparentPartSourceSchema).min(1),
  presentationCells: z.array(PresentationCellSourceSchema).max(48).default([]),
  multiTileCompositions: z.array(MultiTileCompositionSchema).max(16).default([]),
  wallModules: WallModulesSchema,
  wallPalettes: z.array(WallPaletteSourceSchema).min(1),
}).strict();

type TileCollection = z.infer<typeof TileCollectionSchema>;

function loadTileCollections(root: string): TileCollection[] {
  const directory = resolve(root, 'assets/source/tiles');
  return readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => TileCollectionSchema.parse(
      JSON.parse(readFileSync(resolve(directory, name), 'utf8')) as unknown,
    ));
}

function validateTileSource(source: TileSource): void {
  assertCommandBounds(source.commands, TILE_CELL.width, TILE_CELL.height);
  for (const command of source.commands) {
    if (!source.palette[command.token]) {
      throw new Error(`${source.id} uses missing palette token ${command.token}.`);
    }
  }
  if (
    (source.cellClass === 'ground' || source.cellClass === 'presentation') &&
    source.backgroundToken &&
    !source.palette[source.backgroundToken]
  ) {
    throw new Error(`${source.id} uses missing background token ${source.backgroundToken}.`);
  }
}

function assertUniqueSourceIds(label: string, ids: readonly string[]): void {
  if (new Set(ids).size !== ids.length) {
    throw new Error(`${label} source IDs must be unique.`);
  }
}

function assertCommandBounds(commands: readonly DrawCommand[], width: number, height: number): void {
  for (const command of commands) {
    if (command.kind === 'rect') {
      if (command.x + command.width > width || command.y + command.height > height) {
        throw new Error(`Rectangle exceeds ${width}x${height}.`);
      }
    } else if (command.points.some(([x, y]) => x >= width || y >= height)) {
      throw new Error(`Pixel command exceeds ${width}x${height}.`);
    }
  }
}

function validateCharacter(source: CharacterSource): CharacterSource {
  const worldCommands = [
    ...source.sourceLayers.legs.frontFrames.flat(),
    ...source.sourceLayers.legs.lateralFrames.flat(),
    ...source.sourceLayers.torsoAndClothing.commands,
    ...source.sourceLayers.headAndFace.commands,
    ...source.sourceLayers.hair.commands,
    ...source.sourceLayers.accessory.commands,
    ...(source.sourceLayers.heldItem?.commands ?? []),
  ];
  const portraitCommands = Object.values(source.portraitLayers).flatMap((layer) => layer?.commands ?? []);
  assertCommandBounds(worldCommands, WORLD_CELL.width, WORLD_CELL.height);
  assertCommandBounds(portraitCommands, PORTRAIT_CELL.width, PORTRAIT_CELL.height);
  for (const command of [...worldCommands, ...portraitCommands]) {
    if (!source.palette[command.token]) {
      throw new Error(`${source.id} uses missing palette token ${command.token}.`);
    }
  }
  if (['protagonist', 'linda', 'generic-resident'].includes(source.id)) {
    for (const frameIndex of [0, 1] as const) {
      const frame = composeFrontFrame(source, frameIndex);
      if (
        [...frame[0] as string].some((token) => token !== '.') ||
        [...frame[WORLD_CELL.height - 1] as string].some((token) => token !== '.') ||
        frame.some((row) => row[0] !== '.' || row[WORLD_CELL.width - 1] !== '.')
      ) {
        throw new Error(`${source.id} must keep top, left, right, and bottom-foot source margins open.`);
      }
    }
  }
  return source;
}

export function loadCharacterSources(root = process.cwd()): CharacterSource[] {
  const directory = resolve(root, 'assets/source/characters');
  const sources = readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => validateCharacter(CharacterSourceSchema.parse(
      JSON.parse(readFileSync(resolve(directory, name), 'utf8')) as unknown,
    )));
  const ids = sources.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) {
    throw new Error('Character source IDs must be unique.');
  }
  return sources;
}

export function loadTileSources(root = process.cwd()): GroundCellSource[] {
  const sources = loadTileCollections(root).flatMap(({ tiles }) => tiles);
  sources.forEach(validateTileSource);
  assertUniqueSourceIds('Ground cell', sources.map(({ id }) => id));
  return sources;
}

export function loadTransparentPartSources(root = process.cwd()): TransparentPartSource[] {
  const sources = loadTileCollections(root).flatMap(({ parts }) => parts);
  sources.forEach(validateTileSource);
  assertUniqueSourceIds('Transparent part', sources.map(({ id }) => id));
  return sources;
}

export function loadPresentationCellSources(root = process.cwd()): PresentationCellSource[] {
  const sources = loadTileCollections(root).flatMap(({ presentationCells }) => presentationCells);
  sources.forEach(validateTileSource);
  assertUniqueSourceIds('Presentation cell', sources.map(({ id }) => id));
  return sources;
}

export function loadMultiTileCompositions(root = process.cwd()): MultiTileComposition[] {
  const collections = loadTileCollections(root);
  const compositions = collections.flatMap(({ multiTileCompositions }) => multiTileCompositions);
  assertUniqueSourceIds('Multi-tile composition', compositions.map(({ id }) => id));
  const partIds = new Set(collections.flatMap(({ parts }) => parts.map(({ id }) => id)));
  for (const composition of compositions) {
    for (const partId of composition.partIds) {
      if (!partIds.has(partId)) throw new Error(`${composition.id} references missing part ${partId}.`);
    }
  }
  return compositions;
}

export function loadWallSources(root = process.cwd()): WallSource[] {
  const sources = loadTileCollections(root).flatMap(({ wallModules, wallPalettes }) =>
    wallPalettes.map(({ id, palette }) => ({ id, palette, modules: wallModules })),
  );
  assertUniqueSourceIds('Wall palette', sources.map(({ id }) => id));
  for (const source of sources) {
    const commands = Object.values(source.modules).flat();
    assertCommandBounds(commands, TILE_CELL.width, TILE_CELL.height);
    for (const command of commands) {
      if (!source.palette[command.token]) {
        throw new Error(`Wall ${source.id} uses missing palette token ${command.token}.`);
      }
    }
  }
  return sources;
}

export function emptyTokenFrame(width: number, height: number): TokenFrame {
  return Array.from({ length: height }, () => '.'.repeat(width));
}

export function drawTokenCommands(frame: TokenFrame, commands: readonly DrawCommand[]): void {
  const height = frame.length;
  const width = frame[0]?.length ?? 0;
  assertCommandBounds(commands, width, height);
  const setToken = (x: number, y: number, token: string): void => {
    const row = [...(frame[y] as string)];
    row[x] = token;
    frame[y] = row.join('');
  };
  for (const command of commands) {
    if (command.kind === 'rect') {
      for (let y = command.y; y < command.y + command.height; y += 1) {
        for (let x = command.x; x < command.x + command.width; x += 1) {
          setToken(x, y, command.token);
        }
      }
    } else {
      for (const [x, y] of command.points) {
        setToken(x, y, command.token);
      }
    }
  }
}

export function tokenFrameToBitmap(frame: readonly string[], palette: Readonly<Record<string, string>>): Bitmap {
  const bitmap = createBitmap(frame[0]?.length ?? 0, frame.length);
  for (let y = 0; y < frame.length; y += 1) {
    for (let x = 0; x < (frame[y]?.length ?? 0); x += 1) {
      const token = frame[y]?.[x];
      if (token && token !== '.') {
        const color = palette[token];
        if (!color) {
          throw new Error(`Token frame uses missing palette token ${token}.`);
        }
        setPixel(bitmap, x, y, parseHexColor(color));
      }
    }
  }
  return bitmap;
}

export function addOutwardContour(
  source: Bitmap,
  color: Rgba,
  keepBottomRowOpen = false,
): Bitmap {
  const output = { width: source.width, height: source.height, data: Buffer.from(source.data) };
  const painted = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= source.width || y >= source.height) return false;
    return source.data[(y * source.width + x) * 4 + 3] !== 0;
  };
  for (let y = 0; y < source.height; y += 1) {
    if (keepBottomRowOpen && y === source.height - 1) continue;
    for (let x = 0; x < source.width; x += 1) {
      if (painted(x, y)) continue;
      if (painted(x - 1, y) || painted(x + 1, y) || painted(x, y - 1) || painted(x, y + 1)) {
        setPixel(output, x, y, color);
      }
    }
  }
  return output;
}

function staticWorldLayers(source: CharacterSource): readonly DrawCommand[][] {
  return [
    source.sourceLayers.torsoAndClothing.commands,
    source.sourceLayers.headAndFace.commands,
    source.sourceLayers.hair.commands,
    source.sourceLayers.accessory.commands,
    source.sourceLayers.heldItem?.commands ?? [],
  ];
}

export function composeFrontFrame(source: CharacterSource, frameIndex: 0 | 1): TokenFrame {
  const frame = emptyTokenFrame(WORLD_CELL.width, WORLD_CELL.height);
  drawTokenCommands(frame, source.sourceLayers.legs.frontFrames[frameIndex]);
  for (const commands of staticWorldLayers(source)) {
    drawTokenCommands(frame, commands);
  }
  return frame;
}

export function composePortrait(source: CharacterSource): TokenFrame {
  const frame = emptyTokenFrame(PORTRAIT_CELL.width, PORTRAIT_CELL.height);
  for (const layerName of [
    'legs',
    'torsoAndClothing',
    'headAndFace',
    'hair',
    'accessory',
    'heldItem',
  ] as const) {
    const layer = source.portraitLayers[layerName];
    if (layer) {
      drawTokenCommands(frame, layer.commands);
    }
  }
  return frame;
}

export function renderTile(source: TileSource): Bitmap {
  const backgroundToken = source.cellClass === 'ground'
    ? source.backgroundToken
    : source.cellClass === 'presentation'
      ? source.backgroundToken
      : undefined;
  const frame = backgroundToken
    ? Array.from({ length: TILE_CELL.height }, () => backgroundToken.repeat(TILE_CELL.width))
    : emptyTokenFrame(TILE_CELL.width, TILE_CELL.height);
  drawTokenCommands(frame, source.commands);
  return tokenFrameToBitmap(frame, source.palette);
}

export function renderWallVariant(source: WallSource, adjacencyMask: number): Bitmap {
  if (!Number.isInteger(adjacencyMask) || adjacencyMask < 0 || adjacencyMask > 15) {
    throw new Error('Wall adjacency mask must be an integer from 0 through 15.');
  }
  const frame = emptyTokenFrame(TILE_CELL.width, TILE_CELL.height);
  if ((adjacencyMask & 1) !== 0) drawTokenCommands(frame, source.modules.north);
  if ((adjacencyMask & 2) !== 0) drawTokenCommands(frame, source.modules.east);
  if ((adjacencyMask & 4) !== 0) drawTokenCommands(frame, source.modules.south);
  if ((adjacencyMask & 8) !== 0) drawTokenCommands(frame, source.modules.west);
  drawTokenCommands(frame, source.modules.core);
  return tokenFrameToBitmap(frame, source.palette);
}
