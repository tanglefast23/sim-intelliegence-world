import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PNG } from 'pngjs';
import { z } from 'zod';

const CHARACTER_IDS = [
  'devon-price', 'elise-moreau', 'generic-resident', 'linda', 'mina-park',
  'priya-nair', 'protagonist', 'rafael-cruz', 'sora-tan', 'tomas-reed',
] as const;
const MAP_IDS = [
  'northwest_residential', 'northeast_downtown', 'southwest_commercial', 'southeast_docks',
] as const;
const TALL_PROP_CLASSES = ['sofa', 'table', 'planter', 'palm', 'lamp', 'fountain'] as const;
const MULTI_TILE_GROUPS = ['harbor-ferry', 'sunward-fountain', 'sunward-sofa', 'sunward-table'] as const;
const UI_SCALE_LABELS = ['100', '125', '150'] as const;

export const FINAL_ART_REQUIRED_CASE_IDS = Object.freeze([
  ...['1280x720', '1440x900', '1920x1080', '2560x1440', '1600x720'].map((value) => `window-${value}`),
  'dpr-1', 'dpr-2',
  ...MAP_IDS.flatMap((mapId) => [1, 2, 3].map((zoom) => `map-${mapId}-${zoom}x`)),
  ...['unselected-idle', 'selected-idle', 'walk', 'talk', 'active-interaction'].map((value) => `character-${value}`),
  'selection-player', 'selection-npc', 'reduced-motion',
  ...['front', 'rear', 'left', 'right'].flatMap((direction) => [1, 2].map((cell) => `direction-${direction}-cell-${cell}`)),
  ...['outside', 'doorway', 'inside', 'roof-restored'].map((value) => `building-${value}`),
  ...['fresh-start', 'loaded-save', 'transition', 'resize', 'restart'].map((value) => `lifecycle-${value}`),
  'load-standard', 'load-maximum',
  ...CHARACTER_IDS.flatMap((characterId) => UI_SCALE_LABELS.map((scale) => `portrait-${characterId}-${scale}`)),
  ...TALL_PROP_CLASSES.map((value) => `tall-prop-${value}-front-behind`),
  ...MULTI_TILE_GROUPS.map((value) => `multi-tile-${value}`),
  ...['full', 'grayscale', 'protanopia', 'deuteranopia', 'tritanopia'].map((value) => `color-${value}`),
].sort());

const RelativePathSchema = z.string().min(1).refine((path) => (
  !path.startsWith('/') && !path.split('/').includes('..')
), { message: 'Final art evidence paths must stay inside the output root.' });
const Sha256Schema = z.string().regex(/^[0-9a-f]{64}$/u);
const CommitSchema = z.string().regex(/^[0-9a-f]{40}$/u);
const EvidenceFileSchema = z.object({
  path: RelativePathSchema,
  sha256: Sha256Schema,
}).strict();
const CaseSchema = z.object({
  id: z.string().min(1),
  status: z.literal('pass'),
  evidence: z.array(EvidenceFileSchema).min(1),
}).strict();
const BuildHashesSchema = z.object({
  atlas: Sha256Schema,
  index: Sha256Schema,
  report: Sha256Schema,
  presentationRecipes: Sha256Schema,
}).strict();

export const FinalArtManifestSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime(),
  testedCommit: CommitSchema,
  artRevision: z.literal(5),
  platform: z.object({
    operatingSystem: z.string().min(1),
    architecture: z.string().min(1),
  }).strict(),
  package: z.object({
    executable: z.string().min(1),
    payload: z.string().min(1),
    payloadSha256: Sha256Schema,
  }).strict(),
  deterministicBuild: z.object({
    measuredBeforeProvenance: z.literal(true),
    first: BuildHashesSchema,
    second: BuildHashesSchema,
    identical: z.literal(true),
  }).strict(),
  sourceAuthority: z.object({
    presentationOnlyChange: z.literal(true),
    contentAuthorityBaselineMatch: z.literal(true),
  }).strict(),
  cases: z.array(CaseSchema),
  passed: z.literal(true),
}).strict();

export type BuildHashes = z.infer<typeof BuildHashesSchema>;
export type FinalArtManifest = z.infer<typeof FinalArtManifestSchema>;

export function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function validateFinalArtManifest(candidate: unknown, outputRoot: string): FinalArtManifest {
  const report = FinalArtManifestSchema.parse(candidate);
  if (JSON.stringify(report.deterministicBuild.first) !== JSON.stringify(report.deterministicBuild.second)) {
    throw new Error('Final art deterministic build hashes do not match.');
  }
  const actualIds = report.cases.map(({ id }) => id).sort();
  if (new Set(actualIds).size !== actualIds.length) {
    throw new Error('Final art manifest has duplicate case IDs.');
  }
  if (JSON.stringify(actualIds) !== JSON.stringify(FINAL_ART_REQUIRED_CASE_IDS)) {
    const expected = new Set(FINAL_ART_REQUIRED_CASE_IDS);
    const actual = new Set(actualIds);
    const missing = FINAL_ART_REQUIRED_CASE_IDS.filter((id) => !actual.has(id));
    const unexpected = actualIds.filter((id) => !expected.has(id));
    throw new Error(`Final art manifest case coverage differs. Missing=${missing.join(',')} unexpected=${unexpected.join(',')}`);
  }
  for (const testCase of report.cases) {
    for (const evidence of testCase.evidence) {
      const path = resolve(outputRoot, evidence.path);
      if (!existsSync(path)) throw new Error(`Final art case ${testCase.id} is missing ${evidence.path}.`);
      if (sha256File(path) !== evidence.sha256) {
        throw new Error(`Final art case ${testCase.id} has a stale hash for ${evidence.path}.`);
      }
    }
  }
  return report;
}

type ColorVisionMode = 'protanopia' | 'deuteranopia' | 'tritanopia';

const COLOR_VISION_MATRICES: Readonly<Record<ColorVisionMode, readonly [
  number, number, number, number, number, number, number, number, number,
]>> = Object.freeze({
  protanopia: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deuteranopia: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.011820, 0.042940, 0.968881],
  tritanopia: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.303900],
});

function channel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function simulateColorVision(source: Buffer, mode: ColorVisionMode): Buffer {
  const image = PNG.sync.read(source);
  const matrix = COLOR_VISION_MATRICES[mode];
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const red = image.data[offset] as number;
    const green = image.data[offset + 1] as number;
    const blue = image.data[offset + 2] as number;
    image.data[offset] = channel(red * matrix[0] + green * matrix[1] + blue * matrix[2]);
    image.data[offset + 1] = channel(red * matrix[3] + green * matrix[4] + blue * matrix[5]);
    image.data[offset + 2] = channel(red * matrix[6] + green * matrix[7] + blue * matrix[8]);
  }
  return PNG.sync.write(image);
}
