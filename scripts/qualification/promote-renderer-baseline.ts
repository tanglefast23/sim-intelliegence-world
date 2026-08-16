import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Move a technique's measured result forward into the baseline.
 *
 * Each technique in this program repaints pixels on purpose, so it is measured against the
 * baseline left by the technique before it, and then becomes the baseline for the next one. That
 * is what keeps every item's comparison a real before-and-after rather than a drift from evidence
 * nobody can refresh.
 *
 * This is NOT `capture:rebaseline`. That script is a one-time migration that retargets manifest
 * paths off the immutable Skia tree. By the time a technique lands, those paths are already
 * correct, and retargeting again would move evidence for no reason.
 *
 * IMAGE AND MASK MOVE TOGETHER, ALWAYS.
 *
 * Promoting a mask without its image is not a smaller version of promoting both. It is a broken
 * comparison. `maskPixels` applies the BASELINE mask to the BASELINE image, so a grown silhouette
 * recorded against an unscaled frame puts floor inside the footprint. `baselineVisible` then mixes
 * figure with floor, `baselineContrast` collapses toward 1, and the `1.05` readable-signal floor
 * fires across the whole corpus — for a reason no renderer change caused. The plan specified a
 * mask-only promote for technique 4b and would have gone red exactly that way.
 */
const REPORT = process.argv.includes('--report')
  ? process.argv[process.argv.indexOf('--report') + 1]!
  : 'output/verification/visual-polish/capture/renderer-capture-report.json';
// `--collection` exists so the guards below can be exercised against a temporary corpus in a
// test, rather than only against the real one where a failure would mean damaged evidence.
const COLLECTION = process.argv.includes('--collection')
  ? process.argv[process.argv.indexOf('--collection') + 1]!
  : 'tests/fixtures/rendering/threejs-all-maps-v1.json';

type Report = Readonly<{ testedCommit: string }>;
const report = JSON.parse(readFileSync(resolve(REPORT), 'utf8')) as Report;
if (!/^[a-f0-9]{40}$/u.test(report.testedCommit)) {
  throw new Error(`The capture report has no usable tested commit: ${report.testedCommit}`);
}

const collection = JSON.parse(readFileSync(resolve(COLLECTION), 'utf8')) as {
  sourceCommit: string;
  fixtures: readonly Readonly<{ id: string; manifest: string }>[];
};

let promotedImages = 0;
let promotedMasks = 0;

for (const entry of collection.fixtures) {
  const manifestPath = resolve(entry.manifest);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown> & {
    baseline: { image: string; masks: string };
    candidate: { image: string; masks: string };
  };

  const candidateImage = resolve(manifest.candidate.image);
  const baselineImage = resolve(manifest.baseline.image);
  if (!existsSync(candidateImage)) throw new Error(`${entry.id}: no candidate image to promote.`);
  if (candidateImage === baselineImage) {
    throw new Error(`${entry.id}: baseline and candidate images are the same file, so a promote would prove nothing.`);
  }
  copyFileSync(candidateImage, baselineImage);
  promotedImages += 1;

  // Before phase 0.2 wires the emitter, both sides name one frozen mask file. There is nothing to
  // promote in that case, and copying a file onto itself would be a silent no-op dressed as work.
  const candidateMasks = resolve(manifest.candidate.masks);
  const baselineMasks = resolve(manifest.baseline.masks);
  if (candidateMasks !== baselineMasks) {
    if (!existsSync(candidateMasks)) throw new Error(`${entry.id}: no candidate mask frame to promote.`);
    copyFileSync(candidateMasks, baselineMasks);
    promotedMasks += 1;
  }

  manifest.sourceCommit = report.testedCommit;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flush: true });
}

if (promotedImages === 0) throw new Error('Nothing was promoted, so the next comparison would be stale.');

collection.sourceCommit = report.testedCommit;
writeFileSync(resolve(COLLECTION), `${JSON.stringify(collection, null, 2)}\n`, { encoding: 'utf8', flush: true });

process.stdout.write(
  `Promoted ${promotedImages} baseline images and ${promotedMasks} mask frames ` +
  `at ${report.testedCommit.slice(0, 8)}.\n`,
);
