import {
  PORTRAIT_CELL,
  WORLD_CELL,
  composeFrontFrame,
  composePortrait,
  drawTokenCommands,
  emptyTokenFrame,
  loadCharacterSources,
  type CharacterSource,
  type DrawCommand,
  type TokenFrame,
} from '../character-source';
import { composeLateralFrame } from '../lateral-legs';
import { parseHexColor } from '../png';
import { deriveRearFrame } from '../rear-frame';

const EXPECTED_IDS = [
  'devon-price', 'elise-moreau', 'generic-resident', 'linda', 'mina-park',
  'priya-nair', 'protagonist', 'rafael-cruz', 'sora-tan', 'tomas-reed',
] as const;

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

function painted(frame: TokenFrame): Set<string> {
  return new Set(frame.flatMap((row, y) => [...row].flatMap((token, x) => token === '.' ? [] : [`${x},${y}`])));
}

function layerFrame(commands: readonly DrawCommand[]): TokenFrame {
  const frame = emptyTokenFrame(WORLD_CELL.width, WORLD_CELL.height);
  drawTokenCommands(frame, commands);
  return frame;
}

function luminance(hex: string): number {
  const [red, green, blue] = parseHexColor(hex);
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function commandTokens(commands: readonly DrawCommand[]): Set<string> {
  return new Set(commands.map(({ token }) => token));
}

describe('Phase 29 full-cast character art', () => {
  const sources = loadCharacterSources();

  test('keeps exactly ten authoritative character sources', () => {
    expect(sources.map(({ id }) => id)).toEqual(EXPECTED_IDS);
  });

  test('gives every pair two non-color layer differences and three torso silhouettes', () => {
    for (let left = 0; left < sources.length; left += 1) {
      for (let right = left + 1; right < sources.length; right += 1) {
        const leftSignatures = layerSignatures(sources[left] as CharacterSource);
        const rightSignatures = layerSignatures(sources[right] as CharacterSource);
        const differences = Object.keys(leftSignatures).filter(
          (layer) => leftSignatures[layer] !== rightSignatures[layer],
        );
        expect(differences.length).toBeGreaterThanOrEqual(2);
      }
    }
    expect(new Set(sources.map((source) => layerSignatures(source).torsoAndClothing)).size).toBeGreaterThanOrEqual(3);
  });

  test.each(sources.map((source) => [source.id, source] as const))(
    '%s documents identity features that survive every direction',
    (_id, source) => {
      expect(source.identityFeatures.length).toBeGreaterThanOrEqual(2);
      const feature = source.identityFeatures.find(({ visibleIn }) => (
        ['front', 'rear', 'left', 'right'] as const
      ).every((direction) => visibleIn.includes(direction)));
      expect(feature).toBeDefined();
      const commands = feature ? source.sourceLayers[feature.layer]?.commands ?? [] : [];
      const featurePixels = painted(layerFrame(commands));
      expect(featurePixels.size).toBeGreaterThan(0);
      const front = composeFrontFrame(source, 0);
      const frames = [
        front,
        deriveRearFrame(front, source),
        composeLateralFrame(source, 'left', 0),
        composeLateralFrame(source, 'right', 0),
      ];
      for (const frame of frames) {
        const composedPixels = painted(frame);
        expect([...featurePixels].some((pixel) => composedPixels.has(pixel))).toBe(true);
      }
    },
  );

  test.each(sources.map((source) => [source.id, source] as const))(
    '%s keeps world and portrait identity layers in agreement',
    (_id, source) => {
      const front = composeFrontFrame(source, 0).join('');
      const portrait = composePortrait(source).join('');
      for (const token of Object.values(source.identityTokens)) {
        expect(front).toContain(token);
        expect(portrait).toContain(token);
      }
      for (const feature of source.identityFeatures.filter(({ visibleIn }) => visibleIn.includes('front'))) {
        const worldCommands = source.sourceLayers[feature.layer]?.commands ?? [];
        const portraitCommands = source.portraitLayers[feature.layer]?.commands ?? [];
        expect(worldCommands.length).toBeGreaterThan(0);
        expect(portraitCommands.length).toBeGreaterThan(0);
        const worldTokens = commandTokens(worldCommands);
        const portraitTokens = commandTokens(portraitCommands);
        expect([...worldTokens].some((token) => portraitTokens.has(token))).toBe(true);
      }
    },
  );

  test.each(sources.map((source) => [source.id, source] as const))(
    '%s keeps stride, margins, portrait contour room, and hair value separation',
    (_id, source) => {
      const frontOne = composeFrontFrame(source, 0);
      const frontTwo = composeFrontFrame(source, 1);
      expect(frontOne).not.toEqual(frontTwo);
      for (const frame of [
        frontOne,
        frontTwo,
        deriveRearFrame(frontOne, source),
        deriveRearFrame(frontTwo, source),
        composeLateralFrame(source, 'left', 0),
        composeLateralFrame(source, 'left', 1),
        composeLateralFrame(source, 'right', 0),
        composeLateralFrame(source, 'right', 1),
      ]) {
        expect(painted(frame).size).toBeGreaterThan(40);
        expect([...frame[0] as string].every((token) => token === '.')).toBe(true);
        expect([...frame[WORLD_CELL.height - 1] as string].every((token) => token === '.')).toBe(true);
        expect(frame.every((row) => row[0] === '.' && row[WORLD_CELL.width - 1] === '.')).toBe(true);
      }
      const portrait = composePortrait(source);
      expect(painted(portrait).size).toBeGreaterThan(200);
      expect([...portrait[0] as string].every((token) => token === '.')).toBe(true);
      expect(portrait.every((row) => row[0] === '.' && row[PORTRAIT_CELL.width - 1] === '.')).toBe(true);
      const hair = source.palette[source.identityTokens.hair] as string;
      const skin = source.palette[source.identityTokens.skin] as string;
      expect(Math.abs(luminance(hair) - luminance(skin))).toBeGreaterThanOrEqual(24);
    },
  );
});
