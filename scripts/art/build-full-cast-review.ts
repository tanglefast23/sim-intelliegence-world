import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { AtlasIndex, AtlasRect } from './build-world-atlas';
import {
  addOutwardContour,
  composeFrontFrame,
  loadCharacterSources,
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
} from './png';

const DIRECTIONS = ['front-1', 'front-2', 'rear-1', 'rear-2', 'left-1', 'left-2', 'right-1', 'right-2'] as const;

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

function sprite(atlas: Bitmap, index: AtlasIndex, id: string): Bitmap {
  const rectangle = index.sprites[id];
  if (!rectangle) throw new Error(`Full-cast review is missing ${id}.`);
  return crop(atlas, rectangle);
}

function silhouette(source: Bitmap): Bitmap {
  const target = createBitmap(source.width, source.height);
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      if (source.data[(y * source.width + x) * 4 + 3] !== 0) {
        setPixel(target, x, y, parseHexColor('#f4e4a6'));
      }
    }
  }
  return target;
}

function alphaSignature(commands: readonly DrawCommand[]): string {
  return JSON.stringify(commands.map((command) => command.kind === 'rect'
    ? { kind: command.kind, x: command.x, y: command.y, width: command.width, height: command.height }
    : { kind: command.kind, points: command.points }));
}

function layerSignatures(source: CharacterSource): Readonly<Record<string, string>> {
  return {
    legs: alphaSignature([
      ...source.sourceLayers.legs.frontFrames.flat(),
      ...source.sourceLayers.legs.lateralFrames.flat(),
    ]),
    torsoAndClothing: alphaSignature(source.sourceLayers.torsoAndClothing.commands),
    headAndFace: alphaSignature(source.sourceLayers.headAndFace.commands),
    hair: alphaSignature(source.sourceLayers.hair.commands),
    accessory: alphaSignature(source.sourceLayers.accessory.commands),
    heldItem: alphaSignature(source.sourceLayers.heldItem?.commands ?? []),
  };
}

function pairwiseMinimumDifferences(sources: readonly CharacterSource[]): number {
  let minimum = Number.POSITIVE_INFINITY;
  for (let left = 0; left < sources.length; left += 1) {
    for (let right = left + 1; right < sources.length; right += 1) {
      const leftLayers = layerSignatures(sources[left] as CharacterSource);
      const rightLayers = layerSignatures(sources[right] as CharacterSource);
      minimum = Math.min(minimum, Object.keys(leftLayers).filter(
        (layer) => leftLayers[layer] !== rightLayers[layer],
      ).length);
    }
  }
  return minimum;
}

export type FullCastReviewReport = Readonly<{
  schemaVersion: 1;
  artRevision: number;
  characters: readonly string[];
  directions: typeof DIRECTIONS;
  files: readonly string[];
  identityFeatures: Readonly<Record<string, CharacterSource['identityFeatures']>>;
  signatureOddities: Readonly<Record<string, CharacterSource['signatureOddity']>>;
  torsoSilhouetteCount: number;
  pairwiseMinimumNonColorDifferences: number;
  lateralThreeQuarterHeadRequired: false;
}>;

export function writeFullCastReview(outputRoot: string, root = process.cwd()): FullCastReviewReport {
  mkdirSync(outputRoot, { recursive: true });
  const generatedRoot = resolve(root, 'assets/generated');
  const atlas = decodePng(readFileSync(resolve(generatedRoot, 'world-atlas.png')));
  const index = JSON.parse(readFileSync(resolve(generatedRoot, 'atlas-index.json'), 'utf8')) as AtlasIndex;
  const sources = loadCharacterSources(root);
  const rowHeight = 52;
  const board = createBitmap(510, sources.length * rowHeight + 8, parseHexColor('#17151b'));

  sources.forEach((source, row) => {
    const y = 6 + row * rowHeight;
    fillRect(board, 4, y - 3, 502, rowHeight - 2, parseHexColor(row % 2 === 0 ? '#25232b' : '#e2d7bf'));
    DIRECTIONS.forEach((direction, column) => {
      blit(sprite(atlas, index, `character.${source.id}.${direction}`), board, 8 + column * 28, y + 7);
    });
    const front = tokenFrameToBitmap(composeFrontFrame(source, 0), source.palette);
    blit(front, board, 238, y + 7);
    blit(silhouette(front), board, 270, y + 7);
    blit(addOutwardContour(front, parseHexColor(source.palette.K as string), true), board, 302, y + 7);
    blit(sprite(atlas, index, `portrait.${source.id}`), board, 350, y);
    const portraits = index.characters[source.id]?.portraits ?? {};
    blit(sprite(atlas, index, portraits.joy ?? `portrait.${source.id}`), board, 397, y);
    blit(sprite(atlas, index, portraits.upset ?? `portrait.${source.id}`), board, 444, y);
  });

  const files = ['full-cast-identity-1x.png', 'full-cast-identity-3x.png'] as const;
  writeFileSync(resolve(outputRoot, files[0]), encodePng(board), { flush: true });
  const scaled = createBitmap(board.width * 3, board.height * 3, parseHexColor('#17151b'));
  blitScaled(board, scaled, 0, 0, 3);
  writeFileSync(resolve(outputRoot, files[1]), encodePng(scaled), { flush: true });

  const report: FullCastReviewReport = Object.freeze({
    schemaVersion: 1,
    artRevision: index.artRevision,
    characters: Object.freeze(sources.map(({ id }) => id)),
    directions: DIRECTIONS,
    files,
    identityFeatures: Object.freeze(Object.fromEntries(sources.map((source) => [source.id, source.identityFeatures]))),
    signatureOddities: Object.freeze(Object.fromEntries(sources.map((source) => [source.id, source.signatureOddity]))),
    torsoSilhouetteCount: new Set(sources.map((source) => layerSignatures(source).torsoAndClothing)).size,
    pairwiseMinimumNonColorDifferences: pairwiseMinimumDifferences(sources),
    lateralThreeQuarterHeadRequired: false,
  });
  writeFileSync(resolve(outputRoot, 'full-cast-review-report.json'), `${JSON.stringify(report, null, 2)}\n`, {
    encoding: 'utf8',
    flush: true,
  });
  return report;
}
