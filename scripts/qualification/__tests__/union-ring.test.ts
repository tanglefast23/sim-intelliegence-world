import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PNG } from 'pngjs';

import { compareRendererFrames } from '../compare-renderer-frames';

/**
 * The readability ring is built from the UNION of the baseline and candidate mask bounds.
 *
 * One ring object is sampled on both images. Built from the baseline bounds alone, a mask that
 * grew in the candidate fills its own ring: the ring stops being floor and becomes sprite, so
 * `candidateContrast` collapses toward 1 and readable coverage falls — for a reason no renderer
 * change caused. Technique 4b grows the protagonist by about 6 logical pixels against a 2-pixel
 * ring, so it would have measured itself as damage.
 *
 * The corpus no-op is proved separately, by running the old and new comparator over identical
 * inputs and requiring identical reports. It does NOT prove this: equal bounds never exercise the
 * union. That is what this file is for.
 */
describe('union-of-bounds readability ring', () => {
  let root = '';
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'si-world-union-')); });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const SIZE = 64;
  const FLOOR = 60;
  const FIGURE = 220;

  /**
   * A bright square figure on a uniform floor, placed by its top-left corner.
   *
   * The placement matters. A first draft of this test grew the figure DOWN AND RIGHT from a fixed
   * corner, and the old ring survived it: half the ring stayed floor, so the median held and the
   * union looked unnecessary. A pivot-anchored scale grows about the CENTRE, which pushes the
   * figure through the ring on every side. Only that geometry shows the difference.
   */
  function frame(name: string, x0: number, y0: number, size: number): { image: string; masks: string } {
    const png = new PNG({ width: SIZE, height: SIZE });
    for (let offset = 0; offset < png.data.length; offset += 4) {
      png.data[offset] = FLOOR; png.data[offset + 1] = FLOOR; png.data[offset + 2] = FLOOR;
      png.data[offset + 3] = 255;
    }
    for (let y = y0; y < y0 + size; y += 1) {
      for (let x = x0; x < x0 + size; x += 1) {
        const offset = (y * SIZE + x) * 4;
        png.data[offset] = FIGURE; png.data[offset + 1] = FIGURE; png.data[offset + 2] = FIGURE;
      }
    }
    const image = join(root, `${name}.png`);
    const masks = join(root, `${name}-masks.json`);
    writeFileSync(image, PNG.sync.write(png));
    writeFileSync(masks, JSON.stringify({
      schemaVersion: 1,
      masks: [{
        id: 'player', kind: 'player', frameId: `sprite:1`,
        logicalBounds: { x: x0, y: y0, width: size, height: size },
        hitBounds: { x: x0 - 4, y: y0 - 2, width: 32, height: 32 },
        alphaFootprint: Array.from({ length: size }, () => '1'.repeat(size)),
      }],
    }));
    return { image, masks };
  }

  const manifest = (baseline: unknown, candidate: unknown, overrides: Record<string, unknown> = {}) => ({
    schemaVersion: 1, fixture: 'union', sourceCommit: 'a'.repeat(40), mode: 'parity',
    viewport: { width: SIZE, height: SIZE }, devicePixelRatio: 1, zoom: 1,
    camera: { x: 0, y: 0 }, toneMapping: 'none', exposure: 1, compositingChanged: false,
    baseline, candidate, requiredMaskIds: ['player'], lightSamples: [], shadowSamples: [],
    thresholds: {
      backgroundRingLogicalPixels: 2, contrastRetention: 0.9,
      outsideMaskChangedPixelRatio: 0.005, outsideMaskMaximumChannelDelta: 2,
      requiredMaskMaximumChannelDelta: 8, scaledMeanAbsoluteChannelDelta: 1,
      scaledRootMeanSquareChannelDelta: 3, scaledLargeChannelDelta: 32,
      scaledLargeChangedPixelRatio: 0.002, scaledOutsideMaskChangedPixelRatio: 0.12,
      scaledMaskMeanAbsoluteChannelDelta: 10, scaledMaskRootMeanSquareChannelDelta: 20,
      scaledMaskLargeChangedPixelRatio: 0.12, scaledReadableCoverageRetention: 0.95,
    },
    ...overrides,
  });

  test('a grown figure on unchanged floor keeps its contrast and its readable pixels', () => {
    // 20 -> 28 logical pixels about the centre: four pixels of growth on every side, against a
    // two-pixel ring. Measured against the old ring this exact case reports contrast 1, retained
    // 0.124 and ZERO readable pixels — a total collapse caused by the ring becoming sprite.
    const report = compareRendererFrames(
      manifest(frame('base', 20, 20, 20), frame('grown', 16, 16, 28), { rasterResampled: true }), 'parity',
    );
    const mask = report.measurements.masks[0]!;

    // The floor never changed, so the figure is exactly as readable against it as before.
    expect(mask.candidateContrast).toBeGreaterThan(1.05);
    expect(mask.candidateContrast).toBeCloseTo(mask.baselineContrast, 6);
    expect(mask.retainedContrast).toBeCloseTo(1, 6);
    expect(mask.candidateReadablePixels).toBeGreaterThanOrEqual(mask.baselineReadablePixels);

    // Mask identity still fails, and that is the signal that the silhouette moved.
    expect(report.failures.join(' ')).toContain('alpha footprint changed');
    // But no contrast or signal failure, which is what the union ring buys.
    expect(report.failures.join(' ')).not.toContain('retained contrast');
    expect(report.failures.join(' ')).not.toContain('carries no readable signal');
  });

  test('a grown figure that genuinely dims IS still caught', () => {
    // The union ring must not become a way to hide damage. Same growth, but the figure is barely
    // above the floor, so its contrast collapses on its own merits.
    const dim = frame('dim', 16, 16, 28);
    const png = PNG.sync.read(readFileSync(dim.image));
    for (let y = 16; y < 44; y += 1) {
      for (let x = 16; x < 44; x += 1) {
        const offset = (y * SIZE + x) * 4;
        png.data[offset] = 62; png.data[offset + 1] = 62; png.data[offset + 2] = 62;
      }
    }
    writeFileSync(dim.image, PNG.sync.write(png));
    const report = compareRendererFrames(
      manifest(frame('base2', 20, 20, 20), dim, { rasterResampled: true }), 'parity',
    );
    expect(report.passed).toBe(false);
    expect(report.failures.join(' ')).toMatch(/retained contrast|readable coverage/u);
  });

  test('equal bounds leave the ring exactly where it was', () => {
    // The no-op, restated as a unit: when nothing moved, the union is the baseline rect.
    const same = frame('same', 20, 20, 20);
    const report = compareRendererFrames(manifest(same, same), 'parity');
    expect(report.passed).toBe(true);
    expect(report.measurements.masks[0]!.retainedContrast).toBe(1);
  });
});
