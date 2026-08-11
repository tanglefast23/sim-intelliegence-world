import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { AtlasIndex, AtlasRect } from './build-world-atlas';
import authorityBaseline from '../../assets/source/art/phase-31-content-authority-baseline.json';
import { buildContentAuthorityReport } from './content-authority';
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

const DISTRICTS = [
  {
    id: 'northeast_downtown',
    source: 'content/maps/northeast.json',
    wall: 'downtown',
    materials: ['plaza-paver', 'boardwalk', 'dark-asphalt', 'warm-sand'],
  },
  {
    id: 'southwest_commercial',
    source: 'content/maps/southwest.json',
    wall: 'commercial',
    materials: ['warm-sand', 'boardwalk', 'pale-concrete', 'villa-floor'],
  },
  {
    id: 'southeast_docks',
    source: 'content/maps/southeast.json',
    wall: 'civic',
    materials: ['pale-concrete', 'boardwalk', 'plaza-paver', 'shallow-water', 'spa-stone'],
  },
] as const;

const OBJECT_SPRITES = [
  'tile.counter-left', 'tile.sign-neon', 'tile.sign-market', 'tile.sign-civic',
  'tile.fixture-lamp', 'tile.fixture-planter',
  'tile.landmark-ferry-left', 'tile.landmark-ferry-right',
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
  if (!rectangle) throw new Error(`Tier B review is missing atlas sprite ${id}.`);
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

function districtMaterialBoard(atlas: Bitmap, index: AtlasIndex, district: typeof DISTRICTS[number]): Bitmap {
  const sampleSize = 4;
  const rowHeight = sampleSize * 32 + 8;
  const board = createBitmap(sampleSize * 32, district.materials.length * rowHeight - 8, parseHexColor('#17151b'));
  district.materials.forEach((materialId, row) => {
    const recipe = MATERIAL_RECIPE_BY_ID[materialId];
    if (!recipe) throw new Error(`Tier B review is missing material recipe ${materialId}.`);
    const variants = recipe.mapVariantSprites[district.id] ?? recipe.publicVariantSprites;
    const selections = selectMaterialVariants({
      mapId: district.id,
      width: sampleSize,
      height: sampleSize,
      materialIds: Array.from({ length: sampleSize * sampleSize }, () => materialId),
      artRevision: ART_PRESENTATION_REVISION,
      recipesById: { [materialId]: recipe },
    });
    selections.forEach(({ variantIndex }, offset) => {
      const id = variants[variantIndex];
      if (!id) throw new Error(`${district.id}/${materialId} has no variant ${variantIndex}.`);
      blit(
        sprite(atlas, index, id),
        board,
        (offset % sampleSize) * 32,
        row * rowHeight + Math.floor(offset / sampleSize) * 32,
      );
    });
  });
  return board;
}

function wallBoard(atlas: Bitmap, index: AtlasIndex): Bitmap {
  const board = createBitmap(16 * 36, DISTRICTS.length * 36, parseHexColor('#17151b'));
  DISTRICTS.forEach(({ wall }, row) => {
    for (let mask = 0; mask < 16; mask += 1) {
      const x = mask * 36 + 2;
      const y = row * 36 + 2;
      fillRect(board, x, y, 32, 32, parseHexColor((mask + row) % 2 === 0 ? '#e1d3bd' : '#293037'));
      blit(sprite(atlas, index, `tile.wall-${wall}-${mask.toString(16)}`), board, x, y);
    }
  });
  return board;
}

function objectBoard(atlas: Bitmap, index: AtlasIndex): Bitmap {
  const columns = 4;
  const board = createBitmap(columns * 40, 2 * 40, parseHexColor('#17151b'));
  OBJECT_SPRITES.forEach((id, offset) => {
    const x = (offset % columns) * 40 + 4;
    const y = Math.floor(offset / columns) * 40 + 4;
    fillRect(board, x, y, 32, 32, parseHexColor(offset % 2 === 0 ? '#ddd0b9' : '#293037'));
    blit(sprite(atlas, index, id), board, x, y);
  });
  return board;
}

export type TierBReviewReport = Readonly<{
  schemaVersion: 1;
  artRevision: number;
  districts: readonly Readonly<{
    mapId: string;
    sourceSha256: string;
    layoutRevision: number;
    wallFamily: string;
    materials: readonly string[];
    roofReview: Readonly<{ status: 'not-applicable'; reason: string; roofGroupCount: 0 }>;
  }>[];
  objectSprites: readonly string[];
  files: readonly string[];
}>;

export function writeTierBReview(outputRoot: string, root = process.cwd()): TierBReviewReport {
  mkdirSync(outputRoot, { recursive: true });
  const generatedRoot = resolve(root, 'assets/generated');
  const atlas = decodePng(readFileSync(resolve(generatedRoot, 'world-atlas.png')));
  const index = JSON.parse(readFileSync(resolve(generatedRoot, 'atlas-index.json'), 'utf8')) as AtlasIndex;
  const files: string[] = [];
  for (const district of DISTRICTS) {
    const board = districtMaterialBoard(atlas, index, district);
    files.push(writeBitmap(outputRoot, `tier-b-${district.id}-materials-1x.png`, board));
    files.push(writeBitmap(outputRoot, `tier-b-${district.id}-materials-3x.png`, scaled(board, 3)));
  }
  const walls = wallBoard(atlas, index);
  files.push(writeBitmap(outputRoot, 'tier-b-walls-1x.png', walls));
  files.push(writeBitmap(outputRoot, 'tier-b-walls-3x.png', scaled(walls, 3)));
  const objects = objectBoard(atlas, index);
  files.push(writeBitmap(outputRoot, 'tier-b-objects-landmark-1x.png', objects));
  files.push(writeBitmap(outputRoot, 'tier-b-objects-landmark-3x.png', scaled(objects, 3)));

  const report: TierBReviewReport = Object.freeze({
    schemaVersion: 1,
    artRevision: index.artRevision,
    districts: Object.freeze(DISTRICTS.map((district) => {
      const source = readFileSync(resolve(root, district.source));
      const parsed = JSON.parse(source.toString('utf8')) as { layoutRevision: number; roofGroups: unknown[] };
      if (parsed.roofGroups.length !== 0) throw new Error(`${district.id} unexpectedly gained a roof group.`);
      return Object.freeze({
        mapId: district.id,
        sourceSha256: createHash('sha256').update(source).digest('hex'),
        layoutRevision: parsed.layoutRevision,
        wallFamily: district.wall,
        materials: Object.freeze([...district.materials]),
        roofReview: Object.freeze({
          status: 'not-applicable' as const,
          reason: 'The authoritative compiled Tier B map has zero roof groups; no roof geometry was added for art proof.',
          roofGroupCount: 0 as const,
        }),
      });
    })),
    objectSprites: Object.freeze([...OBJECT_SPRITES]),
    files: Object.freeze(files),
  });
  writeFileSync(resolve(outputRoot, 'tier-b-review-report.json'), `${JSON.stringify(report, null, 2)}\n`, {
    encoding: 'utf8',
    flush: true,
  });
  const authority = buildContentAuthorityReport(root);
  if (JSON.stringify(authority) !== JSON.stringify(authorityBaseline)) {
    throw new Error('Tier B content authority changed from the locked Phase 30 baseline.');
  }
  writeFileSync(resolve(outputRoot, 'tier-b-content-authority-report.json'), `${JSON.stringify({
    ...authority,
    baselineMatch: true,
    changedAuthorityFields: [],
    presentationOnlyChange: true,
  }, null, 2)}\n`, { encoding: 'utf8', flush: true });
  return report;
}
