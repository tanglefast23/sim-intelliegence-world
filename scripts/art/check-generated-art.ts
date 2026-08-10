import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

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

function main(root = process.cwd()): void {
  for (const path of REQUIRED_TRACKED_ARTIFACTS) {
    if (!existsSync(resolve(root, path))) {
      throw new Error(`Required generated art artifact is missing: ${path}`);
    }
  }
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
