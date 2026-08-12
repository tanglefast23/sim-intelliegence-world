import {
  WORLD_CELL,
  addOutwardContour,
  composeFrontFrame,
  drawTokenCommands,
  emptyTokenFrame,
  getCharacterGeometryCommandSets,
  getCharacterIdentityCommandSets,
  tokenFrameToBitmap,
  type CharacterSource,
  type DrawCommand,
  type TokenFrame,
} from './character-source';
import { CHARACTER_LOOKS, type CharacterLook } from './character-look-roster';
import { composeLateralFrame } from './lateral-legs';
import { protagonistReferenceFrames } from './protagonist-reference';
import { deriveRearFrame } from './rear-frame';

export const PROTAGONIST_STYLE_PASS_SCORE = 9.7;

export type CharacterStyleScore = Readonly<{
  characterId: string;
  displayName: string;
  score: number;
  passed: boolean;
  identityRetained: boolean;
  categories: Readonly<{
    faceProportions: number;
    eyeProportions: number;
    worldBody: number;
    directionalSilhouette: number;
    portraitProportions: number;
    floatingBase: number;
    stablePose: number;
  }>;
  directionSimilarity: Readonly<Record<'front' | 'rear' | 'left' | 'right', number>>;
}>;

const STYLE_WEIGHTS = Object.freeze({
  faceProportions: 2,
  eyeProportions: 2,
  worldBody: 2,
  directionalSilhouette: 1.5,
  portraitProportions: 1,
  floatingBase: 1,
  stablePose: 0.5,
});

const EXPECTED_FACE_BOUNDS = Object.freeze({ left: 4, right: 19, top: 4, bottom: 17 });
const EXPECTED_EYES = Object.freeze([
  [7, 13, 'W'], [8, 13, 'K'], [9, 13, 'W'], [10, 13, 'D'],
  [13, 13, 'W'], [14, 13, 'K'], [15, 13, 'W'], [16, 13, 'D'],
  [7, 14, 'W'], [8, 14, 'K'], [9, 14, 'W'], [10, 14, 'D'],
  [13, 14, 'W'], [14, 14, 'K'], [15, 14, 'W'], [16, 14, 'D'],
] as const);

function lookFor(source: CharacterSource): CharacterLook {
  const look = CHARACTER_LOOKS.find(({ id }) => id === source.id);
  if (!look) throw new Error(`Missing character look for ${source.id}.`);
  return look;
}

function commandFrame(commands: readonly DrawCommand[], width: number, height: number): TokenFrame {
  const frame = emptyTokenFrame(width, height);
  drawTokenCommands(frame, commands);
  return frame;
}

function boundsForTokens(frame: TokenFrame, tokens: ReadonlySet<string>): Readonly<{
  left: number;
  right: number;
  top: number;
  bottom: number;
}> | undefined {
  const points = frame.flatMap((row, y) => [...row].flatMap(
    (token, x) => tokens.has(token) ? [[x, y] as const] : [],
  ));
  if (points.length === 0) return undefined;
  return {
    left: Math.min(...points.map(([x]) => x)),
    right: Math.max(...points.map(([x]) => x)),
    top: Math.min(...points.map(([, y]) => y)),
    bottom: Math.max(...points.map(([, y]) => y)),
  };
}

function alphaRows(frame: TokenFrame, source: CharacterSource): number[] {
  const bitmap = addOutwardContour(
    tokenFrameToBitmap(frame, source.palette),
    [33, 28, 39, 255],
    true,
  );
  return Array.from({ length: WORLD_CELL.height }, (_unused, y) => {
    const columns = Array.from({ length: WORLD_CELL.width }, (_entry, x) => x).filter(
      (x) => bitmap.data[(y * WORLD_CELL.width + x) * 4 + 3] !== 0,
    );
    return columns.length === 0 ? 0 : Math.max(...columns) - Math.min(...columns) + 1;
  });
}

function tokenRows(frame: TokenFrame): number[] {
  return frame.map((row) => {
    const columns = [...row].flatMap((token, x) => token === '.' ? [] : [x]);
    return columns.length === 0 ? 0 : Math.max(...columns) - Math.min(...columns) + 1;
  });
}

function rowSimilarity(actual: readonly number[], expected: readonly number[]): number {
  const expectedMass = expected.reduce((sum, width) => sum + width, 0);
  const distance = expected.reduce(
    (sum, width, index) => sum + Math.abs(width - (actual[index] ?? 0)),
    0,
  );
  return expectedMass === 0 ? 1 : Math.max(0, 1 - distance / expectedMass);
}

function occupancySignature(commands: readonly DrawCommand[], width: number, height: number): string {
  return commandFrame(commands, width, height)
    .map((row) => [...row].map((token) => token === '.' ? '.' : '#').join(''))
    .join('\n');
}

function styleOnlySource(source: CharacterSource): CharacterSource {
  const geometry = getCharacterGeometryCommandSets(lookFor(source));
  return {
    ...source,
    sourceLayers: {
      ...source.sourceLayers,
      legs: geometry.legs,
      torsoAndClothing: { commands: [...geometry.worldBody] },
      hair: { commands: [] },
      accessory: { commands: [] },
      heldItem: { commands: [] },
    },
  };
}

function styleFrames(source: CharacterSource): Readonly<Record<'front' | 'rear' | 'left' | 'right', TokenFrame>> {
  const base = styleOnlySource(source);
  const front = composeFrontFrame(base, 0);
  return {
    front,
    rear: deriveRearFrame(front, base),
    left: composeLateralFrame(base, 'left', 0),
    right: composeLateralFrame(base, 'right', 0),
  };
}

function exactRatio(actual: unknown, expected: unknown): number {
  return JSON.stringify(actual) === JSON.stringify(expected) ? 1 : 0;
}

export function scoreCharacterAgainstProtagonist(source: CharacterSource): CharacterStyleScore {
  const look = lookFor(source);
  const headFrame = commandFrame(source.sourceLayers.headAndFace.commands, WORLD_CELL.width, WORLD_CELL.height);
  const faceBounds = boundsForTokens(headFrame, new Set(['S', 's', 'L']));
  const faceRatio = exactRatio(faceBounds, EXPECTED_FACE_BOUNDS);
  const eyeMatches = EXPECTED_EYES.filter(([x, y, token]) => headFrame[y]?.[x] === token).length;
  const eyeRatio = eyeMatches / EXPECTED_EYES.length;

  const reference = protagonistReferenceFrames('protagonist');
  if (!reference) throw new Error('Missing protagonist reference frames.');
  const frames = source.id === 'protagonist'
    ? {
      front: reference['front-1'],
      rear: reference['rear-1'],
      left: reference['left-1'],
      right: reference['right-1'],
    }
    : styleFrames(source);
  const renderedRows = Object.fromEntries(Object.entries(frames).map(([direction, frame]) => [
    direction,
    source.id === 'protagonist' ? tokenRows(frame) : alphaRows(frame, source),
  ])) as Readonly<Record<'front' | 'rear' | 'left' | 'right', number[]>>;
  const directionSimilarity = {
    front: rowSimilarity(renderedRows.front.slice(18), tokenRows(reference['front-1']).slice(18)),
    rear: rowSimilarity(renderedRows.rear.slice(18), tokenRows(reference['rear-1']).slice(18)),
    left: rowSimilarity(renderedRows.left.slice(18), tokenRows(reference['left-1']).slice(18)),
    right: rowSimilarity(renderedRows.right.slice(18), tokenRows(reference['right-1']).slice(18)),
  };
  const averageDirectionSimilarity = Object.values(directionSimilarity).reduce(
    (sum, similarity) => sum + similarity,
    0,
  ) / 4;

  const frontWidths = renderedRows.front;
  const frontReferenceWidths = tokenRows(reference['front-1']);
  const frontSilhouetteRatio = rowSimilarity(frontWidths.slice(18), frontReferenceWidths.slice(18));
  const frontBaseMatches = exactRatio(frontWidths.slice(27), frontReferenceWidths.slice(27));
  const worldBodyRatio = frontSilhouetteRatio * 0.75 + frontBaseMatches * 0.25;

  const protagonistLook = CHARACTER_LOOKS.find(({ id }) => id === 'protagonist');
  if (!protagonistLook) throw new Error('Missing protagonist look.');
  const portraitRatio = exactRatio(
    occupancySignature(getCharacterGeometryCommandSets(look).portraitBody, 24, 29),
    occupancySignature(getCharacterGeometryCommandSets(protagonistLook).portraitBody, 24, 29),
  );

  const floatingRatio = (
    frontWidths[0] === 0 &&
    frontWidths.at(-1) === 10 &&
    frontWidths[27] === 14 &&
    frontWidths[28] === 12 &&
    frames.front.every((row) => row[0] === '.' && row.at(-1) === '.')
  ) ? 1 : 0;
  const base = styleOnlySource(source);
  const stableRatio = (
    composeFrontFrame(base, 0).join('\n') === composeFrontFrame(base, 1).join('\n') &&
    JSON.stringify(base.sourceLayers.legs.frontFrames[0]) === JSON.stringify(base.sourceLayers.legs.frontFrames[1]) &&
    JSON.stringify(base.sourceLayers.legs.lateralFrames[0]) === JSON.stringify(base.sourceLayers.legs.lateralFrames[1])
  ) ? 1 : 0;
  const identity = getCharacterIdentityCommandSets(look);
  const identityRetained = source.identityFeatures.length >= 2 &&
    identity.primaryWorld.length > 0 && identity.secondaryWorld.length > 0;

  const categories = {
    faceProportions: faceRatio * STYLE_WEIGHTS.faceProportions,
    eyeProportions: eyeRatio * STYLE_WEIGHTS.eyeProportions,
    worldBody: worldBodyRatio * STYLE_WEIGHTS.worldBody,
    directionalSilhouette: averageDirectionSimilarity * STYLE_WEIGHTS.directionalSilhouette,
    portraitProportions: portraitRatio * STYLE_WEIGHTS.portraitProportions,
    floatingBase: floatingRatio * STYLE_WEIGHTS.floatingBase,
    stablePose: stableRatio * STYLE_WEIGHTS.stablePose,
  };
  const rawScore = Object.values(categories).reduce((sum, value) => sum + value, 0);
  const score = Math.round(rawScore * 100) / 100;

  return {
    characterId: source.id,
    displayName: source.displayName,
    score,
    passed: score >= PROTAGONIST_STYLE_PASS_SCORE && identityRetained,
    identityRetained,
    categories: Object.fromEntries(Object.entries(categories).map(
      ([category, value]) => [category, Math.round(value * 1000) / 1000],
    )) as CharacterStyleScore['categories'],
    directionSimilarity: Object.fromEntries(Object.entries(directionSimilarity).map(
      ([direction, value]) => [direction, Math.round(value * 1000) / 1000],
    )) as CharacterStyleScore['directionSimilarity'],
  };
}
