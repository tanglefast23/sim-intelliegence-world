import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { PNG } from 'pngjs';

import { compareRendererFrames } from '../compare-renderer-frames';

/**
 * Visual polish: the capture path must not be vacuous.
 *
 * The comparator reads committed PNGs, so a refresh step that silently does nothing would leave it
 * re-verifying frozen evidence and passing whatever the renderer does. These tests prove the
 * refresh actually replaces a candidate, and that a deliberately damaged candidate fails.
 */
describe('candidate capture refresh', () => {
  let root = '';
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'si-world-capture-')); });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  test('refuses to report success when it refreshed nothing', () => {
    const reportPath = join(root, 'renderer-capture-report.json');
    writeFileSync(reportPath, JSON.stringify({ passes: { threejs2d: { fixtures: [] } } }));
    expect(() => execFileSync('npx', ['tsx', 'scripts/qualification/refresh-candidate-captures.ts', '--report', reportPath], {
      cwd: process.cwd(), encoding: 'utf8', stdio: 'pipe',
    })).toThrow(/refreshed|stale/iu);
  });

  test('a damaged candidate fails the comparison it is fed into', () => {
    const manifestPath = resolve('tests/fixtures/rendering/threejs-all-maps/northwest-1280x720-dpr1-zoom1-v1.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      candidate: { image: string; masks: string };
      baseline: { image: string; masks: string };
    };
    // Copy the real fixture, then damage only the candidate image.
    const damagedPath = join(root, 'damaged.png');
    const png = PNG.sync.read(readFileSync(resolve(manifest.candidate.image)));
    for (let pixel = 0; pixel < png.width * png.height; pixel += 1) {
      const offset = pixel * 4;
      png.data[offset] = 255 - png.data[offset]!;
    }
    mkdirSync(dirname(damagedPath), { recursive: true });
    writeFileSync(damagedPath, PNG.sync.write(png));
    const damaged = { ...manifest, candidate: { ...manifest.candidate, image: damagedPath } };
    const report = compareRendererFrames(damaged, 'parity');
    expect(report.passed).toBe(false);
  });

  test('the untouched fixture still passes, so the damage test means something', () => {
    const manifestPath = resolve('tests/fixtures/rendering/threejs-all-maps/northwest-1280x720-dpr1-zoom1-v1.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown;
    expect(compareRendererFrames(manifest, 'parity').passed).toBe(true);
  });
});
