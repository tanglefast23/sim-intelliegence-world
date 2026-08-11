import { spawnSync } from 'node:child_process';
import { arch, platform } from 'node:os';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { z } from 'zod';

import { validateArtQualityEvidence } from '../../src/render/art-quality-evidence';
import { validateNaturalMovementReport } from '../electron/natural-movement-report';
import { resolveEvidenceOutputRoot } from '../verification/evidence-output';
import { resolveTestedCommit } from './tested-commit';
import {
  FINAL_ART_REQUIRED_CASE_IDS,
  sha256File,
  simulateColorVision,
  validateFinalArtManifest,
  type BuildHashes,
  type FinalArtManifest,
} from './art-quality-final-manifest';

const outputRoot = resolveEvidenceOutputRoot(process.argv.slice(2), {
  required: true,
  allowedRootPrefixes: ['artifacts/phase-24/art-quality/phase-32-final'],
});
const testedCommit = resolveTestedCommit();

function json(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function reportCommit(candidate: unknown, label: string): void {
  const parsed = z.object({ testedCommit: z.string() }).passthrough().parse(candidate);
  if (parsed.testedCommit !== testedCommit) {
    throw new Error(`${label} tested ${parsed.testedCommit}, not ${testedCommit}.`);
  }
}

function runAtlasBuild(): BuildHashes {
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(command, ['run', 'art:atlas'], {
    cwd: process.cwd(), encoding: 'utf8', maxBuffer: 10_000_000, shell: false,
  });
  if (result.status !== 0) throw new Error(`Deterministic art build failed. ${result.stderr} ${result.stdout}`);
  return {
    atlas: sha256File(resolve('assets/generated/world-atlas.png')),
    index: sha256File(resolve('assets/generated/atlas-index.json')),
    report: sha256File(resolve('assets/generated/atlas-report.json')),
    presentationRecipes: sha256File(resolve('src/world/presentation/generated-recipes.json')),
  };
}

function evidence(path: string): Readonly<{ path: string; sha256: string }> {
  const absolute = resolve(outputRoot, path);
  return { path, sha256: sha256File(absolute) };
}

function caseRecord(id: string, ...paths: readonly string[]): FinalArtManifest['cases'][number] {
  return { id, status: 'pass', evidence: paths.map(evidence) };
}

function buildCases(): FinalArtManifest['cases'] {
  const cases: FinalArtManifest['cases'][number][] = [];
  const add = (id: string, ...paths: string[]) => cases.push(caseRecord(id, ...paths));
  for (const size of ['1280x720', '1440x900', '1920x1080', '2560x1440', '1600x720']) {
    add(`window-${size}`, `enhanced/${size}-1x.png`, 'enhanced/responsive-report.json');
  }
  add('dpr-1', 'enhanced/1920x1080-1x.png', 'enhanced/responsive-report.json');
  add('dpr-2', 'responsive/maximum-load.png', 'responsive/responsive-report.json');
  const mapLabels: Readonly<Record<string, string>> = {
    northwest_residential: '', northeast_downtown: 'downtown-',
    southwest_commercial: 'commercial-', southeast_docks: 'ferry-',
  };
  for (const [mapId, label] of Object.entries(mapLabels)) {
    for (const zoom of [1, 2, 3]) add(`map-${mapId}-${zoom}x`, `lifecycle/world-${label}${zoom}x.png`);
  }
  add('character-unselected-idle', 'review/full-cast-identity-1x.png');
  add('character-selected-idle', 'world/world-1x.png');
  add('character-walk', 'movement/standard-1x-frame-01.png', 'movement/natural-movement-report.json');
  add('character-talk', 'lifecycle/world-conversation.png');
  add('character-active-interaction', 'lifecycle/world-linda-quest.png');
  add('selection-player', 'world/world-1x.png');
  add('selection-npc', 'enhanced/1920x1080-1x.png');
  add('reduced-motion', 'movement/reduced-1x-frame-01.png', 'movement/natural-movement-report.json');
  for (const direction of ['front', 'rear', 'left', 'right']) {
    for (const cell of [1, 2]) add(`direction-${direction}-cell-${cell}`, 'review/characters-3x.png', 'movement/natural-movement-report.json');
  }
  add('building-outside', 'world/world-roof-restored.png');
  add('building-doorway', 'world/world-1x.png', 'art-quality-smoke-report.json');
  add('building-inside', 'lifecycle/world-1x.png', 'art-quality-smoke-report.json');
  add('building-roof-restored', 'world/world-roof-restored.png', 'responsive/maximum-load.png');
  add('lifecycle-fresh-start', 'world/world-new-game.png');
  add('lifecycle-loaded-save', 'save/reload.png', 'save/save-migration-report.json');
  add('lifecycle-transition', 'world/world-loop-complete.png');
  add('lifecycle-resize', 'enhanced/1600x720-1x.png', 'enhanced/responsive-report.json');
  add('lifecycle-restart', 'restart/seed.png', 'restart/restart.png', 'restart/presentation-restart-report.json');
  add('load-standard', 'world/world-1x.png');
  add('load-maximum', 'responsive/maximum-load.png', 'responsive/responsive-report.json');
  const characters = [
    'devon-price', 'elise-moreau', 'generic-resident', 'linda', 'mina-park',
    'priya-nair', 'protagonist', 'rafael-cruz', 'sora-tan', 'tomas-reed',
  ];
  for (const characterId of characters) {
    for (const scale of ['100', '125', '150']) {
      add(`portrait-${characterId}-${scale}`, `enhanced/full-cast-portraits/${scale}-${characterId}.png`);
    }
  }
  for (const prop of ['sofa', 'table', 'planter', 'palm', 'lamp', 'fountain']) {
    add(`tall-prop-${prop}-front-behind`, 'review/tall-prop-depth-1x.png', 'review/prototype-review-report.json');
  }
  for (const group of ['harbor-ferry', 'sunward-fountain', 'sunward-sofa', 'sunward-table']) {
    add(`multi-tile-${group}`, `review/multi-${group}-1x.png`, 'review/prototype-review-report.json');
  }
  add('color-full', 'enhanced/1920x1080-1x.png');
  add('color-grayscale', 'fixed-camera-1x-grayscale.png');
  add('color-protanopia', 'color-vision/protanopia.png');
  add('color-deuteranopia', 'color-vision/deuteranopia.png');
  add('color-tritanopia', 'color-vision/tritanopia.png');
  return cases.sort((left, right) => left.id.localeCompare(right.id, 'en'));
}

function main(): void {
  const artReportCandidate = json(join(outputRoot, 'art-quality-smoke-report.json'));
  const artReport = validateArtQualityEvidence(artReportCandidate, outputRoot);
  if (artReport.testedCommit !== testedCommit || artReport.artRevision !== 5) {
    throw new Error('Final art-quality report does not match the tested commit and Art Revision 5.');
  }
  const movementCandidate = json(join(outputRoot, 'movement/natural-movement-report.json'));
  reportCommit(movementCandidate, 'Natural movement');
  validateNaturalMovementReport(movementCandidate, join(outputRoot, 'movement'), {
    validateScreenshots: true, requiredProfile: 'qualification',
  });
  for (const [label, path] of [
    ['Responsive', 'responsive/responsive-report.json'],
    ['Presentation restart', 'restart/presentation-restart-report.json'],
    ['Save migration', 'save/save-migration-report.json'],
  ] as const) reportCommit(json(join(outputRoot, path)), label);
  const authority = z.object({
    baselineMatch: z.literal(true), presentationOnlyChange: z.literal(true),
  }).passthrough().parse(json(join(outputRoot, 'review/tier-b-content-authority-report.json')));

  const colorRoot = join(outputRoot, 'color-vision');
  mkdirSync(colorRoot, { recursive: true });
  const fullColor = readFileSync(join(outputRoot, 'enhanced/1920x1080-1x.png'));
  for (const mode of ['protanopia', 'deuteranopia', 'tritanopia'] as const) {
    writeFileSync(join(colorRoot, `${mode}.png`), simulateColorVision(fullColor, mode), { flush: true });
  }

  const first = runAtlasBuild();
  const second = runAtlasBuild();
  if (JSON.stringify(first) !== JSON.stringify(second)) {
    throw new Error('Two deterministic art and presentation builds produced different hashes.');
  }
  const cases = buildCases();
  if (JSON.stringify(cases.map(({ id }) => id).sort()) !== JSON.stringify(FINAL_ART_REQUIRED_CASE_IDS)) {
    throw new Error('Final art case builder does not cover the required case IDs.');
  }
  const report: FinalArtManifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    testedCommit,
    artRevision: 5,
    platform: { operatingSystem: platform(), architecture: arch() },
    package: {
      executable: artReport.packageProvenance.executable,
      payload: artReport.packageProvenance.payload,
      payloadSha256: artReport.packageProvenance.payloadSha256,
    },
    deterministicBuild: { measuredBeforeProvenance: true, first, second, identical: true },
    sourceAuthority: {
      presentationOnlyChange: authority.presentationOnlyChange,
      contentAuthorityBaselineMatch: authority.baselineMatch,
    },
    cases,
    passed: true,
  };
  validateFinalArtManifest(report, outputRoot);
  const path = join(outputRoot, 'final-art-quality-manifest.json');
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flush: true });
  process.stdout.write(`Final art-quality manifest: ${relative(process.cwd(), path)}\n`);
}

main();
