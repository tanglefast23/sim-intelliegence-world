import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { PNG } from 'pngjs';

import { compareRendererFrames } from '../compare-renderer-frames';

/**
 * `rasterResampled` reclassifies a fixture to the readability-only family.
 *
 * Every polish item repaints pixels on purpose, so none of them can pass an RGB-delta family
 * against any baseline. The alternative to this flag is softening a threshold, which weakens the
 * gate for every future change instead of for the one that needs it.
 *
 * These tests pin which checks the flag switches off and which it leaves on. A selector that
 * silently covered one family of four was the defect two independent reviews found in the plan
 * for this work, so each line is asserted rather than described.
 */
describe('rasterResampled', () => {
  let root = '';
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'si-world-selector-')); });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const SIZE = 32;

  /** A frame with a readable 4x4 mask on a mid-grey floor. */
  function frame(shift: number, footprint: readonly string[]): { image: string; masks: string } {
    const png = new PNG({ width: SIZE, height: SIZE });
    for (let offset = 0; offset < png.data.length; offset += 4) {
      png.data[offset] = 60 + shift;
      png.data[offset + 1] = 60 + shift;
      png.data[offset + 2] = 60 + shift;
      png.data[offset + 3] = 255;
    }
    // The mask shifts with the floor, so a repaint changes every pixel while the mask's contrast
    // AGAINST its ring is preserved. That is the shape of a deliberate re-raster: the lattice
    // moves, readability does not. Shifting only the floor would be a readability regression, and
    // the selector is not meant to hide one — a first draft of this fixture did exactly that and
    // the contrast-retention floor caught it at 0.536. The shift is small because contrast is a
    // luminance RATIO: an additive shift does not preserve it, and +20 still landed at 0.879.
    // +3 exceeds the outside-mask delta of 2 on every pixel while leaving the ratio intact.
    for (let y = 8; y < 12; y += 1) {
      for (let x = 8; x < 12; x += 1) {
        const offset = (y * SIZE + x) * 4;
        png.data[offset] = 220 + shift;
        png.data[offset + 1] = 220 + shift;
        png.data[offset + 2] = 220 + shift;
      }
    }
    const image = join(root, `image-${shift}-${footprint.join('')}.png`);
    const masks = join(root, `masks-${footprint.join('')}.json`);
    writeFileSync(image, PNG.sync.write(png));
    writeFileSync(masks, JSON.stringify({
      schemaVersion: 1,
      masks: [{
        id: 'player', kind: 'player', frameId: 'sprite:1',
        logicalBounds: { x: 8, y: 8, width: 4, height: 4 },
        hitBounds: { x: 4, y: 6, width: 32, height: 32 },
        alphaFootprint: footprint,
      }],
    }));
    return { image, masks };
  }

  const FULL = ['1111', '1111', '1111', '1111'];

  function manifest(overrides: Record<string, unknown>): Record<string, unknown> {
    mkdirSync(root, { recursive: true });
    return {
      schemaVersion: 1, fixture: 'selector', sourceCommit: 'a'.repeat(40), mode: 'parity',
      viewport: { width: SIZE, height: SIZE }, devicePixelRatio: 1, zoom: 1,
      camera: { x: 0, y: 0 }, toneMapping: 'none', exposure: 1,
      compositingChanged: false,
      requiredMaskIds: ['player'], lightSamples: [], shadowSamples: [],
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
    };
  }

  test('defaults to false, so every existing fixture keeps its current gates', () => {
    // The manifest object is strict, so the field must arrive with a default or every committed
    // fixture — including the comparator's own zoom-sampling self-test — fails to parse.
    const baseline = frame(0, FULL);
    const report = compareRendererFrames(manifest({ baseline, candidate: baseline }), 'parity');
    expect(report.passed).toBe(true);
  });

  test('off: a whole-frame repaint fails the RGB-delta families', () => {
    const baseline = frame(0, FULL);
    const candidate = frame(3, FULL);
    const report = compareRendererFrames(manifest({ baseline, candidate }), 'parity');
    expect(report.passed).toBe(false);
    // Native raster with compositingChanged false, so the per-pixel families are the live ones.
    expect(report.failures.join(' ')).toMatch(/Outside-mask changed-pixel ratio|channel delta/u);
  });

  test('on: the same repaint passes, because readability survived it', () => {
    const baseline = frame(0, FULL);
    const candidate = frame(3, FULL);
    const report = compareRendererFrames(
      manifest({ baseline, candidate, rasterResampled: true }), 'parity',
    );
    expect(report.failures).toEqual([]);
    expect(report.passed).toBe(true);
  });

  test('on: mask identity still fails when the silhouette moves', () => {
    // This is the check that decides whether a sprite moved. It must survive the selector, or the
    // flag would hide exactly what technique 4b exists to be measured on.
    const baseline = frame(0, FULL);
    const candidate = frame(0, ['1111', '1101', '1111', '1111']);
    const report = compareRendererFrames(
      manifest({ baseline, candidate, rasterResampled: true }), 'parity',
    );
    expect(report.passed).toBe(false);
    expect(report.failures.join(' ')).toContain('alpha footprint changed');
  });

  test('on: a light sample still fails when the lit region goes dark', () => {
    const baseline = frame(0, FULL);
    const candidate = frame(0, FULL);
    // Black out the "lit" rectangle in the candidate only.
    const png = PNG.sync.read(readFileSync(candidate.image));
    for (let y = 8; y < 12; y += 1) {
      for (let x = 8; x < 12; x += 1) {
        const offset = (y * SIZE + x) * 4;
        png.data[offset] = 0; png.data[offset + 1] = 0; png.data[offset + 2] = 0;
      }
    }
    const darkened = join(root, 'darkened.png');
    writeFileSync(darkened, PNG.sync.write(png));
    const report = compareRendererFrames(manifest({
      baseline,
      candidate: { ...candidate, image: darkened },
      rasterResampled: true,
      lightSamples: [{
        id: 'lamp',
        lit: { x: 8, y: 8, width: 4, height: 4 },
        unlit: { x: 20, y: 20, width: 4, height: 4 },
      }],
    }), 'parity');
    expect(report.passed).toBe(false);
    expect(report.failures.join(' ')).toContain('lamp center is not brighter');
  });

  test('on: readable coverage falls back to the retention floor rather than exact identity', () => {
    // At native raster the coverage check is exact set identity, which any deliberate re-raster
    // breaks. Under the selector it becomes the 0.95 retention floor, so a frame that keeps its
    // readable pixels passes and one that loses them does not.
    const baseline = frame(0, FULL);
    const candidate = frame(2, FULL);
    const kept = compareRendererFrames(
      manifest({ baseline, candidate, rasterResampled: true }), 'parity',
    );
    expect(kept.passed).toBe(true);

    // Now flatten the mask into its ring: readability is gone, and the selector must not hide it.
    const png = PNG.sync.read(readFileSync(baseline.image));
    for (let y = 8; y < 12; y += 1) {
      for (let x = 8; x < 12; x += 1) {
        const offset = (y * SIZE + x) * 4;
        png.data[offset] = 60; png.data[offset + 1] = 60; png.data[offset + 2] = 60;
      }
    }
    const flattened = join(root, 'flattened.png');
    writeFileSync(flattened, PNG.sync.write(png));
    const lost = compareRendererFrames(manifest({
      baseline, candidate: { ...candidate, image: flattened }, rasterResampled: true,
    }), 'parity');
    expect(lost.passed).toBe(false);
  });
});
