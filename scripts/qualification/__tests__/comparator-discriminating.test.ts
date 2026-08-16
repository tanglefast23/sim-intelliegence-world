import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { PNG } from 'pngjs';

import { compareRendererFrames } from '../compare-renderer-frames';

/**
 * Tests that discriminate, rather than tests that merely pass.
 *
 * Two findings from the concurrent session's Grok audit were deferred to this phase, both of the
 * same shape: a check exists, but nothing proves it can fail, so deleting it would leave the suite
 * green. That is the defect this whole program is about, one level up — a gate nobody has verified
 * is only a claim about a gate.
 *
 * The first pins what the readable predicate actually measures, which is not what its name
 * suggests. The second fails if any of the scaled RGB branches is removed.
 */
describe('comparator checks that can fail', () => {
  let root = '';
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'si-world-discriminating-')); });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const SIZE = 32;
  const FULL = ['1111', '1111', '1111', '1111'];

  type Paint = (png: PNG) => void;

  function frame(name: string, paint: Paint): { image: string; masks: string } {
    const png = new PNG({ width: SIZE, height: SIZE });
    for (let offset = 0; offset < png.data.length; offset += 4) {
      png.data[offset] = 60; png.data[offset + 1] = 60; png.data[offset + 2] = 60;
      png.data[offset + 3] = 255;
    }
    for (let y = 8; y < 12; y += 1) {
      for (let x = 8; x < 12; x += 1) {
        const offset = (y * SIZE + x) * 4;
        png.data[offset] = 220; png.data[offset + 1] = 220; png.data[offset + 2] = 220;
      }
    }
    paint(png);
    const image = join(root, `${name}.png`);
    const masks = join(root, `${name}-masks.json`);
    writeFileSync(image, PNG.sync.write(png));
    writeFileSync(masks, JSON.stringify({
      schemaVersion: 1,
      masks: [{
        id: 'player', kind: 'player', frameId: 'sprite:1',
        logicalBounds: { x: 8, y: 8, width: 4, height: 4 },
        hitBounds: { x: 4, y: 6, width: 32, height: 32 },
        alphaFootprint: FULL,
      }],
    }));
    return { image, masks };
  }

  const THRESHOLDS = {
    backgroundRingLogicalPixels: 2, contrastRetention: 0.9,
    outsideMaskChangedPixelRatio: 0.005, outsideMaskMaximumChannelDelta: 2,
    requiredMaskMaximumChannelDelta: 8, scaledMeanAbsoluteChannelDelta: 1,
    scaledRootMeanSquareChannelDelta: 3, scaledLargeChannelDelta: 32,
    scaledLargeChangedPixelRatio: 0.002, scaledOutsideMaskChangedPixelRatio: 0.12,
    scaledMaskMeanAbsoluteChannelDelta: 10, scaledMaskRootMeanSquareChannelDelta: 20,
    scaledMaskLargeChangedPixelRatio: 0.12, scaledReadableCoverageRetention: 0.95,
  } as const;

  /** Zoom 2 makes the frame "scaled", which is the family these branches guard. */
  const scaled = (overrides: Record<string, unknown>) => ({
    schemaVersion: 1, fixture: 'scaled', sourceCommit: 'a'.repeat(40), mode: 'parity',
    viewport: { width: SIZE, height: SIZE }, devicePixelRatio: 1, zoom: 2,
    camera: { x: 0, y: 0 }, toneMapping: 'none', exposure: 1, compositingChanged: false,
    requiredMaskIds: ['player'], lightSamples: [], shadowSamples: [], thresholds: THRESHOLDS,
    ...overrides,
  });

  test('the readable predicate measures COVERAGE, not content identity', () => {
    // A mask pixel counts as readable when its own luminance separates from the ring median by
    // 1.02. It says nothing about WHICH colour the pixel is. Repainting the whole mask a different
    // shade — still clearly separated from the floor — therefore keeps full readable retention.
    //
    // That is worth pinning rather than assuming, because "readable coverage retained" reads like
    // a statement about the sprite still looking the same, and it is not one. The gate that
    // notices a changed silhouette is mask identity; this one only notices a lost signal.
    const baseline = frame('base', () => {});
    const recoloured = frame('recoloured', (png) => {
      for (let y = 8; y < 12; y += 1) {
        for (let x = 8; x < 12; x += 1) {
          const offset = (y * SIZE + x) * 4;
          png.data[offset] = 250; png.data[offset + 1] = 140; png.data[offset + 2] = 30;
        }
      }
    });
    const report = compareRendererFrames(
      scaled({ baseline, candidate: recoloured, rasterResampled: true }), 'parity',
    );
    const mask = report.measurements.masks[0]!;
    expect(mask.readableRetention).toBe(1);
    expect(report.failures.filter((failure) => failure.includes('readable coverage'))).toEqual([]);

    // And the paired half: a mask flattened into its ring loses the signal and IS caught.
    const flattened = frame('flattened', (png) => {
      for (let y = 8; y < 12; y += 1) {
        for (let x = 8; x < 12; x += 1) {
          const offset = (y * SIZE + x) * 4;
          png.data[offset] = 60; png.data[offset + 1] = 60; png.data[offset + 2] = 60;
        }
      }
    });
    const lost = compareRendererFrames(
      scaled({ baseline, candidate: flattened, rasterResampled: true }), 'parity',
    );
    expect(lost.passed).toBe(false);
  });

  test('the scaled whole-frame branches each report their own failure', () => {
    // Deleting any one of these branches used to leave the suite green. Each named message is
    // asserted separately, so removing a branch removes an expectation's subject and fails here.
    const baseline = frame('rgb-base', () => {});
    const changed = frame('rgb-changed', (png) => {
      // A floor shift large enough to break the mean AND the RMS limits.
      for (let offset = 0; offset < png.data.length; offset += 4) {
        if (png.data[offset] === 220) continue;
        png.data[offset] += 6; png.data[offset + 1] += 6; png.data[offset + 2] += 6;
      }
      // A handful of far-off pixels to break the large-changed ratio.
      for (let pixel = 0; pixel < 40; pixel += 1) {
        const offset = pixel * 4;
        png.data[offset] = 255; png.data[offset + 1] = 255; png.data[offset + 2] = 255;
      }
    });
    const failures = compareRendererFrames(scaled({ baseline, candidate: changed }), 'parity').failures.join('\n');
    expect(failures).toContain('Scaled mean absolute channel delta');
    expect(failures).toContain('Scaled root mean square channel delta');
    expect(failures).toContain('Scaled large changed-pixel ratio');
  });

  test('the mask-local branches report separately from the whole-frame ones', () => {
    // The frame average can hide a small mask drifting a long way, which is why the mask-local
    // family exists. It is gated on compositingChanged being false — which the re-baseline made
    // true of every live fixture — so it is live again and needs a test that notices its absence.
    const baseline = frame('mask-base', () => {});
    const drifted = frame('mask-drifted', (png) => {
      for (let y = 8; y < 12; y += 1) {
        for (let x = 8; x < 12; x += 1) {
          const offset = (y * SIZE + x) * 4;
          png.data[offset] = 160; png.data[offset + 1] = 160; png.data[offset + 2] = 160;
        }
      }
    });
    const failures = compareRendererFrames(scaled({ baseline, candidate: drifted }), 'parity').failures.join('\n');
    expect(failures).toContain('Scaled mask mean absolute channel delta');
    expect(failures).toContain('Scaled mask root mean square channel delta');
  });

  test('an altered mask footprint fails on the real corpus', () => {
    // The permanent form of the check that closed the oldest vacuity here. Both mask sides named
    // one file until this program split them, so this could never have failed before.
    const manifestPath = resolve('tests/fixtures/rendering/threejs-all-maps/northwest-1280x720-dpr1-zoom1-v1.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      candidate: { image: string; masks: string };
    };
    const frozen = JSON.parse(readFileSync(resolve(manifest.candidate.masks), 'utf8')) as {
      masks: { alphaFootprint: string[] }[];
    };
    frozen.masks[0]!.alphaFootprint[10] = '1'.repeat(frozen.masks[0]!.alphaFootprint[10]!.length);
    const altered = join(root, 'altered-masks.json');
    writeFileSync(altered, JSON.stringify(frozen));

    const report = compareRendererFrames({
      ...manifest, candidate: { ...manifest.candidate, masks: altered },
    }, 'parity');
    expect(report.passed).toBe(false);
    expect(report.failures.join(' ')).toContain('alpha footprint changed');
  });
});
