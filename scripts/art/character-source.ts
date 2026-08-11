import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { z } from 'zod';

import {
  CHARACTER_LOOKS,
  type CharacterLook,
  type PortraitExpression,
} from './character-look-roster';
import { createBitmap, parseHexColor, setPixel, type Bitmap, type Rgba } from './png';

export const WORLD_CELL = { width: 24, height: 30 } as const;
export const PORTRAIT_CELL = { width: 24, height: 29 } as const;
export const TILE_CELL = { width: 32, height: 32 } as const;

const TokenSchema = z.string().regex(/^[A-Za-z0-9]$/u);
const ColorSchema = z.string().regex(/^#[0-9a-f]{6}$/iu);
const DirectionSchema = z.enum(['front', 'rear', 'left', 'right']);

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
  kind: z.enum(['named', 'ambient']),
  cell: z.object({ width: z.literal(24), height: z.literal(30) }).strict(),
  portraitCell: z.object({ width: z.literal(24), height: z.literal(29) }).strict(),
  palette: z.record(TokenSchema, ColorSchema),
  identityTokens: z.object({ hair: TokenSchema, clothing: TokenSchema, skin: TokenSchema }).strict(),
  identityFeatures: z.array(z.object({
    id: z.string().regex(/^[a-z][a-z0-9-]+$/u),
    description: z.string().min(1).max(120),
    layer: z.enum(['torsoAndClothing', 'hair', 'accessory', 'heldItem']),
    visibleIn: z.array(DirectionSchema).min(1).max(4),
  }).strict()).min(2).max(6),
  rearStyle: z.object({
    head: TokenSchema,
    lower: TokenSchema,
    clothing: TokenSchema,
    torsoDetailTokens: z.array(TokenSchema),
  }).strict(),
  signatureOddity: z.object({
    id: z.string().regex(/^[a-z][a-z0-9-]+$/u),
    description: z.string().min(1).max(180),
    supportingFeature: z.string().min(1).max(180),
  }).strict(),
  sourceLayers: SourceLayersSchema,
  portraitLayers: PortraitLayersSchema,
  portraitExpressions: z.object({
    rest: StaticLayerSchema,
    joy: StaticLayerSchema.optional(),
    upset: StaticLayerSchema.optional(),
  }).strict(),
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
  modules: WallModulesSchema.optional(),
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

const SKIN_COLORS = {
  porcelain: ['#f7c9a9', '#d99578', '#ffe0c5'],
  sand: ['#dca078', '#a96550', '#f4bd92'],
  warm: ['#b86f4f', '#7b4437', '#dc936c'],
  copper: ['#925438', '#603326', '#ba7550'],
  deep: ['#633922', '#3d231c', '#8d5836'],
} as const;

const HAIR_COLORS = {
  ink: ['#16121f', '#3d3544'],
  espresso: ['#35231f', '#644035'],
  umber: ['#2b211e', '#6d4535'],
  auburn: ['#71372f', '#a7543d'],
  gold: ['#d0a23a', '#f0c760'],
  silver: ['#6c6971', '#a9a4a2'],
  teal: ['#164f54', '#2e7d79'],
} as const;

const CLOTHING_COLORS = {
  teal: ['#197279', '#42a2a0'],
  coral: ['#b84e52', '#e46d69'],
  plum: ['#673d70', '#96639c'],
  mustard: ['#9a6e24', '#d29d3b'],
  navy: ['#263b58', '#456683'],
  rose: ['#9a4e70', '#ca7591'],
  cream: ['#cbbf9d', '#eee0ba'],
  rust: ['#8b472d', '#c26b3c'],
  sage: ['#64775d', '#91a47c'],
  charcoal: ['#3f3b46', '#67616f'],
} as const;

const ACCENT_COLORS = {
  gold: ['#d7a62b', '#f2cf59'],
  cyan: ['#58b8c8', '#9edfe6'],
  red: ['#b83a3a', '#ed6a57'],
  pink: ['#cd5f95', '#f19bb9'],
  lime: ['#7da83d', '#b8d966'],
  cream: ['#d8cda9', '#fff0c9'],
  violet: ['#7158a5', '#aa8bd5'],
} as const;

function rectCommand(
  token: string,
  x: number,
  y: number,
  width: number,
  height: number,
): DrawCommand {
  return { kind: 'rect', token, x, y, width, height };
}

function pixelsCommand(token: string, points: readonly (readonly [number, number])[]): DrawCommand {
  return { kind: 'pixels', token, points: points.map(([x, y]) => [x, y]) };
}

function characterPalette(look: CharacterLook): Record<string, string> {
  const skin = SKIN_COLORS[look.skin];
  const hair = HAIR_COLORS[look.hairColor];
  const clothing = CLOTHING_COLORS[look.clothing];
  const accent = ACCENT_COLORS[look.accent];
  return {
    K: '#211c27',
    S: skin[0],
    s: skin[1],
    L: skin[2],
    H: hair[0],
    h: hair[1],
    C: clothing[0],
    c: clothing[1],
    A: accent[0],
    a: accent[1],
    W: '#f5eee0',
    D: '#494052',
  };
}

function headBounds(look: CharacterLook): Readonly<{
  left: number;
  right: number;
  top: number;
  bottom: number;
}> {
  switch (look.head) {
    case 'round': return { left: 6, right: 17, top: 4, bottom: 14 };
    case 'square': return { left: 5, right: 18, top: 5, bottom: 14 };
    case 'long': return { left: 6, right: 17, top: 3, bottom: 15 };
    case 'wide': return { left: 5, right: 18, top: 5, bottom: 14 };
    case 'pear': return { left: 6, right: 17, top: 4, bottom: 15 };
  }
}

function portraitHeadCommands(look: CharacterLook): DrawCommand[] {
  const { left, right, top, bottom } = headBounds(look);
  const width = right - left + 1;
  const commands: DrawCommand[] = [
    rectCommand('S', left + 1, top, width - 2, 1),
    rectCommand('S', left, top + 1, width, bottom - top - 1),
    rectCommand('S', left + 1, bottom, width - 2, 1),
    pixelsCommand('s', [[left - 1, 9], [left - 1, 10], [right + 1, 9], [right + 1, 10]]),
    rectCommand('s', left + 2, bottom - 1, width - 4, 2),
    pixelsCommand('L', [[left + 1, top + 2], [left + 1, top + 3]]),
  ];
  if (look.head === 'round') {
    commands.push(pixelsCommand('S', [[left - 1, 7], [right + 1, 7], [left - 1, 12], [right + 1, 12]]));
  }
  if (look.head === 'wide') {
    commands.push(pixelsCommand('S', [[left - 1, 8], [right + 1, 8], [left - 1, 11], [right + 1, 11]]));
  }
  if (look.head === 'pear') {
    commands.push(pixelsCommand('S', [[left - 1, 11], [right + 1, 11], [left - 1, 12], [right + 1, 12]]));
  }
  return commands;
}

function portraitExpressionCommands(expression: PortraitExpression, look: CharacterLook): DrawCommand[] {
  if (expression === 'joy') {
    return [
      pixelsCommand('K', [[8, 8], [9, 9], [10, 8], [14, 8], [15, 9], [16, 8], [11, 11], [12, 11]]),
      rectCommand('K', 9, 12, 6, 2),
      rectCommand('W', 11, 12, 2, 1),
    ];
  }
  if (expression === 'upset') {
    return [
      pixelsCommand('K', [[7, 7], [8, 8], [9, 8], [10, 9], [14, 9], [15, 8], [16, 8], [17, 7], [11, 11], [12, 11]]),
      rectCommand('K', 10, 13, 4, 1),
      pixelsCommand('K', [[9, 14], [14, 14]]),
    ];
  }
  const eyes = (() => {
    switch (look.eyes ?? 'normal') {
      case 'large':
        return [
          rectCommand('W', 7, 7, 4, 4),
          rectCommand('W', 13, 7, 4, 4),
          rectCommand('K', 9, 8, 2, 2),
          rectCommand('K', 13, 8, 2, 2),
        ];
      case 'beady':
        return [pixelsCommand('K', [[9, 9], [15, 9]])];
      case 'angled-small':
        return [pixelsCommand('K', [[8, 8], [9, 9], [15, 8], [14, 9]])];
      case 'normal':
        return [
          rectCommand('W', 8, 8, 3, 2),
          rectCommand('W', 13, 8, 3, 2),
          pixelsCommand('K', [[9, 9], [14, 9]]),
        ];
    }
  })();
  return [
    ...eyes,
    pixelsCommand('K', [[11, 11], [12, 11]]),
    rectCommand('K', 10, 13, 4, 1),
  ];
}

function worldHeadCommands(look: CharacterLook): DrawCommand[] {
  return [...portraitHeadCommands(look), ...portraitExpressionCommands('rest', look)];
}

function worldHairCommands(look: CharacterLook): DrawCommand[] {
  switch (look.hair) {
    case 'bald': return [pixelsCommand('H', [[6, 7], [17, 7]])];
    case 'swept': return [rectCommand('H', 5, 3, 12, 5), rectCommand('H', 4, 6, 4, 5), pixelsCommand('h', [[7, 4], [8, 4], [9, 4], [16, 5], [17, 6], [18, 6]])];
    case 'side-cloud': return [rectCommand('H', 5, 3, 12, 5), rectCommand('H', 3, 6, 5, 13), rectCommand('H', 16, 5, 4, 14), pixelsCommand('h', [[5, 5], [4, 8], [18, 7], [18, 10]])];
    case 'stacked-bun': return [rectCommand('H', 6, 4, 12, 5), rectCommand('H', 9, 2, 6, 3), rectCommand('H', 10, 1, 4, 2), pixelsCommand('h', [[11, 1], [10, 3], [8, 5]])];
    case 'crop': return [rectCommand('H', 6, 4, 12, 4), pixelsCommand('h', [[7, 4], [10, 4], [13, 5], [16, 4]])];
    case 'bob': return [rectCommand('H', 5, 4, 14, 5), rectCommand('H', 4, 7, 4, 8), rectCommand('H', 16, 7, 4, 8), pixelsCommand('h', [[7, 5], [17, 6]])];
    case 'flat-top': return [rectCommand('H', 5, 2, 14, 6), rectCommand('h', 7, 2, 10, 2)];
    case 'high-bun': return [rectCommand('H', 6, 5, 12, 4), rectCommand('H', 9, 1, 6, 5), pixelsCommand('h', [[10, 2], [11, 1], [8, 6]])];
    case 'low-part': return [rectCommand('H', 6, 4, 12, 4), rectCommand('H', 5, 6, 4, 4), pixelsCommand('h', [[12, 4], [13, 4], [14, 4], [15, 5]])];
    case 'question': return [rectCommand('H', 6, 4, 11, 4), pixelsCommand('H', [[16, 3], [17, 2], [18, 2], [19, 3], [19, 4], [18, 5], [17, 5], [17, 6]])];
    case 'quiff': return [rectCommand('H', 6, 4, 12, 4), pixelsCommand('H', [[7, 3], [8, 2], [9, 2], [10, 3], [16, 3], [17, 2], [18, 2]])];
    case 'pompadour': return [rectCommand('H', 7, 4, 10, 4), rectCommand('H', 9, 2, 7, 3), rectCommand('h', 11, 2, 4, 1)];
    case 'twin-buns': return [rectCommand('H', 7, 4, 10, 5), rectCommand('H', 3, 3, 5, 5), rectCommand('H', 16, 3, 5, 5), pixelsCommand('h', [[4, 4], [17, 4]])];
    case 'long': return [rectCommand('H', 5, 4, 14, 5), rectCommand('H', 4, 7, 4, 14), rectCommand('H', 16, 7, 4, 14), pixelsCommand('h', [[6, 5], [17, 8], [17, 12]])];
    case 'mohawk': return [rectCommand('H', 9, 1, 6, 8), pixelsCommand('h', [[10, 2], [11, 1], [12, 1], [13, 2]])];
    case 'braids': return [rectCommand('H', 6, 4, 12, 4), rectCommand('H', 4, 7, 3, 12), rectCommand('H', 17, 7, 3, 12), pixelsCommand('h', [[5, 10], [18, 12]])];
    case 'bowl': return [rectCommand('H', 5, 4, 14, 5), rectCommand('H', 4, 7, 4, 4), rectCommand('H', 16, 7, 4, 4)];
    case 'spikes': return [rectCommand('H', 6, 5, 12, 4), pixelsCommand('H', [[6, 3], [8, 2], [10, 4], [12, 2], [14, 3], [17, 2], [18, 4]])];
    case 'side-fan': return [rectCommand('H', 6, 5, 10, 4), pixelsCommand('H', [[16, 4], [17, 3], [18, 2], [19, 3], [20, 4], [19, 5], [18, 6], [17, 7]])];
    case 'ponytail': return [rectCommand('H', 6, 4, 12, 4), rectCommand('H', 17, 6, 4, 8), pixelsCommand('h', [[18, 7], [19, 9]])];
  }
}

function worldBodyCommands(look: CharacterLook): DrawCommand[] {
  const body = (() => {
    switch (look.build) {
      case 'tiny': return [rectCommand('C', 9, 16, 6, 1), rectCommand('C', 8, 17, 8, 7)];
      case 'slim': return [rectCommand('C', 9, 16, 6, 1), rectCommand('C', 8, 17, 8, 2), rectCommand('C', 7, 19, 10, 5)];
      case 'normal': return [rectCommand('C', 9, 16, 6, 1), rectCommand('C', 7, 17, 10, 2), rectCommand('C', 6, 19, 12, 5)];
      case 'wide': return [rectCommand('C', 8, 16, 8, 1), rectCommand('C', 6, 17, 12, 2), rectCommand('C', 5, 19, 14, 5)];
      case 'round': return [rectCommand('C', 8, 16, 8, 1), rectCommand('C', 6, 17, 12, 2), rectCommand('C', 4, 19, 16, 5), rectCommand('C', 6, 24, 12, 1)];
      case 'top-heavy': return [rectCommand('C', 8, 16, 8, 1), rectCommand('C', 4, 17, 16, 3), rectCommand('C', 6, 20, 12, 2), rectCommand('C', 7, 22, 10, 3)];
      case 'pear': return [rectCommand('C', 9, 16, 6, 1), rectCommand('C', 8, 17, 8, 2), rectCommand('C', 6, 19, 12, 3), rectCommand('C', 5, 22, 14, 3)];
    }
  })();
  const armBounds = (() => {
    switch (look.build) {
      case 'tiny': return [7, 16] as const;
      case 'slim': return [6, 17] as const;
      case 'normal': return [5, 18] as const;
      case 'wide': return [4, 19] as const;
      case 'round': return [3, 20] as const;
      case 'top-heavy': return [3, 20] as const;
      case 'pear': return [5, 18] as const;
    }
  })();
  const arms = [
    rectCommand('C', armBounds[0], 17, 2, 3),
    rectCommand('C', armBounds[1], 17, 2, 3),
    rectCommand('S', armBounds[0], 20, 2, 3),
    rectCommand('S', armBounds[1], 20, 2, 3),
    rectCommand('s', armBounds[0], 22, 2, 1),
    rectCommand('s', armBounds[1], 22, 2, 1),
    pixelsCommand('c', [[9, 16], [14, 16]]),
  ];
  const patterns: DrawCommand[][] = [
    [rectCommand('c', 8, 17, 8, 2), pixelsCommand('A', [[11, 20], [12, 20]])],
    [pixelsCommand('A', [[7, 17], [8, 18], [9, 19], [10, 20], [11, 21], [12, 22], [13, 23]])],
    [rectCommand('A', 10, 16, 4, 2), pixelsCommand('a', [[11, 18], [12, 18]])],
    [rectCommand('c', 6, 22, 12, 2), rectCommand('A', 8, 18, 3, 4), rectCommand('A', 13, 18, 3, 4)],
    [rectCommand('A', 5, 17, 3, 6), rectCommand('c', 16, 17, 3, 6)],
    [rectCommand('c', 5, 16, 14, 3), pixelsCommand('A', [[6, 16], [17, 16], [11, 21], [12, 21]])],
  ];
  return [...body, ...(patterns[look.outfitPattern] as DrawCommand[]), ...arms];
}

function portraitBodyCommands(look: CharacterLook): DrawCommand[] {
  const [left, right] = (() => {
    switch (look.build) {
      case 'tiny': return [4, 19] as const;
      case 'slim': return [3, 20] as const;
      case 'normal': return [2, 21] as const;
      case 'wide': return [1, 22] as const;
      case 'round': return [1, 22] as const;
      case 'top-heavy': return [1, 22] as const;
      case 'pear': return [2, 21] as const;
    }
  })();
  const width = right - left + 1;
  return [
    rectCommand('C', 9, 16, 6, 1),
    rectCommand('C', 7, 17, 10, 1),
    rectCommand('C', 5, 18, 14, 1),
    rectCommand('C', 3, 19, 18, 1),
    rectCommand('C', left, 20, width, 9),
    rectCommand('c', left, 22, 2, 7),
    rectCommand('c', right - 1, 21, 2, 8),
    rectCommand('c', left + 2, 28, Math.max(2, width - 4), 1),
    ...(look.outfitPattern === 1
      ? [pixelsCommand('A', [[8, 18], [9, 19], [10, 20], [11, 21], [12, 22], [13, 23]])]
      : look.outfitPattern === 2
        ? [rectCommand('A', 10, 17, 4, 3)]
        : look.outfitPattern === 3
          ? [rectCommand('A', left + 3, 22, 4, 4), rectCommand('A', right - 6, 22, 4, 4)]
          : look.outfitPattern === 4
            ? [rectCommand('A', left, 20, 4, 8), rectCommand('c', right - 3, 20, 4, 8)]
            : look.outfitPattern === 5
              ? [rectCommand('c', left + 1, 20, width - 2, 3), rectCommand('A', 10, 24, 4, 2)]
              : [rectCommand('A', 10, 23, 4, 2)]),
  ];
}

function worldLegCommands(): CharacterSource['sourceLayers']['legs'] {
  return {
    frontFrames: [
      [rectCommand('D', 9, 24, 2, 4), rectCommand('D', 13, 24, 2, 4), rectCommand('W', 8, 28, 3, 2), rectCommand('W', 13, 28, 3, 2)],
      [rectCommand('D', 9, 24, 2, 4), rectCommand('D', 14, 24, 2, 4), rectCommand('W', 8, 28, 3, 2), rectCommand('W', 14, 28, 3, 2)],
    ],
    lateralFrames: [
      [rectCommand('D', 9, 24, 2, 4), rectCommand('D', 13, 24, 2, 4), rectCommand('W', 8, 28, 3, 2), rectCommand('W', 13, 28, 4, 2)],
      [rectCommand('D', 8, 24, 2, 4), rectCommand('D', 14, 24, 2, 4), rectCommand('W', 7, 28, 4, 2), rectCommand('W', 14, 28, 3, 2)],
    ],
  };
}

function oddityCommands(look: CharacterLook): DrawCommand[] {
  switch (look.oddity) {
    case 'tower-flat-top': return [rectCommand('H', 6, 1, 12, 5), rectCommand('h', 8, 1, 8, 2)];
    case 'question-forelock': return [pixelsCommand('H', [[15, 4], [16, 2], [18, 1], [20, 2], [20, 4], [18, 5], [17, 7]])];
    case 'window-glasses': return [rectCommand('K', 5, 8, 7, 4), rectCommand('K', 13, 8, 7, 4), rectCommand('W', 6, 9, 5, 2), rectCommand('W', 14, 9, 5, 2), rectCommand('K', 11, 9, 3, 1)];
    case 'cloud-side-hair': return [rectCommand('H', 2, 5, 5, 15), rectCommand('H', 17, 4, 5, 16), pixelsCommand('h', [[3, 7], [4, 11], [20, 6], [19, 10], [20, 14]])];
    case 'spa-stone-bun': return [rectCommand('H', 8, 3, 8, 4), rectCommand('H', 9, 1, 6, 3), rectCommand('h', 10, 1, 4, 1)];
    case 'crossed-hair-sticks': return [pixelsCommand('A', [[5, 1], [7, 2], [9, 3], [11, 4], [13, 4], [15, 3], [17, 2], [19, 1]])];
    case 'prize-forelock': return [pixelsCommand('H', [[7, 3], [9, 2], [11, 1], [14, 1], [16, 2], [18, 3], [20, 4], [21, 5], [19, 6]]), pixelsCommand('h', [[10, 2], [13, 2], [16, 3], [19, 4]])];
    case 'curl-moustache': return [pixelsCommand('H', [[5, 12], [6, 13], [7, 14], [8, 13], [9, 12], [10, 13], [11, 14], [12, 14], [13, 14], [14, 13], [15, 12], [16, 13], [17, 14], [18, 13], [19, 12]])];
    case 'blade-collar': return [pixelsCommand('A', [[2, 16], [3, 17], [4, 18], [5, 19], [6, 20], [21, 16], [20, 17], [19, 18], [18, 19], [17, 20]])];
    case 'square-ear-defenders': return [rectCommand('A', 3, 7, 4, 8), rectCommand('A', 17, 7, 4, 8), rectCommand('K', 4, 8, 2, 6), rectCommand('K', 18, 8, 2, 6)];
    case 'tiny-pompadour': return [rectCommand('H', 10, 1, 5, 3), rectCommand('h', 12, 1, 2, 1), rectCommand('A', 7, 16, 10, 2)];
    case 'umbrella-hat': return [rectCommand('A', 3, 3, 18, 2), pixelsCommand('A', [[5, 2], [7, 1], [9, 2], [11, 1], [13, 2], [15, 1], [17, 2], [19, 3], [12, 4], [12, 5]]), rectCommand('C', 4, 16, 16, 5)];
    case 'planet-buns': return [rectCommand('H', 2, 2, 6, 6), rectCommand('H', 16, 2, 6, 6), pixelsCommand('h', [[3, 3], [17, 3]])];
    case 'moon-cap': return [pixelsCommand('A', [[6, 2], [8, 1], [10, 1], [12, 2], [13, 3], [12, 4], [10, 5], [8, 5], [6, 4], [5, 3]])];
    case 'giant-satchel': return [pixelsCommand('A', [[6, 15], [8, 17], [10, 19], [12, 21], [14, 23]]), rectCommand('A', 13, 18, 8, 9), rectCommand('a', 15, 20, 4, 3)];
    case 'lantern-chin': return [rectCommand('s', 9, 14, 6, 4), pixelsCommand('s', [[10, 18], [11, 19], [12, 19], [13, 19], [14, 18]])];
    case 'wide-straw-hat': return [rectCommand('A', 2, 3, 20, 3), rectCommand('a', 7, 1, 10, 3)];
    case 'tiny-hat-high-collar': return [rectCommand('A', 10, 1, 4, 2), rectCommand('A', 3, 13, 5, 8), rectCommand('A', 16, 13, 5, 8)];
    case 'single-bell-sleeve': return [rectCommand('C', 2, 17, 6, 8), rectCommand('c', 3, 18, 4, 3), rectCommand('S', 18, 17, 2, 6)];
    case 'giant-head-bow': return [pixelsCommand('A', [[3, 3], [4, 2], [5, 2], [6, 3], [7, 4], [8, 5], [16, 5], [17, 4], [18, 3], [19, 2], [20, 2], [21, 3], [12, 4]])];
    case 'tower-beanie': return [pixelsCommand('A', [[8, 6], [7, 5], [8, 3], [9, 2], [10, 1], [13, 1], [15, 2], [16, 4], [15, 6]]), rectCommand('A', 16, 12, 3, 13)];
    case 'side-fan-hair': return [pixelsCommand('H', [[16, 2], [18, 1], [20, 2], [21, 4], [20, 6], [18, 7], [16, 8]]), pixelsCommand('h', [[19, 3], [19, 5]])];
    case 'spiral-moustache': return [pixelsCommand('H', [[4, 12], [5, 11], [7, 11], [8, 12], [7, 14], [5, 14], [10, 13], [11, 14], [12, 14], [13, 13], [16, 12], [17, 11], [19, 11], [20, 12], [19, 14], [17, 14]])];
    case 'monocle-chain': return [rectCommand('A', 14, 8, 5, 5), pixelsCommand('A', [[18, 12], [18, 14], [17, 16], [17, 18], [16, 20], [16, 22], [15, 24]])];
    case 'wing-collar': return [pixelsCommand('a', [[3, 14], [4, 15], [5, 16], [6, 17], [7, 18], [20, 14], [19, 15], [18, 16], [17, 17], [16, 18]])];
    case 'loop-backpack': return [pixelsCommand('A', [[5, 17], [4, 15], [4, 10], [5, 7], [7, 5], [9, 4], [15, 4], [17, 5], [19, 7], [20, 10], [20, 16], [19, 18]])];
    case 'giant-gloves': return [rectCommand('A', 2, 18, 6, 7), rectCommand('A', 16, 18, 6, 7), rectCommand('a', 3, 19, 4, 3), rectCommand('a', 17, 19, 4, 3)];
    case 'one-ear-cap': return [rectCommand('A', 6, 2, 12, 4), rectCommand('A', 4, 5, 4, 9)];
    case 'soft-mohawk': return [pixelsCommand('H', [[9, 5], [9, 3], [10, 1], [12, 1], [14, 2], [16, 3], [17, 5], [16, 7]]), pixelsCommand('h', [[11, 2], [14, 3]])];
    case 'veil-cap': return [rectCommand('A', 9, 2, 6, 3), rectCommand('A', 16, 4, 5, 14), pixelsCommand('a', [[17, 6], [19, 9], [18, 13]])];
    case 'star-glasses': return [pixelsCommand('A', [[5, 8], [7, 8], [8, 6], [9, 8], [11, 8], [9, 10], [8, 12], [7, 10], [14, 8], [16, 8], [17, 6], [18, 8], [20, 8], [18, 10], [17, 12], [16, 10]])];
    case 'shoulder-bird': return [rectCommand('A', 17, 12, 5, 6), pixelsCommand('a', [[18, 11], [19, 10], [20, 11], [21, 14]]), pixelsCommand('K', [[20, 12]])];
    case 'triple-braid': return [rectCommand('H', 3, 6, 3, 13), rectCommand('H', 10, 7, 3, 13), rectCommand('H', 18, 6, 3, 13), pixelsCommand('h', [[4, 9], [11, 10], [19, 9]])];
    case 'double-goggles': return [rectCommand('A', 4, 6, 16, 3), rectCommand('W', 6, 7, 5, 3), rectCommand('W', 14, 7, 5, 3), rectCommand('A', 7, 12, 4, 3), rectCommand('A', 14, 12, 4, 3)];
    case 'shell-shoulders': return [rectCommand('A', 2, 15, 6, 7), rectCommand('A', 16, 15, 6, 7), pixelsCommand('a', [[3, 17], [4, 16], [6, 18], [5, 20], [17, 18], [18, 16], [20, 17], [19, 20]])];
    default: throw new Error(`Unknown character oddity ${look.oddity}.`);
  }
}

function secondaryWorldCommands(look: CharacterLook): DrawCommand[] {
  switch (look.secondary) {
    case 'tiny-waist-jacket': return [pixelsCommand('a', [[7, 17], [9, 19], [11, 21], [16, 17], [14, 19], [12, 21]]), rectCommand('A', 8, 23, 8, 1)];
    case 'shoulder-recorder': return [pixelsCommand('A', [[7, 16], [9, 18], [11, 20], [13, 22]]), rectCommand('A', 17, 17, 4, 7), rectCommand('K', 18, 18, 2, 2)];
    case 'long-scarf': return [rectCommand('A', 8, 15, 8, 2), rectCommand('A', 16, 16, 3, 10), pixelsCommand('a', [[17, 18], [18, 21], [17, 24], [18, 26]])];
    case 'flared-dress': return [rectCommand('C', 7, 19, 10, 2), rectCommand('C', 6, 21, 12, 2), rectCommand('C', 5, 23, 14, 3), rectCommand('c', 5, 25, 14, 1), pixelsCommand('A', [[9, 18], [14, 18]])];
    case 'towel-sleeve': return [rectCommand('W', 3, 17, 5, 8), rectCommand('D', 4, 19, 3, 1), rectCommand('A', 17, 21, 4, 5)];
    case 'clinic-pockets': return [rectCommand('W', 6, 21, 5, 4), rectCommand('W', 13, 21, 5, 4), pixelsCommand('A', [[7, 22], [14, 22]])];
    case 'luggage-strap': return [pixelsCommand('A', [[6, 16], [8, 17], [9, 19], [11, 20], [12, 22], [14, 23], [15, 25]]), rectCommand('A', 17, 20, 5, 8), rectCommand('a', 18, 22, 3, 2)];
    case 'cook-apron-ladle': return [rectCommand('W', 8, 18, 8, 7), rectCommand('D', 18, 16, 1, 9), rectCommand('D', 17, 24, 3, 2), pixelsCommand('A', [[11, 20], [12, 20]])];
    case 'asymmetric-sleeves': return [rectCommand('C', 3, 17, 3, 8), rectCommand('S', 18, 18, 2, 4), rectCommand('A', 3, 24, 3, 1)];
    case 'permit-pouch': return [pixelsCommand('A', [[7, 16], [9, 18], [11, 20], [13, 22]]), rectCommand('A', 14, 20, 6, 6), rectCommand('K', 16, 21, 2, 1)];
    case 'bow-tie': return [pixelsCommand('A', [[8, 16], [9, 15], [11, 17], [12, 16], [13, 17], [15, 15], [16, 16]]), rectCommand('a', 11, 16, 3, 2)];
    case 'rain-cape': return [rectCommand('C', 5, 17, 14, 3), rectCommand('C', 4, 20, 16, 4), rectCommand('C', 3, 24, 18, 2), rectCommand('c', 4, 25, 16, 1)];
    case 'big-black-boots': return [rectCommand('D', 7, 25, 5, 5), rectCommand('D', 13, 25, 5, 5), rectCommand('K', 6, 28, 6, 2), rectCommand('K', 13, 28, 6, 2)];
    case 'bright-cuff': return [rectCommand('A', 4, 20, 3, 3), pixelsCommand('a', [[5, 21]]), rectCommand('C', 18, 18, 2, 5)];
    case 'guitar-case': return [pixelsCommand('A', [[6, 16], [8, 17], [10, 19], [12, 21], [14, 23]]), rectCommand('D', 17, 15, 4, 13), rectCommand('K', 16, 18, 6, 7), rectCommand('A', 18, 16, 2, 2)];
    case 'short-jacket': return [rectCommand('c', 6, 17, 12, 5), rectCommand('A', 7, 21, 10, 1), pixelsCommand('a', [[11, 18], [12, 18]])];
    case 'double-braids': return [rectCommand('H', 4, 8, 3, 12), rectCommand('H', 17, 8, 3, 12), pixelsCommand('h', [[5, 11], [5, 15], [18, 11], [18, 15]])];
    case 'flared-coat': return [rectCommand('C', 8, 18, 8, 2), rectCommand('C', 6, 20, 12, 2), rectCommand('C', 4, 22, 16, 4), pixelsCommand('A', [[11, 20], [12, 20]])];
    case 'opposite-ponytail': return [rectCommand('H', 3, 6, 4, 8), pixelsCommand('h', [[4, 7], [5, 10], [4, 13]])];
    case 'split-tunic': return [rectCommand('c', 5, 18, 7, 7), rectCommand('A', 12, 18, 7, 7), rectCommand('K', 11, 18, 2, 7)];
    case 'round-vest-button': return [rectCommand('c', 7, 17, 10, 8), pixelsCommand('A', [[11, 18], [12, 18], [11, 21], [12, 21]])];
    case 'side-fastened-jacket': return [pixelsCommand('A', [[15, 17], [15, 19], [15, 21], [15, 23]]), rectCommand('c', 6, 17, 3, 8)];
    case 'tiny-waist-belt': return [rectCommand('D', 8, 22, 8, 1), pixelsCommand('A', [[11, 22], [12, 22]])];
    case 'charm-bracelet': return [rectCommand('A', 18, 21, 3, 1), pixelsCommand('a', [[18, 23], [20, 24], [21, 22]])];
    case 'half-cape': return [rectCommand('A', 4, 16, 7, 10), rectCommand('a', 5, 18, 2, 7), pixelsCommand('A', [[11, 17], [12, 18]])];
    case 'suspenders': return [rectCommand('A', 8, 17, 2, 8), rectCommand('A', 14, 17, 2, 8), rectCommand('a', 9, 23, 6, 1)];
    case 'pearl-necklace': return [pixelsCommand('W', [[8, 16], [9, 17], [10, 18], [11, 18], [12, 18], [13, 18], [14, 17], [15, 16]]), pixelsCommand('A', [[11, 19], [12, 19]])];
    case 'star-cuff': return [pixelsCommand('A', [[18, 19], [19, 20], [21, 20], [20, 21], [21, 22], [19, 22], [18, 23], [18, 21], [17, 20]])];
    case 'large-necklace': return [pixelsCommand('A', [[6, 16], [7, 18], [8, 19], [9, 20], [10, 21], [11, 22], [12, 22], [13, 21], [14, 20], [15, 19], [16, 18], [17, 16]]), rectCommand('a', 10, 22, 4, 3)];
    case 'thin-ponytail': return [pixelsCommand('H', [[18, 6], [19, 8], [20, 10], [20, 12], [19, 14], [20, 16], [19, 18]]), pixelsCommand('h', [[20, 11], [19, 17]])];
  }
}

function secondaryPortraitCommands(look: CharacterLook): DrawCommand[] {
  if (look.secondary === 'big-black-boots') {
    return [
      rectCommand('D', 7, 23, 4, 5),
      rectCommand('D', 13, 23, 4, 5),
      rectCommand('K', 6, 27, 5, 2),
      rectCommand('K', 13, 27, 5, 2),
    ];
  }
  return secondaryWorldCommands(look).filter((command) => (
    command.kind === 'rect'
      ? command.y + command.height <= PORTRAIT_CELL.height
      : command.points.every(([, y]) => y < PORTRAIT_CELL.height)
  ));
}

function portraitTransform(commands: readonly DrawCommand[]): DrawCommand[] {
  return commands.map((command) => {
    if (command.kind === 'rect') {
      return rectCommand(command.token, command.x, command.y, command.width, command.height);
    }
    return pixelsCommand(command.token, command.points);
  });
}

export function getCharacterIdentityCommandSets(look: CharacterLook): Readonly<{
  primaryWorld: readonly DrawCommand[];
  secondaryWorld: readonly DrawCommand[];
  primaryPortrait: readonly DrawCommand[];
  secondaryPortrait: readonly DrawCommand[];
}> {
  const primaryWorld = oddityCommands(look);
  return Object.freeze({
    primaryWorld,
    secondaryWorld: secondaryWorldCommands(look),
    primaryPortrait: portraitTransform(primaryWorld),
    secondaryPortrait: secondaryPortraitCommands(look),
  });
}

export function getCharacterGeometryCommandSets(look: CharacterLook): Readonly<{
  worldBody: readonly DrawCommand[];
  portraitBody: readonly DrawCommand[];
  legs: CharacterSource['sourceLayers']['legs'];
}> {
  return Object.freeze({
    worldBody: worldBodyCommands(look),
    portraitBody: portraitBodyCommands(look),
    legs: worldLegCommands(),
  });
}

function buildCharacterSource(look: CharacterLook): CharacterSource {
  const baseHair = worldHairCommands(look);
  const geometry = getCharacterGeometryCommandSets(look);
  const body = geometry.worldBody;
  const features = getCharacterIdentityCommandSets(look);
  const oddity = features.primaryWorld;
  const secondary = features.secondaryWorld;
  const layerCommands = {
    torsoAndClothing: [
      ...body,
      ...(look.oddityLayer === 'torsoAndClothing' ? oddity : []),
      ...(look.secondaryLayer === 'torsoAndClothing' ? secondary : []),
    ],
    hair: [
      ...baseHair,
      ...(look.oddityLayer === 'hair' ? oddity : []),
      ...(look.secondaryLayer === 'hair' ? secondary : []),
    ],
    accessory: [
      ...(look.oddityLayer === 'accessory' ? oddity : []),
      ...(look.secondaryLayer === 'accessory' ? secondary : []),
    ],
    heldItem: [
      ...(look.oddityLayer === 'heldItem' ? oddity : []),
      ...(look.secondaryLayer === 'heldItem' ? secondary : []),
    ],
  };
  const portraitOddity = features.primaryPortrait;
  const portraitHair = portraitTransform(baseHair);
  const portraitSecondary = features.secondaryPortrait;
  const portraitLayerCommands = {
    torsoAndClothing: [
      ...geometry.portraitBody,
      ...(look.oddityLayer === 'torsoAndClothing' ? portraitOddity : []),
      ...(look.secondaryLayer === 'torsoAndClothing' ? portraitSecondary : []),
    ],
    hair: [
      ...portraitHair,
      ...(look.oddityLayer === 'hair' ? portraitOddity : []),
      ...(look.secondaryLayer === 'hair' ? portraitSecondary : []),
    ],
    accessory: [
      ...(look.oddityLayer === 'accessory' ? portraitOddity : []),
      ...(look.secondaryLayer === 'accessory' ? portraitSecondary : []),
    ],
    heldItem: [
      ...(look.oddityLayer === 'heldItem' ? portraitOddity : []),
      ...(look.secondaryLayer === 'heldItem' ? portraitSecondary : []),
    ],
  };
  const expressions = Object.fromEntries(look.expressions.map((expression) => [
    expression,
    { commands: portraitExpressionCommands(expression, look) },
  ])) as CharacterSource['portraitExpressions'];
  return CharacterSourceSchema.parse({
    id: look.id,
    displayName: look.displayName,
    kind: look.kind,
    cell: WORLD_CELL,
    portraitCell: PORTRAIT_CELL,
    palette: characterPalette(look),
    identityTokens: { hair: 'H', clothing: 'C', skin: 'S' },
    identityFeatures: [
      {
        id: look.oddity,
        description: look.signatureOddity,
        layer: look.oddityLayer,
        visibleIn: ['front', 'rear', 'left', 'right'],
      },
      {
        id: look.secondary,
        description: look.supportingFeature,
        layer: look.secondaryLayer,
        visibleIn: ['front', 'rear', 'left', 'right'],
      },
    ],
    rearStyle: { head: 'H', lower: 's', clothing: 'C', torsoDetailTokens: ['c', 'A', 'a'] },
    signatureOddity: {
      id: look.oddity,
      description: look.signatureOddity,
      supportingFeature: look.supportingFeature,
    },
    sourceLayers: {
      legs: geometry.legs,
      torsoAndClothing: { commands: layerCommands.torsoAndClothing },
      headAndFace: { commands: worldHeadCommands(look) },
      hair: { commands: layerCommands.hair },
      accessory: { commands: layerCommands.accessory },
      heldItem: { commands: layerCommands.heldItem },
    },
    portraitLayers: {
      legs: { commands: [] },
      torsoAndClothing: { commands: portraitLayerCommands.torsoAndClothing },
      headAndFace: { commands: portraitHeadCommands(look) },
      hair: { commands: portraitLayerCommands.hair },
      accessory: { commands: portraitLayerCommands.accessory },
      heldItem: { commands: portraitLayerCommands.heldItem },
    },
    portraitExpressions: expressions,
  });
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
  const portraitCommands = [
    ...Object.values(source.portraitLayers).flatMap((layer) => layer?.commands ?? []),
    ...Object.values(source.portraitExpressions).flatMap((layer) => layer?.commands ?? []),
  ];
  assertCommandBounds(worldCommands, WORLD_CELL.width, WORLD_CELL.height);
  assertCommandBounds(portraitCommands, PORTRAIT_CELL.width, PORTRAIT_CELL.height);
  for (const command of [...worldCommands, ...portraitCommands]) {
    if (!source.palette[command.token]) {
      throw new Error(`${source.id} uses missing palette token ${command.token}.`);
    }
  }
  if (new Set(source.identityFeatures.map(({ id }) => id)).size !== source.identityFeatures.length) {
    throw new Error(`${source.id} identity feature IDs must be unique.`);
  }
  if (source.kind === 'named' && (!source.portraitExpressions.joy || !source.portraitExpressions.upset)) {
    throw new Error(`${source.id} must generate rest, joy, and upset portraits.`);
  }
  if (!source.identityFeatures.some(({ visibleIn }) => (
    ['front', 'rear', 'left', 'right'] as const
  ).every((direction) => visibleIn.includes(direction)))) {
    throw new Error(`${source.id} must document one identity feature in all four directions.`);
  }
  for (const frameIndex of [0, 1] as const) {
    const frame = composeFrontFrame(source, frameIndex);
    if (
      [...frame[0] as string].some((token) => token !== '.') ||
      frame.some((row) => row[0] !== '.' || row[WORLD_CELL.width - 1] !== '.')
    ) {
      throw new Error(`${source.id} must keep top, left, and right source margins open.`);
    }
  }
  const portrait = composePortrait(source);
  if (
    [...portrait[0] as string].some((token) => token !== '.') ||
    portrait.some((row) => row[0] !== '.' || row[PORTRAIT_CELL.width - 1] !== '.')
  ) {
    throw new Error(`${source.id} portrait must keep top, left, and right contour margins open.`);
  }
  return source;
}

export function loadCharacterSources(root = process.cwd()): CharacterSource[] {
  void root;
  const sources = CHARACTER_LOOKS
    .map(buildCharacterSource)
    .map(validateCharacter)
    .sort((left, right) => left.id.localeCompare(right.id, 'en'));
  const ids = sources.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) {
    throw new Error('Character source IDs must be unique.');
  }
  const oddities = sources.map(({ signatureOddity }) => signatureOddity.id);
  if (new Set(oddities).size !== oddities.length) {
    throw new Error('Character signature oddities must be unique.');
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
    wallPalettes.map(({ id, palette, modules }) => ({ id, palette, modules: modules ?? wallModules })),
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

export function composePortrait(
  source: CharacterSource,
  expression: PortraitExpression = 'rest',
): TokenFrame {
  const frame = emptyTokenFrame(PORTRAIT_CELL.width, PORTRAIT_CELL.height);
  for (const layerName of ['legs', 'torsoAndClothing', 'headAndFace'] as const) {
    const layer = source.portraitLayers[layerName];
    if (layer) {
      drawTokenCommands(frame, layer.commands);
    }
  }
  const expressionLayer = source.portraitExpressions[expression];
  if (!expressionLayer) {
    throw new Error(`${source.id} does not define the ${expression} portrait expression.`);
  }
  drawTokenCommands(frame, expressionLayer.commands);
  for (const layerName of ['hair', 'accessory', 'heldItem'] as const) {
    const layer = source.portraitLayers[layerName];
    if (layer) drawTokenCommands(frame, layer.commands);
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
