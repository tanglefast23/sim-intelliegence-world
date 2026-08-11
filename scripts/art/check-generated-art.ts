import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { decodePng } from './png';

const REQUIRED_TRACKED_ARTIFACTS = [
  'assets/generated/atlas-index.json',
  'assets/generated/world-atlas.png',
  'artifacts/phase-04/atlas-review.png',
  'artifacts/phase-19/atlas-preview.png',
] as const;

const DIFF_TARGETS = [
  'assets/source/characters',
  'assets/generated',
  'artifacts/phase-04/atlas-review.png',
  'artifacts/phase-19/atlas-preview.png',
] as const;

type AtlasRect = Readonly<{ x: number; y: number; width: number; height: number }>;
type AtlasIndex = Readonly<{
  sprites: Readonly<Record<string, AtlasRect>>;
  characters: Readonly<Record<string, Readonly<{ frames: Readonly<Record<string, string>> }>>>;
}>;

function assertReadableFeet(root: string): void {
  const index = JSON.parse(readFileSync(resolve(root, 'assets/generated/atlas-index.json'), 'utf8')) as AtlasIndex;
  const atlas = decodePng(readFileSync(resolve(root, 'assets/generated/world-atlas.png')));
  for (const [characterId, character] of Object.entries(index.characters)) {
    for (const direction of ['front', 'rear', 'left', 'right'] as const) {
      const first = index.sprites[character.frames[`${direction}-1`] as string];
      const second = index.sprites[character.frames[`${direction}-2`] as string];
      if (!first || !second || first.width !== 24 || first.height !== 30 || second.width !== 24 || second.height !== 30) {
        throw new Error(`${characterId} ${direction} must have two 24x30 atlas cells.`);
      }
      let changedLowerPixels = 0;
      let changedShoePixels = 0;
      for (let y = 21; y < 30; y += 1) {
        for (let x = 0; x < 24; x += 1) {
          const firstOffset = ((first.y + y) * atlas.width + first.x + x) * 4;
          const secondOffset = ((second.y + y) * atlas.width + second.x + x) * 4;
          const differs = [0, 1, 2, 3].some((channel) => atlas.data[firstOffset + channel] !== atlas.data[secondOffset + channel]);
          if (differs) {
            changedLowerPixels += 1;
            if (y >= 27) changedShoePixels += 1;
          }
        }
      }
      if (changedLowerPixels === 0 || changedShoePixels === 0) {
        throw new Error(`${characterId} ${direction} walking cells do not show a readable lower-leg and shoe change.`);
      }
    }
  }
}

function main(root = process.cwd()): void {
  for (const path of REQUIRED_TRACKED_ARTIFACTS) {
    if (!existsSync(resolve(root, path))) {
      throw new Error(`Required generated art artifact is missing: ${path}`);
    }
  }
  assertReadableFeet(root);
  execFileSync('git', ['ls-files', '--error-unmatch', ...REQUIRED_TRACKED_ARTIFACTS], {
    cwd: root,
    stdio: 'ignore',
  });
  execFileSync('git', ['diff', '--exit-code', '--', ...DIFF_TARGETS], {
    cwd: root,
    stdio: 'inherit',
  });
  process.stdout.write('Generated art artifacts exist, are tracked, and match their deterministic builders.\n');
}

try {
  main();
} catch (error: unknown) {
  process.stderr.write(`Generated art check failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
