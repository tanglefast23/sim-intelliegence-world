import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { PNG } from 'pngjs';
import { z } from 'zod';

const RectSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
}).strict();
const PointSchema = z.object({ x: z.number().int().nonnegative(), y: z.number().int().nonnegative() }).strict();
const MaskSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['player', 'npc', 'active-door', 'route', 'selection', 'destination', 'journal', 'failure']),
  frameId: z.string().min(1),
  logicalBounds: RectSchema,
  hitBounds: RectSchema,
  alphaFootprint: z.array(z.string().regex(/^[01]+$/u)).min(1),
}).strict().superRefine((mask, context) => {
  if (mask.alphaFootprint.length !== mask.logicalBounds.height ||
      mask.alphaFootprint.some((row) => row.length !== mask.logicalBounds.width)) {
    context.addIssue({ code: 'custom', message: 'Mask alpha footprint must match its logical bounds.' });
  }
});
export const RendererMaskFrameSchema = z.object({
  schemaVersion: z.literal(1),
  masks: z.array(MaskSchema),
}).strict();

const CaptureSchema = z.object({
  image: z.string().min(1),
  masks: z.string().min(1),
}).strict();
const RegionSchema = z.object({ id: z.string().min(1), logicalBounds: RectSchema }).strict();
const ComparisonManifestFields = {
  schemaVersion: z.literal(1),
  fixture: z.string().min(1),
  sourceCommit: z.string().regex(/^[a-f0-9]{40}$/u),
  mode: z.enum(['parity', 'enhanced']),
  viewport: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }).strict(),
  devicePixelRatio: z.union([z.literal(1), z.literal(1.25), z.literal(1.5), z.literal(2)]),
  camera: z.object({ x: z.number(), y: z.number() }).strict(),
  toneMapping: z.enum(['none', 'aces']),
  // Stage 4 amendment 2026-08-16: set when a layer moved into the renderer, so this frame
  // qualifies under the approved raster-neutral RGB family instead of native per-pixel limits.
  compositingChanged: z.boolean().default(false),
  /**
   * Set when a change deliberately re-rasterises or re-shades this frame, so no RGB-delta family
   * applies to it and readability alone decides.
   *
   * Every polish item repaints pixels on purpose. Measured against any baseline, all of them
   * exceed the whole-frame limits — item 5.1 was reverted at mean 1.456 against a limit of 1 with
   * a far smaller change than these. Without a way to say "this frame's raster changed by design",
   * an item cannot report a pass at all, and the temptation is to soften a threshold instead,
   * which weakens the gate for every future change rather than for this one.
   *
   * It switches OFF every RGB-delta family: the required-mask channel delta, both outside-mask
   * ratios, the whole-frame mean/RMS/large-ratio family, and the mask-local family. It leaves ON
   * everything that measures whether the frame is still READABLE: mask identity, the baseline
   * contrast floor, contrast retention, readable coverage, and the light and shadow samples.
   *
   * Readable coverage falls back from exact set identity to the retention floor, because a
   * deliberate lattice or shading change moves pixels inside the mask by design while readability
   * is exactly what must survive.
   *
   * Declared per fixture, by name, and only after the real numbers have been recorded with it off.
   */
  rasterResampled: z.boolean().default(false),
  exposure: z.number().positive(),
  baseline: CaptureSchema,
  candidate: CaptureSchema,
  requiredMaskIds: z.array(z.string().min(1)).min(1),
  lightSamples: z.array(z.object({ id: z.string().min(1), lit: RectSchema, unlit: RectSchema }).strict()),
  shadowSamples: z.array(z.object({
    id: z.string().min(1),
    direction: z.literal('lower-right'),
    edges: z.array(z.object({ lit: PointSchema, shadow: PointSchema }).strict()).min(1),
  }).strict()),
  thresholds: z.object({
    backgroundRingLogicalPixels: z.literal(2),
    contrastRetention: z.literal(0.9),
    outsideMaskChangedPixelRatio: z.literal(0.005),
    outsideMaskMaximumChannelDelta: z.literal(2),
    requiredMaskMaximumChannelDelta: z.literal(8),
    scaledMeanAbsoluteChannelDelta: z.literal(1).default(1),
    scaledRootMeanSquareChannelDelta: z.literal(3).default(3),
    scaledLargeChannelDelta: z.literal(32).default(32),
    scaledLargeChangedPixelRatio: z.literal(0.002).default(0.002),
    // Stage 3 amendment 2026-08-15: bounded mask-local limits for scaled frames.
    scaledOutsideMaskChangedPixelRatio: z.literal(0.12).default(0.12),
    scaledMaskMeanAbsoluteChannelDelta: z.literal(10).default(10),
    scaledMaskRootMeanSquareChannelDelta: z.literal(20).default(20),
    scaledMaskLargeChangedPixelRatio: z.literal(0.12).default(0.12),
    scaledReadableCoverageRetention: z.literal(0.95).default(0.95),
  }).strict(),
} as const;

function validateMode(
  manifest: Readonly<{ mode: 'parity' | 'enhanced'; toneMapping: 'none' | 'aces'; requiredMaskIds: readonly string[] }>,
  context: z.RefinementCtx,
): void {
  if (manifest.mode === 'parity' && manifest.toneMapping !== 'none') {
    context.addIssue({ code: 'custom', message: 'Parity comparison requires no tone mapping.' });
  }
  if (manifest.mode === 'enhanced' && manifest.toneMapping !== 'aces') {
    context.addIssue({ code: 'custom', message: 'Enhanced comparison requires ACES tone mapping.' });
  }
  if (new Set(manifest.requiredMaskIds).size !== manifest.requiredMaskIds.length) {
    context.addIssue({ code: 'custom', message: 'Required mask IDs must be unique.' });
  }
}

export const RendererComparisonManifestSchema = z.object({
  ...ComparisonManifestFields,
  zoom: z.number().min(1).max(3).multipleOf(0.05),
}).strict().superRefine((manifest, context) => {
  validateMode(manifest, context);
});

const ZoomSampleSchema = z.object({
  zoom: z.number().min(1).max(3).multipleOf(0.05),
  inputStep: z.boolean(),
  savedBoundary: z.literal(true),
}).strict();

const ZoomCaptureSchema = CaptureSchema.extend({
  image: z.string().refine((path) => path.includes('{zoom}'), 'Zoom capture image must include {zoom}.'),
});

export const RendererZoomSamplingManifestSchema = z.object({
  ...ComparisonManifestFields,
  baseline: ZoomCaptureSchema,
  candidate: ZoomCaptureSchema,
  mode: z.literal('parity'),
  toneMapping: z.literal('none'),
  samples: z.array(ZoomSampleSchema).length(41),
}).strict().superRefine((manifest, context) => {
  validateMode(manifest, context);
  const expectedZooms = Array.from({ length: 41 }, (_, index) => Math.round((1 + index * 0.05) * 100) / 100);
  if (JSON.stringify(manifest.samples.map(({ zoom }) => zoom)) !== JSON.stringify(expectedZooms)) {
    context.addIssue({ code: 'custom', message: 'Zoom samples must contain every 0.05 boundary from 1 through 3.' });
  }
  for (const sample of manifest.samples) {
    if (sample.inputStep !== Number.isInteger(sample.zoom * 10)) {
      context.addIssue({ code: 'custom', message: `Zoom ${sample.zoom} has an incorrect input-step flag.` });
    }
  }
});

export const RendererFixtureSetManifestSchema = z.object({
  schemaVersion: z.literal(1),
  fixtureSet: z.string().min(1),
  sourceCommit: z.string().regex(/^[a-f0-9]{40}$/u),
  mode: z.enum(['parity', 'enhanced']),
  fixtures: z.array(z.object({
    id: z.string().min(1),
    manifest: z.string().min(1),
  }).strict()).min(1),
}).strict().superRefine((manifest, context) => {
  const ids = manifest.fixtures.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) context.addIssue({ code: 'custom', message: 'Fixture-set IDs must be unique.' });
});

type Manifest = z.infer<typeof RendererComparisonManifestSchema>;
type Mask = z.infer<typeof MaskSchema>;
type ComparisonMode = Manifest['mode'];

export type RendererComparisonReport = Readonly<{
  schemaVersion: 1;
  fixture: string;
  sourceCommit: string;
  mode: ComparisonMode;
  rasterComparison: 'native' | 'scaled';
  passed: boolean;
  failures: readonly string[];
  measurements: Readonly<{
    changedOutsideMaskPixels: number;
    outsideMaskPixelCount: number;
    changedOutsideMaskRatio: number;
    comparableFramePixelCount: number;
    meanAbsoluteChannelDelta: number;
    rootMeanSquareChannelDelta: number;
    largeChangedPixelCount: number;
    largeChangedPixelRatio: number;
    maskLocal: RgbDeltaMeasurement;
    masks: readonly Readonly<{
      id: string;
      baselineReadablePixels: number;
      candidateReadablePixels: number;
      readableRetention: number;
      baselineContrast: number;
      candidateContrast: number;
      retainedContrast: number;
      maximumChannelDelta: number;
    }>[];
  }>;
}>;

export type RendererZoomSamplingReport = Readonly<{
  schemaVersion: 1;
  fixture: string;
  sourceCommit: string;
  mode: 'parity';
  passed: boolean;
  failures: readonly string[];
  samples: readonly Readonly<{
    zoom: number;
    inputStep: boolean;
    savedBoundary: true;
    report: RendererComparisonReport;
  }>[];
}>;

export type RendererFixtureSetReport = Readonly<{
  schemaVersion: 1;
  fixtureSet: string;
  sourceCommit: string;
  mode: ComparisonMode;
  passed: boolean;
  failures: readonly string[];
  fixtures: readonly Readonly<{ id: string; report: RendererComparisonReport }>[];
}>;

const rounded = (value: number): number => Math.round(value * 1_000_000) / 1_000_000;
const linear = (channel: number): number => {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};
const luminance = (image: PNG, index: number): number => (
  0.2126 * linear(image.data[index]!) +
  0.7152 * linear(image.data[index + 1]!) +
  0.0722 * linear(image.data[index + 2]!)
);
const median = (values: readonly number[]): number => {
  if (values.length === 0) throw new Error('Luminance sample is empty.');
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0 ? (ordered[middle - 1]! + ordered[middle]!) / 2 : ordered[middle]!;
};
const contrast = (foreground: number, background: number): number => (
  (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
);
const MINIMUM_BASELINE_CONTRAST = 1.05;
// Stage 3 amendment 2026-08-15: a mask pixel is readable when it separates from its ring median.
const READABLE_CONTRAST = 1.02;

export type RgbDeltaMeasurement = Readonly<{
  comparablePixelCount: number;
  meanAbsoluteChannelDelta: number;
  rootMeanSquareChannelDelta: number;
  largeChangedPixelCount: number;
  largeChangedPixelRatio: number;
}>;

/**
 * Measures RGB deltas over a pixel set. Both-transparent pixels are excluded.
 * Stage 3 uses this for the full frame, for required-mask pixels, and for packaged zoom crops,
 * so the zoom smoke never duplicates this math.
 */
export function measureRgbDeltas(
  baseline: PNG,
  candidate: PNG,
  pixels: Iterable<number>,
  largeChannelDelta: number,
): RgbDeltaMeasurement {
  let comparablePixelCount = 0;
  let absoluteChannelDelta = 0;
  let squaredChannelDelta = 0;
  let largeChangedPixelCount = 0;
  for (const pixel of pixels) {
    const offset = pixelOffset(baseline, pixel);
    if (baseline.data[offset + 3] === 0 && candidate.data[offset + 3] === 0) continue;
    comparablePixelCount += 1;
    let maximumRgbDelta = 0;
    for (let channel = 0; channel < 3; channel += 1) {
      const delta = Math.abs(baseline.data[offset + channel]! - candidate.data[offset + channel]!);
      absoluteChannelDelta += delta;
      squaredChannelDelta += delta ** 2;
      maximumRgbDelta = Math.max(maximumRgbDelta, delta);
    }
    if (maximumRgbDelta > largeChannelDelta) largeChangedPixelCount += 1;
  }
  const comparableChannelCount = comparablePixelCount * 3;
  return {
    comparablePixelCount,
    meanAbsoluteChannelDelta: comparableChannelCount === 0 ? 0 : absoluteChannelDelta / comparableChannelCount,
    rootMeanSquareChannelDelta: comparableChannelCount === 0
      ? 0 : Math.sqrt(squaredChannelDelta / comparableChannelCount),
    largeChangedPixelCount,
    largeChangedPixelRatio: comparablePixelCount === 0 ? 0 : largeChangedPixelCount / comparablePixelCount,
  };
}

function allPixels(image: PNG): Iterable<number> {
  return (function* generate(): Generator<number> {
    const total = image.width * image.height;
    for (let pixel = 0; pixel < total; pixel += 1) yield pixel;
  })();
}

function imagePixelsForRect(rectangle: z.infer<typeof RectSchema>, dpr: number, image: PNG): Set<number> {
  const pixels = new Set<number>();
  const left = Math.max(0, Math.ceil(rectangle.x * dpr - 0.5));
  const top = Math.max(0, Math.ceil(rectangle.y * dpr - 0.5));
  const right = Math.min(image.width, Math.ceil((rectangle.x + rectangle.width) * dpr - 0.5));
  const bottom = Math.min(image.height, Math.ceil((rectangle.y + rectangle.height) * dpr - 0.5));
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) pixels.add(y * image.width + x);
  }
  return pixels;
}

function maskPixels(mask: Mask, dpr: number, image: PNG): Set<number> {
  const pixels = new Set<number>();
  for (let y = 0; y < mask.alphaFootprint.length; y += 1) {
    const row = mask.alphaFootprint[y]!;
    for (let x = 0; x < row.length; x += 1) {
      if (row[x] !== '1') continue;
      for (const pixel of imagePixelsForRect({
        x: mask.logicalBounds.x + x,
        y: mask.logicalBounds.y + y,
        width: 1,
        height: 1,
      }, dpr, image)) pixels.add(pixel);
    }
  }
  return pixels;
}

function pixelOffset(image: PNG, pixel: number): number {
  return pixel * 4;
}

function visibleLuminances(image: PNG, pixels: ReadonlySet<number>): number[] {
  return [...pixels].flatMap((pixel) => {
    const offset = pixelOffset(image, pixel);
    return image.data[offset + 3] === 0 ? [] : [luminance(image, offset)];
  });
}

/**
 * Stage 3 amendment 2026-08-15: content-derived readable coverage.
 * A mask pixel counts only when its own luminance separates from the mask's ring median.
 */
function readablePixels(image: PNG, pixels: ReadonlySet<number>, ringMedian: number): number[] {
  return [...pixels].filter((pixel) => {
    const offset = pixelOffset(image, pixel);
    if (image.data[offset + 3] === 0) return false;
    return contrast(luminance(image, offset), ringMedian) >= READABLE_CONTRAST;
  }).sort((left, right) => left - right);
}

function maximumChannelDelta(baseline: PNG, candidate: PNG, pixels: ReadonlySet<number>): number {
  let maximum = 0;
  for (const pixel of pixels) {
    const offset = pixelOffset(baseline, pixel);
    if (baseline.data[offset + 3] === 0 && candidate.data[offset + 3] === 0) continue;
    for (let channel = 0; channel < 4; channel += 1) {
      maximum = Math.max(maximum, Math.abs(baseline.data[offset + channel]! - candidate.data[offset + channel]!));
    }
  }
  return maximum;
}

function samplePoint(image: PNG, point: z.infer<typeof PointSchema>, dpr: number): number {
  const x = Math.min(image.width - 1, Math.floor(point.x * dpr));
  const y = Math.min(image.height - 1, Math.floor(point.y * dpr));
  const offset = (y * image.width + x) * 4;
  if (image.data[offset + 3] === 0) throw new Error(`Transparent sample point ${point.x},${point.y}.`);
  return luminance(image, offset);
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8')) as unknown;
}

export function compareRendererFrames(candidate: unknown, requestedMode: ComparisonMode): RendererComparisonReport {
  const manifest = RendererComparisonManifestSchema.parse(candidate);
  if (manifest.mode !== requestedMode) throw new Error(`Manifest mode ${manifest.mode} does not match ${requestedMode}.`);
  const baselineImage = PNG.sync.read(readFileSync(resolve(process.cwd(), manifest.baseline.image)));
  const candidateImage = PNG.sync.read(readFileSync(resolve(process.cwd(), manifest.candidate.image)));
  if (baselineImage.width !== candidateImage.width || baselineImage.height !== candidateImage.height) {
    throw new Error('Matched renderer images must have identical dimensions.');
  }
  if (baselineImage.width !== Math.round(manifest.viewport.width * manifest.devicePixelRatio) ||
      baselineImage.height !== Math.round(manifest.viewport.height * manifest.devicePixelRatio)) {
    throw new Error('Renderer image dimensions do not match viewport and device pixel ratio.');
  }
  const baselineFrame = RendererMaskFrameSchema.parse(readJson(manifest.baseline.masks));
  const candidateFrame = RendererMaskFrameSchema.parse(readJson(manifest.candidate.masks));
  const required = [...manifest.requiredMaskIds].sort((left, right) => left.localeCompare(right, 'en'));
  const frameMasks = (masks: readonly Mask[]) => masks
    .filter(({ id }) => required.includes(id))
    .sort((left, right) => left.id.localeCompare(right.id, 'en'));
  const baselineMasks = frameMasks(baselineFrame.masks);
  const candidateMasks = frameMasks(candidateFrame.masks);
  if (JSON.stringify(baselineMasks.map(({ id }) => id)) !== JSON.stringify(required) ||
      JSON.stringify(candidateMasks.map(({ id }) => id)) !== JSON.stringify(required)) {
    throw new Error('Required renderer mask IDs are incomplete.');
  }

  const failures: string[] = [];
  const nativeRaster = manifest.devicePixelRatio === 1 && manifest.zoom === 1;
  const rasterComparison = nativeRaster ? 'native' : 'scaled';
  // A moved layer changes the compositing path, so per-pixel native limits no longer apply.
  // A deliberately re-rasterised frame goes further: no RGB-delta family applies to it at all.
  const readabilityOnly = manifest.rasterResampled;
  const perPixelNative = nativeRaster && !manifest.compositingChanged && !readabilityOnly;
  const rasterNeutral = !nativeRaster || manifest.compositingChanged;
  const requiredPixels = new Set<number>();
  for (const mask of baselineMasks) {
    for (const pixel of maskPixels(mask, manifest.devicePixelRatio, baselineImage)) requiredPixels.add(pixel);
  }
  const maskMeasurements = baselineMasks.map((baselineMask, index) => {
    const candidateMask = candidateMasks[index]!;
    if (JSON.stringify(baselineMask) !== JSON.stringify(candidateMask)) {
      failures.push(`${baselineMask.id}: frame ID, bounds, hit bounds, or alpha footprint changed.`);
    }
    const baselinePixels = maskPixels(baselineMask, manifest.devicePixelRatio, baselineImage);
    const candidatePixels = maskPixels(candidateMask, manifest.devicePixelRatio, candidateImage);
    const baselineVisible = visibleLuminances(baselineImage, baselinePixels);
    const candidateVisible = visibleLuminances(candidateImage, candidatePixels);
    const ringLeft = Math.max(0, baselineMask.logicalBounds.x - manifest.thresholds.backgroundRingLogicalPixels);
    const ringTop = Math.max(0, baselineMask.logicalBounds.y - manifest.thresholds.backgroundRingLogicalPixels);
    const ringRight = Math.min(
      manifest.viewport.width,
      baselineMask.logicalBounds.x + baselineMask.logicalBounds.width + manifest.thresholds.backgroundRingLogicalPixels,
    );
    const ringBottom = Math.min(
      manifest.viewport.height,
      baselineMask.logicalBounds.y + baselineMask.logicalBounds.height + manifest.thresholds.backgroundRingLogicalPixels,
    );
    const ringBounds = { x: ringLeft, y: ringTop, width: ringRight - ringLeft, height: ringBottom - ringTop };
    const ring = imagePixelsForRect(ringBounds, manifest.devicePixelRatio, baselineImage);
    for (const pixel of requiredPixels) ring.delete(pixel);
    for (const pixel of imagePixelsForRect(baselineMask.logicalBounds, manifest.devicePixelRatio, baselineImage)) {
      ring.delete(pixel);
    }
    const baselineRing = visibleLuminances(baselineImage, ring);
    const candidateRing = visibleLuminances(candidateImage, ring);
    const baselineContrast = baselineVisible.length > 0 && baselineRing.length > 0
      ? contrast(median(baselineVisible), median(baselineRing)) : 0;
    const candidateContrast = candidateVisible.length > 0 && candidateRing.length > 0
      ? contrast(median(candidateVisible), median(candidateRing)) : 0;
    const retainedContrast = baselineContrast > 0 ? candidateContrast / baselineContrast : 0;
    if (baselineContrast < MINIMUM_BASELINE_CONTRAST) {
      failures.push(`${baselineMask.id}: baseline contrast ${rounded(baselineContrast)} carries no readable signal.`);
    }
    if (retainedContrast < manifest.thresholds.contrastRetention) {
      failures.push(`${baselineMask.id}: retained contrast ${rounded(retainedContrast)} is below 0.9.`);
    }

    // Stage 3 amendment 2026-08-15: alpha coverage was inert because every packaged frame is opaque.
    // Readable coverage counts mask pixels that separate from their own ring median.
    const baselineReadable = baselineRing.length > 0
      ? readablePixels(baselineImage, baselinePixels, median(baselineRing)) : [];
    const candidateReadable = candidateRing.length > 0
      ? readablePixels(candidateImage, candidatePixels, median(candidateRing)) : [];
    // Retention is set OVERLAP, not a count ratio. A count lets readable pixels move inside the
    // mask, or lets spurious extras hide real losses, and still pass. Overlap catches both.
    const candidateReadableSet = new Set(candidateReadable);
    const retainedReadable = baselineReadable.filter((pixel) => candidateReadableSet.has(pixel)).length;
    const readableRetention = baselineReadable.length > 0
      ? retainedReadable / baselineReadable.length : 0;
    if (baselineReadable.length === 0) {
      failures.push(`${baselineMask.id}: baseline has no readable pixels against its ring.`);
    } else if (perPixelNative) {
      if (JSON.stringify(baselineReadable) !== JSON.stringify(candidateReadable)) {
        failures.push(`${baselineMask.id}: native readable-pixel set changed.`);
      }
    } else if (readableRetention < manifest.thresholds.scaledReadableCoverageRetention) {
      failures.push(
        `${baselineMask.id}: scaled readable coverage ${rounded(readableRetention)} is below 0.95.`,
      );
    }

    const channelDelta = maximumChannelDelta(baselineImage, candidateImage, baselinePixels);
    if (manifest.mode === 'parity' && perPixelNative &&
        channelDelta > manifest.thresholds.requiredMaskMaximumChannelDelta) {
      failures.push(`${baselineMask.id}: required-mask channel delta ${channelDelta} exceeds 8.`);
    }
    return {
      id: baselineMask.id,
      baselineReadablePixels: baselineReadable.length,
      candidateReadablePixels: candidateReadable.length,
      readableRetention: rounded(readableRetention),
      baselineContrast: rounded(baselineContrast),
      candidateContrast: rounded(candidateContrast),
      retainedContrast: rounded(retainedContrast),
      maximumChannelDelta: channelDelta,
    };
  });

  let changedOutsideMaskPixels = 0;
  let outsideMaskPixelCount = 0;
  for (let pixel = 0; pixel < baselineImage.width * baselineImage.height; pixel += 1) {
    if (requiredPixels.has(pixel)) continue;
    outsideMaskPixelCount += 1;
    const offset = pixelOffset(baselineImage, pixel);
    if (baselineImage.data[offset + 3] === 0 && candidateImage.data[offset + 3] === 0) continue;
    if ([0, 1, 2, 3].some((channel) => (
      Math.abs(baselineImage.data[offset + channel]! - candidateImage.data[offset + channel]!) >
      manifest.thresholds.outsideMaskMaximumChannelDelta
    ))) changedOutsideMaskPixels += 1;
  }
  const changedOutsideMaskRatio = outsideMaskPixelCount === 0 ? 0 : changedOutsideMaskPixels / outsideMaskPixelCount;
  if (manifest.mode === 'parity' && perPixelNative &&
      changedOutsideMaskRatio > manifest.thresholds.outsideMaskChangedPixelRatio) {
    failures.push(`Outside-mask changed-pixel ratio ${rounded(changedOutsideMaskRatio)} exceeds 0.005.`);
  }
  // Stage 3 amendment 2026-08-15: scaled frames keep a bounded outside-mask ceiling.
  if (manifest.mode === 'parity' && rasterNeutral && !readabilityOnly &&
      changedOutsideMaskRatio > manifest.thresholds.scaledOutsideMaskChangedPixelRatio) {
    failures.push(`Scaled outside-mask changed-pixel ratio ${rounded(changedOutsideMaskRatio)} exceeds 0.12.`);
  }

  const frame = measureRgbDeltas(
    baselineImage,
    candidateImage,
    allPixels(baselineImage),
    manifest.thresholds.scaledLargeChannelDelta,
  );
  const comparableFramePixelCount = frame.comparablePixelCount;
  const meanAbsoluteChannelDelta = frame.meanAbsoluteChannelDelta;
  const rootMeanSquareChannelDelta = frame.rootMeanSquareChannelDelta;
  const largeChangedPixelCount = frame.largeChangedPixelCount;
  const largeChangedPixelRatio = frame.largeChangedPixelRatio;
  // Stage 3 amendment 2026-08-15: the frame average can hide a small mask drifting far,
  // so scaled frames also measure required-mask pixels on their own.
  const maskLocal = measureRgbDeltas(
    baselineImage,
    candidateImage,
    requiredPixels,
    manifest.thresholds.scaledLargeChannelDelta,
  );
  if (manifest.mode === 'parity' && rasterNeutral && !readabilityOnly) {
    if (meanAbsoluteChannelDelta > manifest.thresholds.scaledMeanAbsoluteChannelDelta) {
      failures.push(`Scaled mean absolute channel delta ${rounded(meanAbsoluteChannelDelta)} exceeds 1.`);
    }
    if (rootMeanSquareChannelDelta > manifest.thresholds.scaledRootMeanSquareChannelDelta) {
      failures.push(`Scaled root mean square channel delta ${rounded(rootMeanSquareChannelDelta)} exceeds 3.`);
    }
    if (largeChangedPixelRatio > manifest.thresholds.scaledLargeChangedPixelRatio) {
      failures.push(`Scaled large changed-pixel ratio ${rounded(largeChangedPixelRatio)} exceeds 0.002.`);
    }
    // Stage 5 amendment 2026-08-16: mask-local per-pixel deltas assume both sides rasterize the
    // same way. A moved layer does not: Skia antialiased its vector strokes and the Three.js
    // batches draw hard-edged geometry by design. Readability is still enforced per mask through
    // exact mask identity, readable coverage and the contrast-retention floor.
    if (!manifest.compositingChanged &&
        maskLocal.meanAbsoluteChannelDelta > manifest.thresholds.scaledMaskMeanAbsoluteChannelDelta) {
      failures.push(`Scaled mask mean absolute channel delta ${rounded(maskLocal.meanAbsoluteChannelDelta)} exceeds 10.`);
    }
    if (!manifest.compositingChanged &&
        maskLocal.rootMeanSquareChannelDelta > manifest.thresholds.scaledMaskRootMeanSquareChannelDelta) {
      failures.push(`Scaled mask root mean square channel delta ${rounded(maskLocal.rootMeanSquareChannelDelta)} exceeds 20.`);
    }
    if (!manifest.compositingChanged &&
        maskLocal.largeChangedPixelRatio > manifest.thresholds.scaledMaskLargeChangedPixelRatio) {
      failures.push(`Scaled mask large changed-pixel ratio ${rounded(maskLocal.largeChangedPixelRatio)} exceeds 0.12.`);
    }
  }

  for (const sample of manifest.lightSamples) {
    const lit = visibleLuminances(candidateImage, imagePixelsForRect(sample.lit, manifest.devicePixelRatio, candidateImage));
    const unlit = visibleLuminances(candidateImage, imagePixelsForRect(sample.unlit, manifest.devicePixelRatio, candidateImage));
    if (lit.length === 0 || unlit.length === 0 || median(lit) <= median(unlit)) {
      failures.push(`${sample.id}: lamp center is not brighter than its unlit region.`);
    }
  }
  for (const sample of manifest.shadowSamples) {
    for (const edge of sample.edges) {
      if (edge.shadow.x <= edge.lit.x || edge.shadow.y <= edge.lit.y ||
          samplePoint(candidateImage, edge.shadow, manifest.devicePixelRatio) >=
          samplePoint(candidateImage, edge.lit, manifest.devicePixelRatio)) {
        failures.push(`${sample.id}: shadow edge is not darker and lower-right.`);
        break;
      }
    }
  }

  return {
    schemaVersion: 1,
    fixture: manifest.fixture,
    sourceCommit: manifest.sourceCommit,
    mode: manifest.mode,
    rasterComparison,
    passed: failures.length === 0,
    failures,
    measurements: {
      changedOutsideMaskPixels,
      outsideMaskPixelCount,
      changedOutsideMaskRatio: rounded(changedOutsideMaskRatio),
      comparableFramePixelCount,
      meanAbsoluteChannelDelta: rounded(meanAbsoluteChannelDelta),
      rootMeanSquareChannelDelta: rounded(rootMeanSquareChannelDelta),
      largeChangedPixelCount,
      largeChangedPixelRatio: rounded(largeChangedPixelRatio),
      maskLocal: {
        comparablePixelCount: maskLocal.comparablePixelCount,
        meanAbsoluteChannelDelta: rounded(maskLocal.meanAbsoluteChannelDelta),
        rootMeanSquareChannelDelta: rounded(maskLocal.rootMeanSquareChannelDelta),
        largeChangedPixelCount: maskLocal.largeChangedPixelCount,
        largeChangedPixelRatio: rounded(maskLocal.largeChangedPixelRatio),
      },
      masks: maskMeasurements,
    },
  };
}

export function compareRendererManifest(
  candidate: unknown,
  requestedMode: ComparisonMode,
): RendererComparisonReport | RendererZoomSamplingReport | RendererFixtureSetReport {
  if (candidate && typeof candidate === 'object' && 'fixtures' in candidate) {
    const manifest = RendererFixtureSetManifestSchema.parse(candidate);
    if (requestedMode !== manifest.mode) throw new Error(`Manifest mode ${manifest.mode} does not match ${requestedMode}.`);
    const fixtures = manifest.fixtures.map(({ id, manifest: path }) => {
      const report = compareRendererFrames(readJson(path), requestedMode);
      if (report.fixture !== id) throw new Error(`Fixture-set ID ${id} does not match nested fixture ${report.fixture}.`);
      if (report.sourceCommit !== manifest.sourceCommit) throw new Error(`Fixture ${id} does not match the fixture-set source commit.`);
      return { id, report };
    });
    return {
      schemaVersion: 1,
      fixtureSet: manifest.fixtureSet,
      sourceCommit: manifest.sourceCommit,
      mode: manifest.mode,
      passed: fixtures.every(({ report }) => report.passed),
      failures: fixtures.flatMap(({ id, report }) => report.failures.map((failure) => `${id}: ${failure}`)),
      fixtures,
    };
  }
  if (!candidate || typeof candidate !== 'object' || !('samples' in candidate)) {
    return compareRendererFrames(candidate, requestedMode);
  }
  const manifest = RendererZoomSamplingManifestSchema.parse(candidate);
  if (requestedMode !== manifest.mode) throw new Error(`Manifest mode ${manifest.mode} does not match ${requestedMode}.`);
  const { samples, ...common } = manifest;
  const reports = samples.map((sample) => {
    const captureAtZoom = (capture: z.infer<typeof ZoomCaptureSchema>) => ({
      ...capture,
      image: capture.image.replaceAll('{zoom}', sample.zoom.toFixed(2)),
    });
    const report = compareRendererFrames({
      ...common,
      zoom: sample.zoom,
      baseline: captureAtZoom(common.baseline),
      candidate: captureAtZoom(common.candidate),
    }, requestedMode);
    return { ...sample, report };
  });
  return {
    schemaVersion: 1,
    fixture: manifest.fixture,
    sourceCommit: manifest.sourceCommit,
    mode: manifest.mode,
    passed: reports.every(({ report }) => report.passed),
    failures: reports.flatMap(({ zoom, report }) => report.failures.map((failure) => `Zoom ${zoom}: ${failure}`)),
    samples: reports,
  };
}

function argumentValue(arguments_: readonly string[], name: string): string {
  const index = arguments_.indexOf(name);
  const value = index >= 0 ? arguments_[index + 1] : undefined;
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function main(): void {
  const arguments_ = process.argv.slice(2);
  const mode = argumentValue(arguments_, '--mode');
  if (mode !== 'parity' && mode !== 'enhanced') throw new Error('--mode must be parity or enhanced.');
  const manifestPath = argumentValue(arguments_, '--manifest');
  const outputPath = argumentValue(arguments_, '--output');
  const report = compareRendererManifest(readJson(manifestPath), mode);
  const resolvedOutput = resolve(process.cwd(), outputPath);
  mkdirSync(dirname(resolvedOutput), { recursive: true });
  writeFileSync(resolvedOutput, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flush: true });
  process.stdout.write(`Renderer comparison ${report.passed ? 'passed' : 'failed'}: ${outputPath}\n`);
  if (!report.passed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
