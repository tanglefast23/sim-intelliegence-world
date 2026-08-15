import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { PNG } from 'pngjs';

import { rendererComparatorFixturePngs } from '../build-renderer-comparator-fixtures';
import { compareRendererFrames, compareRendererManifest } from '../compare-renderer-frames';

const SOURCE = '667540e6b0715e00ce4dccb90e6c1f9443c07e39';
const THRESHOLDS = {
  backgroundRingLogicalPixels: 2,
  contrastRetention: 0.9,
  outsideMaskChangedPixelRatio: 0.005,
  outsideMaskMaximumChannelDelta: 2,
  requiredMaskMaximumChannelDelta: 8,
} as const;

function image(path: string, width = 32, height = 32, fill = 48): PNG {
  const png = new PNG({ width, height });
  for (let offset = 0; offset < png.data.length; offset += 4) {
    png.data[offset] = fill;
    png.data[offset + 1] = fill;
    png.data[offset + 2] = fill;
    png.data[offset + 3] = 255;
  }
  writeFileSync(path, PNG.sync.write(png));
  return png;
}

function writeImage(path: string, png: PNG): void {
  writeFileSync(path, PNG.sync.write(png));
}

function frame(path: string, overrides: Record<string, unknown> = {}): void {
  writeFileSync(path, `${JSON.stringify({
    schemaVersion: 1,
    masks: [{
      id: 'player',
      kind: 'player',
      frameId: 'player:idle:down:0',
      logicalBounds: { x: 4, y: 4, width: 1, height: 1 },
      hitBounds: { x: 3, y: 3, width: 3, height: 3 },
      alphaFootprint: ['1'],
      ...overrides,
    }],
  })}\n`);
}

function manifest(root: string, mode: 'parity' | 'enhanced' = 'parity') {
  return {
    schemaVersion: 1,
    fixture: `unit-${mode}`,
    sourceCommit: SOURCE,
    mode,
    viewport: { width: 32, height: 32 },
    devicePixelRatio: 1,
    zoom: 1,
    camera: { x: 0, y: 0 },
    toneMapping: mode === 'parity' ? 'none' : 'aces',
    exposure: 1,
    baseline: { image: join(root, 'baseline.png'), masks: join(root, 'baseline.json') },
    candidate: { image: join(root, 'candidate.png'), masks: join(root, 'candidate.json') },
    requiredMaskIds: ['player'],
    lightSamples: [],
    shadowSamples: [],
    thresholds: THRESHOLDS,
  };
}

describe('renderer frame comparison', () => {
  let root = '';

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'si-world-render-compare-'));
    const baseline = image(join(root, 'baseline.png'));
    baseline.data[(4 * 32 + 4) * 4] = 220;
    baseline.data[(4 * 32 + 4) * 4 + 1] = 220;
    baseline.data[(4 * 32 + 4) * 4 + 2] = 220;
    writeImage(join(root, 'baseline.png'), baseline);
    writeImage(join(root, 'candidate.png'), baseline);
    frame(join(root, 'baseline.json'));
    frame(join(root, 'candidate.json'));
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  test('selects the requested mode and keeps deterministic output', () => {
    const parity = manifest(root);
    const first = compareRendererFrames(parity, 'parity');
    expect(first.passed).toBe(true);
    expect(compareRendererFrames(parity, 'parity')).toEqual(first);
    expect(() => compareRendererFrames(parity, 'enhanced')).toThrow('does not match');
  });

  test('excludes every required mask from another mask background ring', () => {
    const second = {
      id: 'npc:linda', kind: 'npc', frameId: 'npc:linda:walk:0',
      logicalBounds: { x: 5, y: 4, width: 1, height: 1 },
      hitBounds: { x: 5, y: 4, width: 1, height: 1 }, alphaFootprint: ['1'],
    };
    for (const name of ['baseline.json', 'candidate.json']) {
      const path = join(root, name);
      const value = JSON.parse(readFileSync(path, 'utf8')) as { masks: unknown[] };
      value.masks.push(second);
      writeFileSync(path, `${JSON.stringify(value)}\n`);
    }
    const baseline = PNG.sync.read(readFileSync(join(root, 'baseline.png')));
    const secondOffset = (4 * 32 + 5) * 4;
    baseline.data[secondOffset] = 220;
    baseline.data[secondOffset + 1] = 220;
    baseline.data[secondOffset + 2] = 220;
    writeImage(join(root, 'baseline.png'), baseline);
    writeImage(join(root, 'candidate.png'), baseline);
    const value = manifest(root);
    value.requiredMaskIds = ['player', 'npc:linda'];
    expect(compareRendererFrames(value, 'parity').passed).toBe(true);
  });

  test('excludes transparent cells inside a mask logical bounds from its background ring', () => {
    for (const name of ['baseline.json', 'candidate.json']) {
      frame(join(root, name), {
        logicalBounds: { x: 3, y: 3, width: 3, height: 3 },
        alphaFootprint: ['000', '010', '000'],
      });
    }
    const candidate = PNG.sync.read(readFileSync(join(root, 'candidate.png')));
    candidate.data[(3 * 32 + 3) * 4] = 220;
    writeImage(join(root, 'candidate.png'), candidate);
    expect(compareRendererFrames(manifest(root, 'enhanced'), 'enhanced').passed).toBe(true);
  });

  test('ignores hidden RGB values when both pixels are transparent', () => {
    const baseline = PNG.sync.read(readFileSync(join(root, 'baseline.png')));
    const candidate = PNG.sync.read(readFileSync(join(root, 'candidate.png')));
    baseline.data[3] = 0;
    candidate.data[0] = 255;
    candidate.data[1] = 127;
    candidate.data[2] = 63;
    candidate.data[3] = 0;
    writeImage(join(root, 'baseline.png'), baseline);
    writeImage(join(root, 'candidate.png'), candidate);
    expect(compareRendererFrames(manifest(root), 'parity').passed).toBe(true);
  });

  test('clips the two-logical-pixel ring at image boundaries', () => {
    frame(join(root, 'baseline.json'), { logicalBounds: { x: 0, y: 0, width: 1, height: 1 } });
    frame(join(root, 'candidate.json'), { logicalBounds: { x: 0, y: 0, width: 1, height: 1 } });
    const baseline = PNG.sync.read(readFileSync(join(root, 'baseline.png')));
    baseline.data[0] = 220;
    baseline.data[1] = 220;
    baseline.data[2] = 220;
    writeImage(join(root, 'baseline.png'), baseline);
    writeImage(join(root, 'candidate.png'), baseline);
    expect(compareRendererFrames(manifest(root), 'parity').passed).toBe(true);
  });

  test('assigns fractional-DPR device pixels to one logical mask cell', () => {
    const baseline = image(join(root, 'baseline.png'), 40, 40);
    baseline.data[(5 * 40 + 5) * 4] = 220;
    baseline.data[(5 * 40 + 5) * 4 + 1] = 220;
    baseline.data[(5 * 40 + 5) * 4 + 2] = 220;
    writeImage(join(root, 'baseline.png'), baseline);
    writeImage(join(root, 'candidate.png'), baseline);
    const value = manifest(root);
    value.devicePixelRatio = 1.25;
    expect(compareRendererFrames(value, 'parity').measurements.masks[0]?.baselineVisiblePixels).toBe(1);
  });

  test('enforces channel thresholds inside and outside masks', () => {
    const candidate = PNG.sync.read(readFileSync(join(root, 'candidate.png')));
    const maskOffset = (4 * 32 + 4) * 4;
    candidate.data[maskOffset] = candidate.data[maskOffset]! - 9;
    for (let pixel = 10; pixel < 16; pixel += 1) candidate.data[pixel * 4] = candidate.data[pixel * 4]! + 3;
    writeImage(join(root, 'candidate.png'), candidate);
    const report = compareRendererFrames(manifest(root), 'parity');
    expect(report.passed).toBe(false);
    expect(report.failures.join(' ')).toContain('exceeds 8');
    expect(report.failures.join(' ')).toContain('exceeds 0.005');
  });

  test('uses raster-neutral RGB gates for scaled frames', () => {
    const candidate = PNG.sync.read(readFileSync(join(root, 'candidate.png')));
    const maskOffset = (4 * 32 + 4) * 4;
    candidate.data[maskOffset] = candidate.data[maskOffset]! - 9;
    for (let pixel = 10; pixel < 16; pixel += 1) candidate.data[pixel * 4] = candidate.data[pixel * 4]! + 3;
    writeImage(join(root, 'candidate.png'), candidate);
    const value = manifest(root);
    value.zoom = 2;
    const report = compareRendererFrames(value, 'parity');
    expect(report.rasterComparison).toBe('scaled');
    expect(report.passed).toBe(true);
    expect(report.measurements.meanAbsoluteChannelDelta).toBeGreaterThan(0);
  });

  test('rejects too many large RGB changes in a scaled frame', () => {
    const candidate = PNG.sync.read(readFileSync(join(root, 'candidate.png')));
    for (let pixel = 10; pixel < 13; pixel += 1) candidate.data[pixel * 4] = candidate.data[pixel * 4]! + 64;
    writeImage(join(root, 'candidate.png'), candidate);
    const value = manifest(root);
    value.zoom = 2;
    const report = compareRendererFrames(value, 'parity');
    expect(report.passed).toBe(false);
    expect(report.failures.join(' ')).toContain('Scaled large changed-pixel ratio');
  });

  test('rejects changed visible coverage', () => {
    const candidate = PNG.sync.read(readFileSync(join(root, 'candidate.png')));
    candidate.data[(4 * 32 + 4) * 4 + 3] = 0;
    writeImage(join(root, 'candidate.png'), candidate);
    const report = compareRendererFrames(manifest(root, 'enhanced'), 'enhanced');
    expect(report.passed).toBe(false);
    expect(report.failures.join(' ')).toContain('visible pixel coverage');
  });

  test('rejects a mask whose baseline carries no readable contrast', () => {
    const baseline = PNG.sync.read(readFileSync(join(root, 'baseline.png')));
    const offset = (4 * 32 + 4) * 4;
    baseline.data[offset] = 48;
    baseline.data[offset + 1] = 48;
    baseline.data[offset + 2] = 48;
    writeImage(join(root, 'baseline.png'), baseline);
    writeImage(join(root, 'candidate.png'), baseline);
    const report = compareRendererFrames(manifest(root), 'parity');
    expect(report.passed).toBe(false);
    expect(report.failures.join(' ')).toContain('carries no readable signal');
  });

  test.each([
    ['parity', 'comparator-parity-pass-v1.json', true],
    ['parity', 'comparator-parity-fail-v1.json', false],
    ['enhanced', 'comparator-enhanced-pass-v1.json', true],
    ['enhanced', 'comparator-enhanced-fail-v1.json', false],
  ] as const)('proves the %s self-test fixture %s', (mode, name, expected) => {
    const fixture = JSON.parse(readFileSync(resolve('tests/fixtures/rendering', name), 'utf8')) as unknown;
    expect(compareRendererFrames(fixture, mode).passed).toBe(expected);
  });

  test('keeps the committed comparator PNG fixtures deterministic', () => {
    for (const [name, expected] of Object.entries(rendererComparatorFixturePngs())) {
      expect(readFileSync(resolve('tests/fixtures/rendering', name))).toEqual(expected);
    }
  });

  test('aggregates a fixture set through the same parity gate', () => {
    const fixture = JSON.parse(readFileSync(resolve(
      'tests/fixtures/rendering/comparator-parity-pass-v1.json',
    ), 'utf8')) as { sourceCommit: string };
    const report = compareRendererManifest({
      schemaVersion: 1,
      fixtureSet: 'unit-set',
      sourceCommit: fixture.sourceCommit,
      mode: 'parity',
      fixtures: [{
        id: 'stage-0-parity-pass',
        manifest: 'tests/fixtures/rendering/comparator-parity-pass-v1.json',
      }],
    }, 'parity');
    expect(report.passed).toBe(true);
    expect('fixtures' in report && report.fixtures).toHaveLength(1);
  });

  test('runs every saved 0.05 zoom boundary through the comparator tool', () => {
    const fixture = JSON.parse(readFileSync(
      resolve('tests/fixtures/rendering/zoom-sampling-v1.json'),
      'utf8',
    )) as unknown;
    const report = compareRendererManifest(fixture, 'parity');
    expect('samples' in report ? report.samples : []).toHaveLength(41);
    expect(report.passed).toBe(true);
    const samples = 'samples' in report ? report.samples : [];
    expect(samples.map(({ zoom }) => zoom)).toEqual(
      Array.from({ length: 41 }, (_, index) => Math.round((1 + index * 0.05) * 100) / 100),
    );
    expect(samples.every(({ zoom, inputStep }) => inputStep === Number.isInteger(zoom * 10))).toBe(true);
    expect(samples.every(({ report }) => report.passed)).toBe(true);
  });

  test('fails the exact zoom whose candidate capture changes', () => {
    const fixture = JSON.parse(readFileSync(
      resolve('tests/fixtures/rendering/zoom-sampling-v1.json'),
      'utf8',
    )) as {
      candidate: { image: string };
      samples: Array<{ zoom: number }>;
    };
    fixture.candidate.image = join(root, '{zoom}-candidate.png');
    for (const { zoom } of fixture.samples) {
      const source = PNG.sync.read(readFileSync(resolve(
        'tests/fixtures/rendering',
        zoom === 1.05 ? 'comparator-parity-changed.png' : 'comparator-identical.png',
      )));
      if (zoom === 1.05) {
        for (let pixel = 10; pixel < 13; pixel += 1) source.data[pixel * 4] = source.data[pixel * 4]! + 64;
      }
      writeFileSync(
        fixture.candidate.image.replace('{zoom}', zoom.toFixed(2)),
        PNG.sync.write(source),
      );
    }
    const report = compareRendererManifest(fixture, 'parity');
    expect(report.passed).toBe(false);
    expect(report.failures.join(' ')).toContain('Zoom 1.05');
  });
});
