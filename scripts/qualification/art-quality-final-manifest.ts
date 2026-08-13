import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep, win32 } from 'node:path';

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
const GENERATED_ART_PATHS = Object.freeze({
  atlas: 'assets/generated/world-atlas.png',
  index: 'assets/generated/atlas-index.json',
  report: 'assets/generated/atlas-report.json',
  presentationRecipes: 'src/world/presentation/generated-recipes.json',
} as const);

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
  !isAbsolute(path) && !win32.isAbsolute(path) && !path.includes('\\') &&
  !path.split('/').includes('..')
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
const FullPackageProvenanceSchema = z.object({
  executable: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  modifiedMilliseconds: z.number().int().positive(),
  payload: z.string().min(1),
  payloadSizeBytes: z.number().int().positive(),
  payloadSha256: Sha256Schema,
}).strict();
const QualificationResponsiveReportSchema = z.object({
  schemaVersion: z.literal(1),
  highDpi: z.literal(true),
  testedCommit: CommitSchema,
  packageProvenance: FullPackageProvenanceSchema,
  targets: z.array(z.object({
    requested: z.object({ width: z.literal(2_560), height: z.literal(1_440) }).strict(),
  }).passthrough()).length(1),
  maximumLoad: z.object({
    evidence: z.object({
      devicePixelRatio: z.number().min(2),
      selectedWorldZoom: z.literal(1),
      overflow: z.object({ body: z.literal(false), surface: z.literal(false) }).strict(),
    }).passthrough(),
    roundedFps: z.number().int().min(60),
    qualificationRequired: z.literal(true),
    allOrdinaryLayersEnabled: z.literal(true),
    screenshot: z.literal('maximum-load.png'),
  }).passthrough(),
}).passthrough();
const RestartEvidenceSchema = z.object({
  artMode: z.literal('enhanced'),
  presentationHash: z.string().regex(/^[0-9a-f]{8}$/u),
  selectedWorldZoom: z.literal(3),
  uiScale: z.literal(1.25),
  overflow: z.object({ body: z.literal(false), surface: z.literal(false) }).strict(),
}).passthrough();
const PersistedPresentationSchema = z.object({
  schemaVersion: z.literal(1),
  worldZoom: z.literal(3),
  uiScale: z.literal(1.25),
}).passthrough();
const PresentationRestartReportSchema = z.object({
  schemaVersion: z.literal(1),
  testedCommit: CommitSchema,
  packageProvenance: FullPackageProvenanceSchema,
  seed: z.object({ mode: z.literal('seed'), evidence: RestartEvidenceSchema }).strict(),
  restart: z.object({ mode: z.literal('restart'), evidence: RestartEvidenceSchema }).strict(),
  persistedAfterSeed: PersistedPresentationSchema,
  persistedAfterRestart: PersistedPresentationSchema,
  screenshots: z.object({ seed: z.literal('seed.png'), restart: z.literal('restart.png') }).strict(),
}).passthrough();
const SaveResultSchema = z.object({
  mode: z.enum(['migration', 'reload']),
  expectedSaveStatus: z.string().min(1),
  visibleSaveStatus: z.string().min(1),
  loaded: z.object({
    status: z.literal('unchanged'),
    saveGeneration: z.literal(8),
    checksum: Sha256Schema,
    state: z.object({ schemaVersion: z.literal(7) }).passthrough(),
  }).passthrough(),
}).passthrough();
const SaveMigrationReportSchema = z.object({
  schemaVersion: z.literal(1),
  testedCommit: CommitSchema,
  packageProvenance: FullPackageProvenanceSchema,
  migration: SaveResultSchema,
  reload: SaveResultSchema,
  disk: z.object({
    mainSchemaVersion: z.literal(7),
    mainSaveGeneration: z.literal(8),
    mainPayloadChecksum: Sha256Schema,
    exactV5BackupPreserved: z.literal(true),
    backupSchemaVersion: z.literal(5),
  }).strict(),
  screenshots: z.object({ migration: z.literal('migration.png'), reload: z.literal('reload.png') }).strict(),
}).passthrough();
const PrototypeReviewReportSchema = z.object({
  schemaVersion: z.literal(1),
  artRevision: z.literal(5),
  materials: z.array(z.object({ passed: z.literal(true) }).passthrough()).min(1),
  tallPropClasses: z.tuple([
    z.literal('sofa'), z.literal('table'), z.literal('planter'),
    z.literal('palm'), z.literal('lamp'), z.literal('fountain'),
  ]),
  multiTileGroups: z.object({
    'sunward-sofa': z.tuple([z.literal('sofa-left'), z.literal('sofa-right')]),
    'sunward-table': z.tuple([z.literal('table-left'), z.literal('table-right')]),
    'sunward-fountain': z.tuple([
      z.literal('landmark-fountain-nw'), z.literal('landmark-fountain-ne'),
      z.literal('landmark-fountain-sw'), z.literal('landmark-fountain-se'),
    ]),
    'harbor-ferry': z.tuple([z.literal('landmark-ferry-left'), z.literal('landmark-ferry-right')]),
  }).strict(),
}).passthrough();
const ReviewManifestSchema = z.object({
  schemaVersion: z.literal(1),
  artRevision: z.literal(5),
  imageSha256: Sha256Schema,
  files: z.array(z.string().min(1)),
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
export type FullPackageProvenance = z.infer<typeof FullPackageProvenanceSchema>;
export type FinalArtManifestValidationContext = Readonly<{ projectRoot: string }>;

export function atlasBuildInvocation(
  nodeExecutable: string,
  npmExecPath: string | undefined,
): Readonly<{ command: string; argumentsList: readonly string[] }> {
  if (!npmExecPath) throw new Error('Final art qualification requires npm_execpath. Run it through npm.');
  return { command: nodeExecutable, argumentsList: [npmExecPath, 'run', 'art:atlas'] };
}

export function validateFinalSubsystemReports(
  candidates: Readonly<{
    qualificationResponsive: unknown;
    presentationRestart: unknown;
    saveMigration: unknown;
    prototypeReview: unknown;
    reviewManifest: unknown;
  }>,
  expected: Readonly<{
    testedCommit: string;
    packageProvenance: FullPackageProvenance;
    atlasSha256: string;
  }>,
): void {
  const responsive = QualificationResponsiveReportSchema.parse(candidates.qualificationResponsive);
  const restart = PresentationRestartReportSchema.parse(candidates.presentationRestart);
  const save = SaveMigrationReportSchema.parse(candidates.saveMigration);
  const prototype = PrototypeReviewReportSchema.parse(candidates.prototypeReview);
  const review = ReviewManifestSchema.parse(candidates.reviewManifest);
  for (const [label, report] of [['responsive', responsive], ['restart', restart], ['save', save]] as const) {
    if (report.testedCommit !== expected.testedCommit) {
      throw new Error(`Final art ${label} report tested the wrong commit.`);
    }
    if (JSON.stringify(report.packageProvenance) !== JSON.stringify(expected.packageProvenance)) {
      throw new Error(`Final art ${label} report used a different package.`);
    }
  }
  if (restart.seed.evidence.presentationHash !== restart.restart.evidence.presentationHash ||
      JSON.stringify(restart.persistedAfterSeed) !== JSON.stringify(restart.persistedAfterRestart)) {
    throw new Error('Final art presentation state did not remain stable across restart.');
  }
  if (save.migration.mode !== 'migration' || save.reload.mode !== 'reload' ||
      save.migration.visibleSaveStatus !== save.migration.expectedSaveStatus ||
      save.reload.visibleSaveStatus !== save.reload.expectedSaveStatus ||
      save.migration.loaded.checksum !== save.disk.mainPayloadChecksum ||
      save.reload.loaded.checksum !== save.disk.mainPayloadChecksum) {
    throw new Error('Final art save migration or reload acceptance did not pass.');
  }
  if (review.imageSha256 !== expected.atlasSha256 ||
      !review.files.includes('prototype-review-report.json') ||
      prototype.materials.some(({ passed }) => !passed)) {
    throw new Error('Final art review boards are not bound to the current passing atlas review.');
  }
}

export function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function containedEvidencePath(outputRoot: string, path: string): string {
  const root = resolve(outputRoot);
  const target = resolve(root, path);
  const fromRoot = relative(root, target);
  if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    throw new Error(`Final art evidence path escapes the output root: ${path}.`);
  }
  return target;
}

export function validateFinalArtManifest(
  candidate: unknown,
  outputRoot: string,
  context: FinalArtManifestValidationContext,
): FinalArtManifest {
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
      const path = containedEvidencePath(outputRoot, evidence.path);
      if (!existsSync(path)) throw new Error(`Final art case ${testCase.id} is missing ${evidence.path}.`);
      if (sha256File(path) !== evidence.sha256) {
        throw new Error(`Final art case ${testCase.id} has a stale hash for ${evidence.path}.`);
      }
    }
  }
  for (const [key, path] of Object.entries(GENERATED_ART_PATHS) as [keyof BuildHashes, string][]) {
    const absolute = resolve(context.projectRoot, path);
    if (!existsSync(absolute)) throw new Error(`Final art generated artifact is missing ${path}.`);
    const actual = sha256File(absolute);
    if (report.deterministicBuild.first[key] !== actual || report.deterministicBuild.second[key] !== actual) {
      throw new Error(`Final art generated artifact hash is stale for ${path}.`);
    }
  }
  if (!existsSync(report.package.executable)) {
    throw new Error(`Final art package executable is missing ${report.package.executable}.`);
  }
  if (!existsSync(report.package.payload) || sha256File(report.package.payload) !== report.package.payloadSha256) {
    throw new Error('Final art package payload hash is stale.');
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
