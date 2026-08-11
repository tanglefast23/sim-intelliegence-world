import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { AtlasIndex, AtlasRect } from './build-world-atlas';
import { selectMaterialVariants } from '../../src/world/presentation/material-selection';
import {
  ART_PRESENTATION_REVISION,
  MATERIAL_RECIPE_BY_ID,
} from '../../src/world/presentation/recipes';
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

const MATERIALS = ['warm-sand', 'villa-floor', 'plaza-paver', 'boardwalk'] as const;
const ARCHITECTURE_SPRITES = [
  ...Array.from({ length: 16 }, (_unused, mask) => `tile.wall-villa-${mask.toString(16)}`),
  'tile.open-door', 'tile.closed-door', 'tile.closed-locked-door',
  'tile.roof-sunward-base', 'tile.roof-sunward-edge', 'tile.roof-sunward-corner',
  'tile.bed-head', 'tile.bed-foot', 'tile.sofa-left', 'tile.sofa-right',
  'tile.table-left', 'tile.table-right', 'tile.counter-left', 'tile.counter-right',
  'tile.sign-spa', 'tile.sign-market', 'tile.fixture-lamp', 'tile.fixture-planter',
  'tile.plant-palm', 'tile.decal-sand-shells',
] as const;

function crop(source: Bitmap, rectangle: AtlasRect): Bitmap {
  const target = createBitmap(rectangle.width, rectangle.height);
  for (let row = 0; row < rectangle.height; row += 1) {
    const sourceStart = ((rectangle.y + row) * source.width + rectangle.x) * 4;
    source.data.copy(target.data, row * rectangle.width * 4, sourceStart, sourceStart + rectangle.width * 4);
  }
  return target;
}

function sprite(atlas: Bitmap, index: AtlasIndex, id: string): Bitmap {
  const rectangle = index.sprites[id];
  if (!rectangle) throw new Error(`Sunward review is missing atlas sprite ${id}.`);
  return crop(atlas, rectangle);
}

function scaled(source: Bitmap, scale: number): Bitmap {
  const target = createBitmap(source.width * scale, source.height * scale, parseHexColor('#17151b'));
  blitScaled(source, target, 0, 0, scale);
  return target;
}

function writeBitmap(outputRoot: string, name: string, bitmap: Bitmap): string {
  writeFileSync(resolve(outputRoot, name), encodePng(bitmap), { flush: true });
  return name;
}

function materialBoard(atlas: Bitmap, index: AtlasIndex, materialId: string): Bitmap {
  const recipe = MATERIAL_RECIPE_BY_ID[materialId];
  if (!recipe) throw new Error(`Sunward review is missing material recipe ${materialId}.`);
  const width = 12;
  const selections = selectMaterialVariants({
    mapId: `phase-30-${materialId}`,
    width,
    height: 12,
    materialIds: Array.from({ length: 144 }, () => materialId),
    artRevision: ART_PRESENTATION_REVISION,
    recipesById: { [materialId]: recipe },
  });
  const board = createBitmap(width * 32, 12 * 32);
  selections.forEach(({ variantIndex }, offset) => {
    const id = recipe.publicVariantSprites[variantIndex];
    if (!id) throw new Error(`Sunward material ${materialId} has no variant ${variantIndex}.`);
    blit(sprite(atlas, index, id), board, (offset % width) * 32, Math.floor(offset / width) * 32);
  });
  return board;
}

function architectureBoard(atlas: Bitmap, index: AtlasIndex): Bitmap {
  const columns = 8;
  const rows = Math.ceil(ARCHITECTURE_SPRITES.length / columns);
  const board = createBitmap(columns * 40, rows * 40, parseHexColor('#17151b'));
  ARCHITECTURE_SPRITES.forEach((id, offset) => {
    const x = (offset % columns) * 40 + 4;
    const y = Math.floor(offset / columns) * 40 + 4;
    fillRect(board, x, y, 32, 32, parseHexColor(offset % 2 === 0 ? '#e7d7bc' : '#283038'));
    blit(sprite(atlas, index, id), board, x, y);
  });
  return board;
}

export type SunwardReviewReport = Readonly<{
  schemaVersion: 1;
  artRevision: number;
  mapId: 'northwest_residential';
  mapSourceSha256: string;
  sourceGeometryChanged: false;
  materials: Readonly<Record<string, readonly string[]>>;
  architectureSprites: readonly string[];
  files: readonly string[];
}>;

export function writeSunwardReview(outputRoot: string, root = process.cwd()): SunwardReviewReport {
  mkdirSync(outputRoot, { recursive: true });
  const generatedRoot = resolve(root, 'assets/generated');
  const atlas = decodePng(readFileSync(resolve(generatedRoot, 'world-atlas.png')));
  const index = JSON.parse(readFileSync(resolve(generatedRoot, 'atlas-index.json'), 'utf8')) as AtlasIndex;
  const files: string[] = [];
  for (const materialId of MATERIALS) {
    const board = materialBoard(atlas, index, materialId);
    files.push(writeBitmap(outputRoot, `sunward-material-${materialId}-1x.png`, board));
    files.push(writeBitmap(outputRoot, `sunward-material-${materialId}-3x.png`, scaled(board, 3)));
  }
  const architecture = architectureBoard(atlas, index);
  files.push(writeBitmap(outputRoot, 'sunward-architecture-1x.png', architecture));
  files.push(writeBitmap(outputRoot, 'sunward-architecture-3x.png', scaled(architecture, 3)));
  const mapSource = readFileSync(resolve(root, 'content/maps/northwest.json'));
  const report: SunwardReviewReport = Object.freeze({
    schemaVersion: 1,
    artRevision: index.artRevision,
    mapId: 'northwest_residential',
    mapSourceSha256: createHash('sha256').update(mapSource).digest('hex'),
    sourceGeometryChanged: false,
    materials: Object.freeze(Object.fromEntries(MATERIALS.map((id) => [
      id,
      Object.freeze([...(MATERIAL_RECIPE_BY_ID[id]?.publicVariantSprites ?? [])]),
    ]))),
    architectureSprites: Object.freeze([...ARCHITECTURE_SPRITES]),
    files: Object.freeze(files),
  });
  writeFileSync(resolve(outputRoot, 'sunward-review-report.json'), `${JSON.stringify(report, null, 2)}\n`, {
    encoding: 'utf8',
    flush: true,
  });
  return report;
}
