import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PNG } from 'pngjs';

import {
  FINAL_ART_REQUIRED_CASE_IDS,
  atlasBuildInvocation,
  simulateColorVision,
  validateFinalArtManifest,
  validateFinalSubsystemReports,
} from '../art-quality-final-manifest';

const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

describe('Phase 32 final art-quality manifest', () => {
  test('requires exact case coverage and valid file hashes', () => {
    const root = join(tmpdir(), `si-world-final-art-${process.pid}`);
    rmSync(root, { recursive: true, force: true });
    mkdirSync(root, { recursive: true });
    try {
      const bytes = Buffer.from('final evidence');
      writeFileSync(join(root, 'proof.txt'), bytes);
      const evidenceSha256 = sha256(bytes);
      const generated = {
        atlas: Buffer.from('atlas'),
        index: Buffer.from('index'),
        report: Buffer.from('report'),
        presentationRecipes: Buffer.from('recipes'),
      };
      mkdirSync(join(root, 'assets/generated'), { recursive: true });
      mkdirSync(join(root, 'src/world/presentation'), { recursive: true });
      writeFileSync(join(root, 'assets/generated/world-atlas.png'), generated.atlas);
      writeFileSync(join(root, 'assets/generated/atlas-index.json'), generated.index);
      writeFileSync(join(root, 'assets/generated/atlas-report.json'), generated.report);
      writeFileSync(join(root, 'src/world/presentation/generated-recipes.json'), generated.presentationRecipes);
      const hashes = {
        atlas: sha256(generated.atlas), index: sha256(generated.index), report: sha256(generated.report),
        presentationRecipes: sha256(generated.presentationRecipes),
      };
      const executable = join(root, 'SI World');
      const payload = join(root, 'app.asar');
      const payloadBytes = Buffer.from('package payload');
      writeFileSync(executable, 'executable');
      writeFileSync(payload, payloadBytes);
      const report = {
        schemaVersion: 1,
        generatedAt: '2026-08-11T00:00:00.000Z',
        testedCommit: 'e'.repeat(40),
        artRevision: 5,
        platform: { operatingSystem: 'darwin', architecture: 'arm64' },
        package: { executable, payload, payloadSha256: sha256(payloadBytes) },
        deterministicBuild: { first: hashes, second: hashes, identical: true },
        sourceAuthority: { presentationOnlyChange: true, contentAuthorityBaselineMatch: true },
        cases: FINAL_ART_REQUIRED_CASE_IDS.map((id) => ({
          id, status: 'pass', evidence: [{ path: 'proof.txt', sha256: evidenceSha256 }],
        })),
        passed: true,
      };
      const context = { projectRoot: root };
      expect(validateFinalArtManifest(report, root, context).cases).toHaveLength(FINAL_ART_REQUIRED_CASE_IDS.length);
      expect(() => validateFinalArtManifest({ ...report, cases: report.cases.slice(1) }, root, context)).toThrow('case coverage');
      expect(() => validateFinalArtManifest({
        ...report,
        cases: report.cases.map((entry, index) => index === 0
          ? { ...entry, evidence: [{ path: 'proof.txt', sha256: '0'.repeat(64) }] }
          : entry),
      }, root, context)).toThrow('stale hash');
      expect(() => validateFinalArtManifest({
        ...report,
        cases: report.cases.map((entry, index) => index === 0
          ? { ...entry, evidence: [{ path: '..\\escape.txt', sha256: evidenceSha256 }] }
          : entry),
      }, root, context)).toThrow('output root');
      expect(() => validateFinalArtManifest({
        ...report,
        cases: report.cases.map((entry, index) => index === 0
          ? { ...entry, evidence: [{ path: 'C:\\escape.txt', sha256: evidenceSha256 }] }
          : entry),
      }, root, context)).toThrow('output root');
      expect(() => validateFinalArtManifest({
        ...report,
        deterministicBuild: {
          ...report.deterministicBuild,
          first: { ...hashes, atlas: '0'.repeat(64) },
          second: { ...hashes, atlas: '0'.repeat(64) },
        },
      }, root, context)).toThrow('generated artifact hash is stale');
      expect(() => validateFinalArtManifest({
        ...report,
        package: { ...report.package, payloadSha256: '0'.repeat(64) },
      }, root, context)).toThrow('package payload hash is stale');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('requires passing commit-bound subsystem reports and current review art', () => {
    const testedCommit = 'a'.repeat(40);
    const checksum = 'b'.repeat(64);
    const atlasSha256 = 'c'.repeat(64);
    const packageProvenance = {
      executable: '/package/SI World', sizeBytes: 10, modifiedMilliseconds: 1,
      payload: '/package/app.asar', payloadSizeBytes: 20, payloadSha256: 'd'.repeat(64),
    };
    const qualificationResponsive = {
      schemaVersion: 1, highDpi: true, testedCommit, packageProvenance,
      targets: [{ requested: { width: 2_560, height: 1_440 } }],
      maximumLoad: {
        evidence: { devicePixelRatio: 2, selectedWorldZoom: 1, overflow: { body: false, surface: false } },
        roundedFps: 120, qualificationRequired: true, allOrdinaryLayersEnabled: true,
        screenshot: 'maximum-load.png',
      },
    };
    const presentation = {
      schemaVersion: 1, testedCommit, packageProvenance,
      seed: { mode: 'seed', evidence: { artMode: 'enhanced', presentationHash: '1234abcd', selectedWorldZoom: 3, uiScale: 1.25, overflow: { body: false, surface: false } } },
      restart: { mode: 'restart', evidence: { artMode: 'enhanced', presentationHash: '1234abcd', selectedWorldZoom: 3, uiScale: 1.25, overflow: { body: false, surface: false } } },
      persistedAfterSeed: { schemaVersion: 1, worldZoom: 3, uiScale: 1.25 },
      persistedAfterRestart: { schemaVersion: 1, worldZoom: 3, uiScale: 1.25 },
      screenshots: { seed: 'seed.png', restart: 'restart.png' },
    };
    const result = (mode: 'migration' | 'reload') => ({
      mode, expectedSaveStatus: 'GEN 8', visibleSaveStatus: 'GEN 8',
      loaded: { status: 'unchanged', saveGeneration: 8, checksum, state: { schemaVersion: 7 } },
    });
    const save = {
      schemaVersion: 1, testedCommit, packageProvenance,
      migration: result('migration'), reload: result('reload'),
      disk: { mainSchemaVersion: 7, mainSaveGeneration: 8, mainPayloadChecksum: checksum, exactV5BackupPreserved: true, backupSchemaVersion: 5 },
      screenshots: { migration: 'migration.png', reload: 'reload.png' },
    };
    const prototypeReview = {
      schemaVersion: 1, artRevision: 5, materials: [{ passed: true }],
      tallPropClasses: ['sofa', 'table', 'planter', 'palm', 'lamp', 'fountain'],
      multiTileGroups: {
        'sunward-sofa': ['sofa-left', 'sofa-right'],
        'sunward-table': ['table-left', 'table-right'],
        'sunward-fountain': ['landmark-fountain-nw', 'landmark-fountain-ne', 'landmark-fountain-sw', 'landmark-fountain-se'],
        'harbor-ferry': ['landmark-ferry-left', 'landmark-ferry-right'],
      },
    };
    const candidates = {
      qualificationResponsive,
      presentationRestart: presentation,
      saveMigration: save,
      prototypeReview,
      reviewManifest: { schemaVersion: 1, artRevision: 5, imageSha256: atlasSha256, files: ['prototype-review-report.json'] },
    };
    const expected = { testedCommit, packageProvenance, atlasSha256 };
    expect(() => validateFinalSubsystemReports(candidates, expected)).not.toThrow();
    expect(() => validateFinalSubsystemReports({
      ...candidates,
      qualificationResponsive: { ...qualificationResponsive, maximumLoad: { ...qualificationResponsive.maximumLoad, roundedFps: 59 } },
    }, expected)).toThrow();
    expect(() => validateFinalSubsystemReports({
      ...candidates,
      presentationRestart: { ...presentation, testedCommit: 'e'.repeat(40) },
    }, expected)).toThrow('wrong commit');
    expect(() => validateFinalSubsystemReports({
      ...candidates,
      reviewManifest: { schemaVersion: 1, artRevision: 5, imageSha256: 'f'.repeat(64), files: ['prototype-review-report.json'] },
    }, expected)).toThrow('current passing atlas review');
  });

  test('runs npm through Node for portable Windows art builds', () => {
    expect(atlasBuildInvocation('C:\\node.exe', 'C:\\npm-cli.js')).toEqual({
      command: 'C:\\node.exe',
      argumentsList: ['C:\\npm-cli.js', 'run', 'art:atlas'],
    });
    expect(() => atlasBuildInvocation('/node', undefined)).toThrow('npm_execpath');
  });

  test('writes distinct same-size color-vision review fixtures', () => {
    const image = new PNG({ width: 2, height: 1 });
    image.data.set([240, 30, 60, 255, 25, 210, 180, 255]);
    const source = PNG.sync.write(image);
    for (const mode of ['protanopia', 'deuteranopia', 'tritanopia'] as const) {
      const result = simulateColorVision(source, mode);
      const decoded = PNG.sync.read(result);
      expect(decoded.width).toBe(2);
      expect(decoded.height).toBe(1);
      expect(result.equals(source)).toBe(false);
    }
  });

  test('enables the Tier B package subset in supported macOS and Windows CI jobs', () => {
    const workflow = readFileSync(join(process.cwd(), '.github/workflows/ci.yml'), 'utf8');
    // Stage 7: macOS Tier B coverage moved from the Intel job to ARM64, because the Intel
    // runner blocklists WebGL 2 and no renderer survives without it after the Skia removal.
    for (const marker of ['package-macos-arm64:', 'package-windows-x64:']) {
      const start = workflow.indexOf(marker);
      expect(start).toBeGreaterThan(-1);
      const nextJob = workflow.indexOf('\n  package-', start + marker.length);
      const job = workflow.slice(start, nextJob === -1 ? undefined : nextJob);
      expect(job).toContain("SI_WORLD_TIER_B_ART_SMOKE: '1'");
    }
  });
});
