import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { z } from 'zod';

import { createBitmap, parseHexColor, setPixel, type Bitmap } from './png';

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

export const TileSourceSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]+$/u),
  palette: z.record(TokenSchema, ColorSchema),
  backgroundToken: TokenSchema,
  commands: z.array(DrawCommandSchema),
}).strict();
export type TileSource = z.infer<typeof TileSourceSchema>;

const TileCollectionSchema = z.object({ tiles: z.array(TileSourceSchema).min(8).max(12) }).strict();

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

export function loadTileSources(root = process.cwd()): TileSource[] {
  const directory = resolve(root, 'assets/source/tiles');
  const sources = readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .flatMap((name) => TileCollectionSchema.parse(
      JSON.parse(readFileSync(resolve(directory, name), 'utf8')) as unknown,
    ).tiles);
  for (const source of sources) {
    assertCommandBounds(source.commands, TILE_CELL.width, TILE_CELL.height);
    for (const command of source.commands) {
      if (!source.palette[command.token]) {
        throw new Error(`${source.id} uses missing palette token ${command.token}.`);
      }
    }
  }
  if (new Set(sources.map(({ id }) => id)).size !== sources.length) {
    throw new Error('Tile source IDs must be unique.');
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
  const frame = Array.from({ length: TILE_CELL.height }, () => source.backgroundToken.repeat(TILE_CELL.width));
  drawTokenCommands(frame, source.commands);
  return tokenFrameToBitmap(frame, source.palette);
}
