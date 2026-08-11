import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PNG } from 'pngjs';

import {
  FINAL_ART_REQUIRED_CASE_IDS,
  simulateColorVision,
  validateFinalArtManifest,
} from '../art-quality-final-manifest';

describe('Phase 32 final art-quality manifest', () => {
  test('requires exact case coverage and valid file hashes', () => {
    const root = join(tmpdir(), `si-world-final-art-${process.pid}`);
    rmSync(root, { recursive: true, force: true });
    mkdirSync(root, { recursive: true });
    try {
      const bytes = Buffer.from('final evidence');
      writeFileSync(join(root, 'proof.txt'), bytes);
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      const hashes = {
        atlas: 'a'.repeat(64), index: 'b'.repeat(64), report: 'c'.repeat(64), presentationRecipes: 'd'.repeat(64),
      };
      const report = {
        schemaVersion: 1,
        generatedAt: '2026-08-11T00:00:00.000Z',
        testedCommit: 'e'.repeat(40),
        artRevision: 5,
        platform: { operatingSystem: 'darwin', architecture: 'arm64' },
        package: { executable: '/package/SI World', payload: '/package/app.asar', payloadSha256: 'f'.repeat(64) },
        deterministicBuild: { measuredBeforeProvenance: true, first: hashes, second: hashes, identical: true },
        sourceAuthority: { presentationOnlyChange: true, contentAuthorityBaselineMatch: true },
        cases: FINAL_ART_REQUIRED_CASE_IDS.map((id) => ({
          id, status: 'pass', evidence: [{ path: 'proof.txt', sha256 }],
        })),
        passed: true,
      };
      expect(validateFinalArtManifest(report, root).cases).toHaveLength(FINAL_ART_REQUIRED_CASE_IDS.length);
      expect(() => validateFinalArtManifest({ ...report, cases: report.cases.slice(1) }, root)).toThrow('case coverage');
      expect(() => validateFinalArtManifest({
        ...report,
        cases: report.cases.map((entry, index) => index === 0
          ? { ...entry, evidence: [{ path: 'proof.txt', sha256: '0'.repeat(64) }] }
          : entry),
      }, root)).toThrow('stale hash');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
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
    for (const marker of ['package-macos-intel:', 'package-windows-x64:']) {
      const start = workflow.indexOf(marker);
      expect(start).toBeGreaterThan(-1);
      const nextJob = workflow.indexOf('\n  package-', start + marker.length);
      const job = workflow.slice(start, nextJob === -1 ? undefined : nextJob);
      expect(job).toContain("SI_WORLD_TIER_B_ART_SMOKE: '1'");
    }
  });
});
