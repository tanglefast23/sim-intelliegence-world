import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { AtlasGenerationReport } from './build-world-atlas';
import { writeReviewSheet } from './build-review-sheet';
import { writePrototypeReview } from './build-prototype-review';
import { writeFullCastReview } from './build-full-cast-review';
import { resolveEvidenceOutputRoot } from '../verification/evidence-output';

function main(root = process.cwd()): void {
  const outputRoot = resolveEvidenceOutputRoot(process.argv.slice(2), {
    required: true,
    allowedRootPrefixes: ['artifacts/phase-24/art-quality'],
  }, root);
  const files = writeReviewSheet(outputRoot, root);
  const prototype = writePrototypeReview(outputRoot, root);
  const fullCast = writeFullCastReview(outputRoot, root);
  const report = JSON.parse(
    readFileSync(resolve(root, 'assets/generated/atlas-report.json'), 'utf8'),
  ) as AtlasGenerationReport;
  const reportPath = resolve(outputRoot, 'atlas-report.json');
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flush: true });
  writeFileSync(resolve(outputRoot, 'review-manifest.json'), `${JSON.stringify({
    schemaVersion: 1,
    artRevision: report.artRevision,
    imageSha256: report.imageSha256,
    files: [
      ...files.map((file) => file.slice(outputRoot.length + 1)),
      ...prototype.files,
      'prototype-review-report.json',
      ...fullCast.files,
      'full-cast-review-report.json',
      'atlas-report.json',
    ],
  }, null, 2)}\n`, { encoding: 'utf8', flush: true });
}

try {
  main();
} catch (error: unknown) {
  process.stderr.write(`Art quality review failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
