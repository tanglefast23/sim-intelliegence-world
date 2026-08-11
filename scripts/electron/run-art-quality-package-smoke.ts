import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { PNG } from 'pngjs';

import { ATLAS_INDEX } from '../../src/render/atlas';
import {
  ArtQualityResponsiveReportSchema,
  validateArtQualityEvidence,
  type ArtQualityEvidence,
  type ArtQualityResponsiveReport,
} from '../../src/render/art-quality-evidence';
import { resolveTestedCommit } from '../qualification/tested-commit';
import { resolveEvidenceOutputRoot } from '../verification/evidence-output';

const argumentsValue = process.argv.slice(2);
const outputRoot = resolveEvidenceOutputRoot(argumentsValue, {
  required: true,
  allowedRootPrefixes: [
    'artifacts/phase-24/art-quality/phase-28-prototype',
    'artifacts/phase-24/art-quality/phase-29-full-cast',
    'artifacts/phase-24/art-quality/phase-30-sunward',
    'artifacts/phase-24/art-quality/phase-31-tier-b',
  ],
});
mkdirSync(outputRoot, { recursive: true });
const absoluteDeadlineMilliseconds = Date.now() + 20 * 60_000;

function run(
  label: string,
  script: string,
  argumentsList: readonly string[],
  extraEnv: Readonly<Record<string, string | undefined>> = {},
): void {
  const remaining = absoluteDeadlineMilliseconds - Date.now();
  if (remaining <= 0) throw new Error(`Art-quality package smoke reached its absolute deadline before ${label}.`);
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(command, ['tsx', script, ...argumentsList], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv },
    maxBuffer: 20_000_000,
    shell: false,
    timeout: remaining,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed. ${result.stderr.slice(-8_000)} ${result.stdout.slice(-8_000)}`);
  }
  process.stderr.write(`ART_QUALITY_PROGRESS ${label}\n`);
}

function readResponsive(relativeDirectory: string): ArtQualityResponsiveReport {
  return ArtQualityResponsiveReportSchema.parse(JSON.parse(
    readFileSync(join(outputRoot, relativeDirectory, 'responsive-report.json'), 'utf8'),
  ) as unknown);
}

function sha256(relativePath: string): string {
  return createHash('sha256').update(readFileSync(resolve(relativePath))).digest('hex');
}

function writeGrayscaleFixture(sourcePath: string, targetPath: string): void {
  const image = PNG.sync.read(readFileSync(sourcePath));
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const luminance = Math.round(
      (image.data[offset] as number) * 0.2126 +
      (image.data[offset + 1] as number) * 0.7152 +
      (image.data[offset + 2] as number) * 0.0722,
    );
    image.data[offset] = luminance;
    image.data[offset + 1] = luminance;
    image.data[offset + 2] = luminance;
  }
  writeFileSync(targetPath, PNG.sync.write(image), { flush: true });
}

run('legacy-responsive', 'scripts/electron/run-responsive-package-smoke.ts', [
  '--art-mode=legacy', '--output-root', join(outputRoot, 'legacy'),
]);
run('enhanced-responsive', 'scripts/electron/run-responsive-package-smoke.ts', [
  '--art-mode=enhanced', '--output-root', join(outputRoot, 'enhanced'),
], ATLAS_INDEX.artRevision >= 3 ? { SI_WORLD_FULL_CAST_PORTRAIT_SMOKE: '1' } : {});
run('same-package-performance', 'scripts/electron/run-responsive-package-smoke.ts', [
  '--compare-art-modes', '--include-maximum-load', '--qualification',
  '--output-root', join(outputRoot, 'performance'),
]);
run('world-lifecycle', 'scripts/electron/run-package-smoke.ts', [
  '--output-root', join(outputRoot, 'lifecycle'),
], {
  SI_WORLD_SMOKE_PROFILE: 'qualification',
  ...(ATLAS_INDEX.artRevision >= 5 ? { SI_WORLD_TIER_B_ART_SMOKE: '1' } : {}),
});

const legacy = readResponsive('legacy');
const enhanced = readResponsive('enhanced');
const fixedLegacy = legacy.targets.find(({ requested }) => requested.width === 1_920 && requested.height === 1_080);
const fixedEnhanced = enhanced.targets.find(({ requested }) => requested.width === 1_920 && requested.height === 1_080);
if (!fixedLegacy || !fixedEnhanced) throw new Error('Art-quality smoke did not capture the fixed 1920x1080 Sunward camera.');
const grayscaleFixedCamera = 'fixed-camera-1x-grayscale.png';
writeGrayscaleFixture(
  join(outputRoot, 'enhanced', fixedEnhanced.screenshots.zoom[0] as string),
  join(outputRoot, grayscaleFixedCamera),
);
const conversationByScale = new Map<1 | 1.25 | 1.5, string>();
for (const target of enhanced.targets) {
  conversationByScale.set(target.conversationEvidence.uiScale, `enhanced/${target.screenshots.conversation}`);
}
for (const scale of [1, 1.25, 1.5] as const) {
  if (!conversationByScale.has(scale)) throw new Error(`Art-quality smoke is missing UI scale ${scale}.`);
}

const lifecycleFiles = [
  'world-new-game.png', 'world-1x.png', 'world-2x.png', 'world-3x.png',
  'world-roof-restored.png', 'world-downtown.png', 'world-commercial.png',
  'world-ferry.png', 'world-loop-complete.png', 'world-conversation.png',
].map((name) => `lifecycle/${name}`);
if (ATLAS_INDEX.artRevision >= 5) {
  lifecycleFiles.push(...['downtown', 'commercial', 'ferry'].flatMap((label) =>
    [1, 2, 3].map((zoom) => `lifecycle/world-${label}-${zoom}x.png`)));
}

const report: ArtQualityEvidence = {
  schemaVersion: 1,
  artRevision: ATLAS_INDEX.artRevision,
  testedCommit: resolveTestedCommit(),
  packageProvenance: legacy.packageProvenance,
  capturePolicy: {
    stateBased: true,
    minimumPaints: 2,
    absoluteDeadlineMilliseconds,
    pngPixelValidation: true,
  },
  fixedCamera: [1, 2, 3].map((zoom, index) => ({
    zoom: zoom as 1 | 2 | 3,
    legacy: `legacy/${fixedLegacy.screenshots.zoom[index] as string}`,
    enhanced: `enhanced/${fixedEnhanced.screenshots.zoom[index] as string}`,
  })) as ArtQualityEvidence['fixedCamera'],
  grayscaleFixedCamera,
  conversationFixtures: {
    '1': conversationByScale.get(1) as string,
    '1.25': conversationByScale.get(1.25) as string,
    '1.5': conversationByScale.get(1.5) as string,
  },
  lifecycleFiles,
  reports: {
    legacyResponsive: 'legacy/responsive-report.json',
    enhancedResponsive: 'enhanced/responsive-report.json',
    performance: 'performance/art-mode-comparison-report.json',
  },
  hashes: {
    atlas: sha256('assets/generated/world-atlas.png'),
    index: sha256('assets/generated/atlas-index.json'),
    manifest: sha256('assets/source/art/manifest.json'),
    northwestMap: sha256('content/maps/northwest.json'),
    renderer: sha256('src/render/WorldScene.tsx'),
    smoke: sha256('scripts/electron/run-art-quality-package-smoke.ts'),
  },
};
validateArtQualityEvidence(report, outputRoot);
const reportPath = join(outputRoot, 'art-quality-smoke-report.json');
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flush: true });
process.stdout.write(`Art-quality packaged smoke: ${reportPath}\n`);
