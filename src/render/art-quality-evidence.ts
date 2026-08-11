import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PNG } from 'pngjs';
import { z } from 'zod';

const RelativePathSchema = z.string().min(1).refine((path) => !path.startsWith('/') && !path.includes('..'), {
  message: 'Evidence paths must stay inside the output root.',
});

const ZoomEvidenceSchema = z.object({
  zoom: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  legacy: RelativePathSchema,
  enhanced: RelativePathSchema,
}).strict();

export const ArtQualityEvidenceSchema = z.object({
  schemaVersion: z.literal(1),
  artRevision: z.number().int().positive(),
  testedCommit: z.string().regex(/^[0-9a-f]{40}$/u),
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
  hashes: z.record(z.string().min(1), z.string().regex(/^[0-9a-f]{64}$/u)),
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
  return report;
}
