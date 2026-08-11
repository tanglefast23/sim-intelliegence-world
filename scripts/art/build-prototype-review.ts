import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { AtlasIndex, AtlasRect } from './build-world-atlas';
import {
  ART_PRESENTATION_REVISION,
  MATERIAL_RECIPE_BY_ID,
} from '../../src/world/presentation/recipes';
import {
  canonicalMaterialDistribution,
  selectMaterialVariants,
} from '../../src/world/presentation/material-selection';
import { compileMaterialTransitions } from '../../src/world/presentation/material-transitions';
import {
  blit,
  blitScaled,
  createBitmap,
  decodePng,
  encodePng,
  fillRect,
  parseHexColor,
  type Bitmap,
} from './png';

const PROTOTYPE_CHARACTERS = ['protagonist', 'linda', 'generic-resident'] as const;
const PROTOTYPE_MATERIALS = ['warm-sand', 'dune-grass', 'villa-floor', 'spa-stone', 'shallow-water'] as const;
const DIRECTIONS = ['front-1', 'front-2', 'rear-1', 'rear-2', 'left-1', 'left-2', 'right-1', 'right-2'] as const;

function crop(source: Bitmap, rectangle: AtlasRect): Bitmap {
  const target = createBitmap(rectangle.width, rectangle.height);
  for (let y = 0; y < rectangle.height; y += 1) {
    const sourceStart = ((rectangle.y + y) * source.width + rectangle.x) * 4;
    source.data.copy(target.data, y * rectangle.width * 4, sourceStart, sourceStart + rectangle.width * 4);
  }
  return target;
}

function sprite(atlas: Bitmap, index: AtlasIndex, id: string): Bitmap {
  const rectangle = index.sprites[id];
  if (!rectangle) throw new Error(`Prototype review is missing atlas sprite ${id}.`);
  return crop(atlas, rectangle);
}

function scaled(source: Bitmap, scale: number, fill = '#17151b'): Bitmap {
  const target = createBitmap(source.width * scale, source.height * scale, parseHexColor(fill));
  blitScaled(source, target, 0, 0, scale);
  return target;
}

function writeBitmap(outputRoot: string, name: string, bitmap: Bitmap): string {
  const path = resolve(outputRoot, name);
  writeFileSync(path, encodePng(bitmap), { flush: true });
  return name;
}

function materialBoard(
  atlas: Bitmap,
  index: AtlasIndex,
  materialId: string,
): Readonly<{ bitmap: Bitmap; report: ReturnType<typeof canonicalMaterialDistribution> }> {
  const recipe = MATERIAL_RECIPE_BY_ID[materialId];
  if (!recipe) throw new Error(`Prototype review is missing material recipe ${materialId}.`);
  const selections = selectMaterialVariants({
    mapId: `phase-28-${materialId}`,
    width: 12,
    height: 12,
    materialIds: Array.from({ length: 144 }, () => materialId),
    artRevision: ART_PRESENTATION_REVISION,
    recipesById: { [materialId]: recipe },
  });
  const board = createBitmap(12 * 32, 12 * 32);
  selections.forEach(({ variantIndex }, offset) => {
    const id = recipe.publicVariantSprites[variantIndex];
    if (!id) throw new Error(`${materialId} selection ${variantIndex} has no sprite.`);
    blit(sprite(atlas, index, id), board, (offset % 12) * 32, Math.floor(offset / 12) * 32);
  });
  return {
    bitmap: board,
    report: canonicalMaterialDistribution(`phase-28-${materialId}`, recipe, ART_PRESENTATION_REVISION),
  };
}

function characterBoard(atlas: Bitmap, index: AtlasIndex): Bitmap {
  const board = createBitmap(640, 252, parseHexColor('#17151b'));
  PROTOTYPE_CHARACTERS.forEach((characterId, row) => {
    const y = 12 + row * 80;
    fillRect(board, 8, y - 6, 624, 74, parseHexColor(row % 2 === 0 ? '#25232b' : '#2c2830'));
    DIRECTIONS.forEach((direction, column) => {
      blit(sprite(atlas, index, `character.${characterId}.${direction}`), board, 16 + column * 38, y);
    });
    blit(sprite(atlas, index, `portrait.${characterId}`), board, 360, y);
    DIRECTIONS.forEach((direction, column) => {
      blitScaled(sprite(atlas, index, `character.${characterId}.${direction}`), board, 420 + column * 25, y, 1);
    });
  });
  return board;
}

function transitionBoard(atlas: Bitmap, index: AtlasIndex): Bitmap {
  const board = createBitmap(8 * 32, 4 * 32, parseHexColor('#d2ad72'));
  (['soft', 'built'] as const).forEach((family, familyIndex) => {
    for (let mask = 1; mask <= 15; mask += 1) {
      const offset = familyIndex * 16 + mask - 1;
      blit(
        sprite(atlas, index, `tile.transition-${family}-${mask.toString(16)}`),
        board,
        (offset % 8) * 32,
        Math.floor(offset / 8) * 32,
      );
    }
  });
  return board;
}

function transitionJunctionBoard(atlas: Bitmap, index: AtlasIndex): Bitmap {
  const board = createBitmap(7 * 32, 3 * 32, parseHexColor('#17151b'));
  const fixtures = [
    {
      x: 0,
      materialIds: [
        'warm-sand', 'villa-floor', 'warm-sand',
        'villa-floor', 'shallow-water', 'villa-floor',
        'warm-sand', 'villa-floor', 'warm-sand',
      ],
      recipes: MATERIAL_RECIPE_BY_ID,
    },
    {
      x: 4,
      materialIds: [
        'dune-grass', 'warm-sand', 'dune-grass',
        'warm-sand', 'spa-stone', 'warm-sand',
        'dune-grass', 'warm-sand', 'dune-grass',
      ],
      recipes: Object.freeze(Object.fromEntries(Object.entries(MATERIAL_RECIPE_BY_ID).map(([id, recipe]) => [
        id,
        ['dune-grass', 'warm-sand', 'spa-stone'].includes(id)
          ? Object.freeze({ ...recipe, transitionPriority: 50 })
          : recipe,
      ]))),
    },
  ] as const;
  for (const fixture of fixtures) {
    fixture.materialIds.forEach((materialId, offset) => {
      const recipe = fixture.recipes[materialId];
      if (!recipe) throw new Error(`Transition fixture has no material recipe for ${materialId}.`);
      blit(
        sprite(atlas, index, recipe.publicVariantSprites[offset % recipe.publicVariantSprites.length] as string),
        board,
        (fixture.x + offset % 3) * 32,
        Math.floor(offset / 3) * 32,
      );
    });
    for (const transition of compileMaterialTransitions({
      width: 3,
      height: 3,
      materialIds: fixture.materialIds,
      recipesById: fixture.recipes,
    })) {
      const owner = fixture.recipes[transition.ownerMaterialId];
      const family = owner?.edgeMode === 'soft' ? 'soft' : 'built';
      blit(
        sprite(atlas, index, `tile.transition-${family}-${transition.cornerMask.toString(16)}`),
        board,
        (fixture.x + transition.tileX) * 32,
        transition.tileY * 32,
      );
    }
  }
  return board;
}

function doorStateBoard(atlas: Bitmap, index: AtlasIndex): Bitmap {
  const board = createBitmap(3 * 64, 64, parseHexColor('#17151b'));
  const floor = sprite(atlas, index, 'tile.villa-floor');
  const states = ['tile.open-door', 'tile.closed-door', 'tile.closed-door'] as const;
  states.forEach((door, column) => {
    blitScaled(floor, board, column * 64, 0, 2);
    blitScaled(sprite(atlas, index, door), board, column * 64, 0, 2);
  });
  return board;
}

function architectureBoard(atlas: Bitmap, index: AtlasIndex): Bitmap {
  const ids = [
    'tile.roof-sunward-base', 'tile.roof-sunward-edge', 'tile.roof-sunward-corner',
    'tile.wall-villa-0', 'tile.wall-villa-3', 'tile.wall-villa-f',
    'tile.open-door', 'tile.closed-door',
    'tile.sofa-left', 'tile.sofa-right', 'tile.table-left', 'tile.table-right',
    'tile.fixture-planter', 'tile.plant-palm', 'tile.fixture-lamp',
    'tile.landmark-fountain-nw', 'tile.landmark-fountain-ne',
    'tile.landmark-fountain-sw', 'tile.landmark-fountain-se',
  ];
  const board = createBitmap(8 * 48, 3 * 48, parseHexColor('#20242a'));
  ids.forEach((id, offset) => {
    const x = (offset % 8) * 48 + 8;
    const y = Math.floor(offset / 8) * 48 + 8;
    fillRect(board, x - 4, y - 4, 40, 40, parseHexColor(offset % 2 === 0 ? '#ece4d0' : '#29272e'));
    blit(sprite(atlas, index, id), board, x, y);
  });
  return board;
}

function depthBoard(atlas: Bitmap, index: AtlasIndex): Bitmap {
  const propIds = [
    'tile.sofa-left', 'tile.table-left', 'tile.fixture-planter',
    'tile.plant-palm', 'tile.fixture-lamp', 'tile.landmark-fountain-nw',
  ];
  const ground = sprite(atlas, index, 'tile.villa-floor');
  const character = sprite(atlas, index, 'character.protagonist.front-1');
  const board = createBitmap(propIds.length * 72, 80, parseHexColor('#17151b'));
  propIds.forEach((propId, column) => {
    const x = column * 72;
    for (const offset of [0, 36]) blit(ground, board, x + offset, 20);
    const prop = sprite(atlas, index, propId);
    blit(character, board, x + 4, 18);
    blit(prop, board, x, 20);
    blit(prop, board, x + 36, 20);
    blit(character, board, x + 40, 24);
  });
  return board;
}

function composeGroup(atlas: Bitmap, index: AtlasIndex, ids: readonly string[], columns: number): Bitmap {
  const rows = Math.ceil(ids.length / columns);
  const composed = createBitmap(columns * 32, rows * 32);
  ids.forEach((id, offset) => blit(
    sprite(atlas, index, `tile.${id}`),
    composed,
    (offset % columns) * 32,
    Math.floor(offset / columns) * 32,
  ));
  return composed;
}

export type PrototypeReviewReport = Readonly<{
  schemaVersion: 1;
  artRevision: number;
  files: readonly string[];
  materials: readonly ReturnType<typeof canonicalMaterialDistribution>[];
  characters: readonly string[];
  lateralThreeQuarterHeadRequired: false;
  transitionCases: readonly ['unequal-priority-junction', 'equal-priority-tie'];
  doorStates: readonly ['open', 'closed-unlocked', 'closed-locked'];
  tallPropClasses: readonly ['sofa', 'table', 'planter', 'palm', 'lamp', 'fountain'];
  multiTileGroups: Readonly<Record<string, readonly string[]>>;
}>;

export function writePrototypeReview(outputRoot: string, root = process.cwd()): PrototypeReviewReport {
  mkdirSync(outputRoot, { recursive: true });
  const generatedRoot = resolve(root, 'assets/generated');
  const atlas = decodePng(readFileSync(resolve(generatedRoot, 'world-atlas.png')));
  const index = JSON.parse(readFileSync(resolve(generatedRoot, 'atlas-index.json'), 'utf8')) as AtlasIndex;
  const files: string[] = [];

  const characters = characterBoard(atlas, index);
  files.push(writeBitmap(outputRoot, 'prototype-characters-1x.png', characters));
  files.push(writeBitmap(outputRoot, 'prototype-characters-3x.png', scaled(characters, 3)));

  const materialReports = PROTOTYPE_MATERIALS.map((materialId) => {
    const board = materialBoard(atlas, index, materialId);
    files.push(writeBitmap(outputRoot, `material-${materialId}-12x12-1x.png`, board.bitmap));
    files.push(writeBitmap(outputRoot, `material-${materialId}-12x12-3x.png`, scaled(board.bitmap, 3)));
    return board.report;
  });

  const transitions = transitionBoard(atlas, index);
  files.push(writeBitmap(outputRoot, 'transition-topology-1x.png', transitions));
  files.push(writeBitmap(outputRoot, 'transition-topology-3x.png', scaled(transitions, 3)));
  const transitionJunctions = transitionJunctionBoard(atlas, index);
  files.push(writeBitmap(outputRoot, 'transition-junctions-1x.png', transitionJunctions));
  files.push(writeBitmap(outputRoot, 'transition-junctions-3x.png', scaled(transitionJunctions, 3)));
  const architecture = architectureBoard(atlas, index);
  files.push(writeBitmap(outputRoot, 'architecture-objects-1x.png', architecture));
  files.push(writeBitmap(outputRoot, 'architecture-objects-3x.png', scaled(architecture, 3)));
  const doors = doorStateBoard(atlas, index);
  files.push(writeBitmap(outputRoot, 'door-states-1x.png', doors));
  files.push(writeBitmap(outputRoot, 'door-states-3x.png', scaled(doors, 3)));
  const depth = depthBoard(atlas, index);
  files.push(writeBitmap(outputRoot, 'tall-prop-depth-1x.png', depth));
  files.push(writeBitmap(outputRoot, 'tall-prop-depth-3x.png', scaled(depth, 3)));

  for (const [id, partIds] of Object.entries(index.multiTileCompositions)) {
    const columns = id === 'sunward-fountain' ? 2 : partIds.length;
    const composed = composeGroup(atlas, index, partIds, columns);
    files.push(writeBitmap(outputRoot, `multi-${id}-1x.png`, composed));
    files.push(writeBitmap(outputRoot, `multi-${id}-3x.png`, scaled(composed, 3)));
  }

  const report: PrototypeReviewReport = Object.freeze({
    schemaVersion: 1,
    artRevision: index.artRevision,
    files: Object.freeze(files),
    materials: Object.freeze(materialReports),
    characters: Object.freeze([...PROTOTYPE_CHARACTERS]),
    lateralThreeQuarterHeadRequired: false,
    transitionCases: Object.freeze(['unequal-priority-junction', 'equal-priority-tie'] as const),
    doorStates: Object.freeze(['open', 'closed-unlocked', 'closed-locked'] as const),
    tallPropClasses: Object.freeze(['sofa', 'table', 'planter', 'palm', 'lamp', 'fountain'] as const),
    multiTileGroups: Object.freeze(index.multiTileCompositions),
  });
  writeFileSync(resolve(outputRoot, 'prototype-review-report.json'), `${JSON.stringify(report, null, 2)}\n`, {
    encoding: 'utf8',
    flush: true,
  });
  return report;
}
