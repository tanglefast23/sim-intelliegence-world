import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Stage 7 deleted Skia and CanvasKit. These assertions prove they cannot come back by accident:
 * not as a dependency, not as a shipped file, and not as a module import.
 */
describe('Skia and CanvasKit are gone', () => {
  test('no dependency or lockfile entry remains', () => {
    const manifest = readFileSync(resolve(process.cwd(), 'package.json'), 'utf8');
    const lockfile = readFileSync(resolve(process.cwd(), 'package-lock.json'), 'utf8');
    for (const source of [manifest, lockfile]) {
      expect(source).not.toContain('react-native-skia');
      expect(source).not.toContain('canvaskit');
    }
  });

  test('no removed script or proof asset remains', () => {
    const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    for (const script of ['setup:skia-web', 'proof:check', 'proof:assets']) {
      expect(manifest.scripts[script]).toBeUndefined();
    }
    for (const command of Object.values(manifest.scripts)) {
      expect(command).not.toContain('setup-skia-web');
      expect(command).not.toContain('proof:assets');
    }
    expect(existsSync(resolve(process.cwd(), 'public/canvaskit.wasm'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'assets/proof'))).toBe(false);
  });

  test('no source file imports Skia', () => {
    const matches = execSync(
      "git grep -l \"@shopify/react-native-skia\" -- 'src' 'electron' 'scripts' 'App.tsx' || true",
      { cwd: process.cwd(), encoding: 'utf8' },
    ).split('\n').filter(Boolean);
    // Only files that forbid Skia may name it.
    expect(matches.sort()).toEqual([
      'scripts/verification/import-boundaries.ts',
      'src/render/__tests__/skia-absence.test.ts',
    ]);
  });
});
