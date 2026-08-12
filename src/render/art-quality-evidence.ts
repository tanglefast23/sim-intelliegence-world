import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PNG } from 'pngjs';
import { z } from 'zod';

import { CHARACTER_IDS } from './atlas';

const RelativePathSchema = z.string().min(1).refine((path) => !path.startsWith('/') && !path.includes('..'), {
  message: 'Evidence paths must stay inside the output root.',
});
const CommitSchema = z.string().regex(/^[0-9a-f]{40}$/u);
const Sha256Schema = z.string().regex(/^[0-9a-f]{64}$/u);
const PackageProvenanceSchema = z.object({
  executable: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  modifiedMilliseconds: z.number().int().positive(),
  payload: z.string().min(1),
  payloadSizeBytes: z.number().int().positive(),
  payloadSha256: Sha256Schema,
}).strict();
const CaptureEvidenceSchema = z.object({
  content: z.object({ width: z.number().positive(), height: z.number().positive() }).strict(),
  devicePixelRatio: z.number().positive(),
  selectedWorldZoom: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  camera: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  }).strict(),
  mapId: z.string().min(1),
  artMode: z.enum(['legacy', 'enhanced']),
}).passthrough();
const ResponsiveTargetSchema = z.object({
  requested: z.object({ width: z.number().positive(), height: z.number().positive() }).strict(),
  afterResizeEvidence: CaptureEvidenceSchema,
  conversationEvidence: z.object({
    uiScale: z.union([z.literal(1), z.literal(1.25), z.literal(1.5)]),
  }).passthrough(),
  screenshots: z.object({
    zoom: z.tuple([RelativePathSchema, RelativePathSchema, RelativePathSchema]),
    conversation: RelativePathSchema,
  }).strict(),
}).passthrough();
const FullCastPortraitEntrySchema = z.object({
  characterId: z.enum(CHARACTER_IDS),
  uiScale: z.union([z.literal(1), z.literal(1.25), z.literal(1.5)]),
  screenshot: RelativePathSchema,
  evidence: CaptureEvidenceSchema.extend({
    uiScale: z.union([z.literal(1), z.literal(1.25), z.literal(1.5)]),
  }),
  portraitRect: z.object({
    x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive(),
  }).strict(),
  inputRect: z.object({
    x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive(),
  }).strict(),
  transcriptFontSize: z.number().positive(),
}).strict();

export const ArtQualityResponsiveReportSchema = z.object({
  schemaVersion: z.literal(1),
  highDpi: z.boolean(),
  targets: z.array(ResponsiveTargetSchema).min(1),
  fullCastPortraitMatrix: z.array(FullCastPortraitEntrySchema).length(CHARACTER_IDS.length * 3).nullable().optional(),
  packageProvenance: PackageProvenanceSchema,
  testedCommit: CommitSchema,
}).passthrough();

const PerformanceModeSchema = z.object({
  roundedFps: z.number().int().positive(),
  medianFrameTimeMilliseconds: z.number().positive(),
  staticBatchCount: z.number().int().positive(),
}).passthrough();
const ArtModeComparisonReportSchema = z.object({
  schemaVersion: z.literal(1),
  compareArtModes: z.literal(true),
  includeMaximumLoad: z.literal(true),
  qualification: z.literal(true),
  testedCommit: CommitSchema,
  packageProvenance: PackageProvenanceSchema,
  matchedInputs: z.object({
    mapId: z.string().min(1),
    content: z.object({ width: z.number().positive(), height: z.number().positive() }).strict(),
    surface: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number().positive(),
      height: z.number().positive(),
    }).strict(),
    devicePixelRatio: z.number().positive(),
    selectedWorldZoom: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    camera: z.object({
      x: z.number(),
      y: z.number(),
      zoom: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    }).strict(),
    uiScale: z.union([z.literal(1), z.literal(1.25), z.literal(1.5)]),
    testedCommit: CommitSchema,
    packageProvenance: PackageProvenanceSchema,
  }).passthrough(),
  performanceAcceptance: z.object({
    enhancedToLegacyMedianRatio: z.number().positive().max(1.1),
    maximumMedianRatio: z.literal(1.1),
    minimumRoundedFps: z.literal(60),
    addedStaticBatches: z.number().int().min(0).max(1),
    maximumAddedStaticBatches: z.literal(1),
    passed: z.literal(true),
  }).strict(),
  modes: z.object({ legacy: PerformanceModeSchema, enhanced: PerformanceModeSchema }).strict(),
}).passthrough();

export type ArtQualityResponsiveReport = z.infer<typeof ArtQualityResponsiveReportSchema>;

const ZoomEvidenceSchema = z.object({
  zoom: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  legacy: RelativePathSchema,
  enhanced: RelativePathSchema,
}).strict();

export const ArtQualityEvidenceSchema = z.object({
  schemaVersion: z.literal(1),
  artRevision: z.number().int().positive(),
  testedCommit: CommitSchema,
  packageProvenance: PackageProvenanceSchema,
  capturePolicy: z.object({
    stateBased: z.literal(true),
    minimumPaints: z.literal(2),
    absoluteDeadlineMilliseconds: z.number().int().positive(),
    pngPixelValidation: z.literal(true),
  }).strict(),
  fixedCamera: z.tuple([ZoomEvidenceSchema, ZoomEvidenceSchema, ZoomEvidenceSchema]),
  grayscaleFixedCamera: RelativePathSchema,
  conversationFixtures: z.object({
    '1': RelativePathSchema,
    '1.25': RelativePathSchema,
    '1.5': RelativePathSchema,
  }).strict(),
  lifecycleFiles: z.array(RelativePathSchema).min(8),
  reports: z.object({
    legacyResponsive: RelativePathSchema,
    enhancedResponsive: RelativePathSchema,
    performance: RelativePathSchema,
  }).strict(),
  hashes: z.record(z.string().min(1), Sha256Schema),
}).strict();

export type ArtQualityEvidence = z.infer<typeof ArtQualityEvidenceSchema>;

function inspectPng(path: string): Readonly<{ width: number; height: number; distinctPixels: number }> {
  const decoded = PNG.sync.read(readFileSync(path));
  const pixels = new Set<string>();
  for (let offset = 0; offset < decoded.data.length && pixels.size < 32; offset += 4) {
    pixels.add(decoded.data.subarray(offset, offset + 4).toString('hex'));
  }
  return { width: decoded.width, height: decoded.height, distinctPixels: pixels.size };
}

function childEvidencePath(reportPath: string, childPath: string): string {
  const directory = reportPath.split('/').slice(0, -1).join('/');
  return directory ? `${directory}/${childPath}` : childPath;
}

function stableValue(value: unknown): string {
  return JSON.stringify(value);
}

export function validateArtQualityEvidence(candidate: unknown, outputRoot: string): ArtQualityEvidence {
  const report = ArtQualityEvidenceSchema.parse(candidate);
  const imagePaths = [
    ...report.fixedCamera.flatMap(({ legacy, enhanced }) => [legacy, enhanced]),
    report.grayscaleFixedCamera,
    ...Object.values(report.conversationFixtures),
    ...report.lifecycleFiles.filter((path) => path.endsWith('.png')),
  ];
  for (const relativePath of [
    ...imagePaths,
    ...Object.values(report.reports),
  ]) {
    const path = resolve(outputRoot, relativePath);
    if (!existsSync(path)) throw new Error(`Art-quality evidence is missing ${relativePath}.`);
  }
  for (const relativePath of imagePaths) {
    const dimensions = inspectPng(resolve(outputRoot, relativePath));
    if (dimensions.width < 640 || dimensions.height < 360) {
      throw new Error(`Art-quality frame ${relativePath} is too small.`);
    }
    if (dimensions.distinctPixels < 8) {
      throw new Error(`Art-quality frame ${relativePath} is blank or stale.`);
    }
  }
  for (const pair of report.fixedCamera) {
    const legacy = readFileSync(resolve(outputRoot, pair.legacy));
    const enhanced = readFileSync(resolve(outputRoot, pair.enhanced));
    if (legacy.equals(enhanced)) throw new Error(`Art-quality ${pair.zoom}x before and after frames are identical.`);
  }
  const legacyReport = ArtQualityResponsiveReportSchema.parse(JSON.parse(
    readFileSync(resolve(outputRoot, report.reports.legacyResponsive), 'utf8'),
  ) as unknown);
  const enhancedReport = ArtQualityResponsiveReportSchema.parse(JSON.parse(
    readFileSync(resolve(outputRoot, report.reports.enhancedResponsive), 'utf8'),
  ) as unknown);
  const performanceReport = ArtModeComparisonReportSchema.parse(JSON.parse(
    readFileSync(resolve(outputRoot, report.reports.performance), 'utf8'),
  ) as unknown);
  for (const subordinate of [legacyReport, enhancedReport, performanceReport]) {
    if (subordinate.testedCommit !== report.testedCommit) {
      throw new Error('Art-quality subordinate report tested commit does not match the top-level report.');
    }
    if (stableValue(subordinate.packageProvenance) !== stableValue(report.packageProvenance)) {
      throw new Error('Art-quality subordinate report package provenance does not match the top-level report.');
    }
  }
  if (performanceReport.matchedInputs.testedCommit !== report.testedCommit ||
      stableValue(performanceReport.matchedInputs.packageProvenance) !== stableValue(report.packageProvenance)) {
    throw new Error('Art-quality performance inputs do not match the tested commit and package provenance.');
  }
  const legacyFixed = legacyReport.targets.find(({ requested }) => requested.width === 1_920 && requested.height === 1_080);
  const enhancedFixed = enhancedReport.targets.find(({ requested }) => requested.width === 1_920 && requested.height === 1_080);
  if (!legacyFixed || !enhancedFixed) throw new Error('Art-quality responsive reports are missing the fixed 1920x1080 target.');
  if (legacyFixed.afterResizeEvidence.artMode !== 'legacy' || enhancedFixed.afterResizeEvidence.artMode !== 'enhanced') {
    throw new Error('Art-quality fixed-camera reports do not identify the expected art modes.');
  }
  const fixedInput = (target: typeof legacyFixed) => ({
    requested: target.requested,
    content: target.afterResizeEvidence.content,
    devicePixelRatio: target.afterResizeEvidence.devicePixelRatio,
    selectedWorldZoom: target.afterResizeEvidence.selectedWorldZoom,
    camera: target.afterResizeEvidence.camera,
    mapId: target.afterResizeEvidence.mapId,
  });
  if (stableValue(fixedInput(legacyFixed)) !== stableValue(fixedInput(enhancedFixed))) {
    throw new Error('Legacy and enhanced fixed-camera inputs do not match.');
  }
  report.fixedCamera.forEach((pair, index) => {
    const expectedLegacy = childEvidencePath(report.reports.legacyResponsive, legacyFixed.screenshots.zoom[index] as string);
    const expectedEnhanced = childEvidencePath(report.reports.enhancedResponsive, enhancedFixed.screenshots.zoom[index] as string);
    if (pair.legacy !== expectedLegacy || pair.enhanced !== expectedEnhanced) {
      throw new Error(`Art-quality ${pair.zoom}x frame is not pinned to its responsive report.`);
    }
  });
  const minimumFps = performanceReport.performanceAcceptance.minimumRoundedFps;
  if (performanceReport.modes.legacy.roundedFps < minimumFps ||
      performanceReport.modes.enhanced.roundedFps < minimumFps) {
    throw new Error(`Art-quality performance report is below ${minimumFps} FPS.`);
  }
  if (report.artRevision >= 3) {
    const matrix = enhancedReport.fullCastPortraitMatrix;
    if (!matrix) throw new Error('Art-quality revision 3 requires the full-cast portrait matrix.');
    const expected = [1, 1.25, 1.5].flatMap((uiScale) => (
      CHARACTER_IDS.map((characterId) => ({ characterId, uiScale }))
    ));
    const actual = matrix.map(({ characterId, uiScale }) => ({ characterId, uiScale }));
    if (stableValue(actual) !== stableValue(expected)) {
      throw new Error('Art-quality full-cast portrait matrix is incomplete or out of order.');
    }
    if (new Set(matrix.map(({ screenshot }) => screenshot)).size !== matrix.length) {
      throw new Error('Art-quality full-cast portrait matrix must use one screenshot per entry.');
    }
    for (const entry of matrix) {
      if (entry.evidence.artMode !== 'enhanced' || entry.evidence.uiScale !== entry.uiScale) {
        throw new Error(`Art-quality portrait ${entry.characterId} has mismatched presentation evidence.`);
      }
      if (entry.portraitRect.width < 80 || entry.portraitRect.height < 88 ||
          entry.inputRect.width < 200 || entry.inputRect.height < 36 ||
          entry.transcriptFontSize < 11) {
        throw new Error(`Art-quality portrait ${entry.characterId} at ${entry.uiScale}x is not readable.`);
      }
      const relativePath = childEvidencePath(report.reports.enhancedResponsive, entry.screenshot);
      const path = resolve(outputRoot, relativePath);
      if (!existsSync(path)) throw new Error(`Art-quality evidence is missing ${relativePath}.`);
      const dimensions = inspectPng(path);
      if (dimensions.width < 1_280 || dimensions.height < 720 || dimensions.distinctPixels < 8) {
        throw new Error(`Art-quality portrait frame ${relativePath} is incomplete.`);
      }
    }
  }
  return report;
}
