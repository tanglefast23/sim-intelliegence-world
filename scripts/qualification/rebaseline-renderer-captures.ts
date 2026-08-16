import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Retire the frozen Skia baselines as a reference, without destroying them.
 *
 * Every live baseline was a Skia capture. Skia is gone, so those frames can never be re-taken and
 * the corpus was measuring drift from a renderer that no longer exists. Item 5.1 was implemented,
 * measured and reverted against exactly that reference, at mean 1.456 versus a limit of 1: not
 * because the change was wrong, but because a sub-pixel shift permanently spends threshold budget
 * against a fixed reference nobody can refresh.
 *
 * This re-points the live corpus at the renderer that actually ships. The Skia PNGs stay exactly
 * where they are, under a directory that is now write-protected, unreferenced.
 *
 * ONE-TIME MIGRATION. Use `capture:promote` to move a baseline forward after a technique lands.
 * Re-running this would retarget paths that are already correct.
 */
const REPORT = process.argv.includes('--report')
  ? process.argv[process.argv.indexOf('--report') + 1]!
  : 'output/verification/visual-polish/capture/renderer-capture-report.json';

/** Outside `artifacts/threejs-2d`, which commit 0.0 made immutable. */
const BASELINE_ROOT = 'artifacts/visual-polish/baseline';
const COLLECTION = 'tests/fixtures/rendering/threejs-all-maps-v1.json';

type Fixture = Readonly<{ id: string; screenshot: string }>;
type Report = Readonly<{
  testedCommit: string;
  passes: Readonly<{ threejs2d: Readonly<{ fixtures: readonly Fixture[] }> }>;
}>;

const report = JSON.parse(readFileSync(resolve(REPORT), 'utf8')) as Report;
const captureRoot = dirname(resolve(REPORT));

if (!/^[a-f0-9]{40}$/u.test(report.testedCommit)) {
  throw new Error(`The capture report has no usable tested commit: ${report.testedCommit}`);
}

function findCapture(root: string, name: string): string | undefined {
  if (!existsSync(root)) return undefined;
  const direct = join(root, name);
  if (existsSync(direct)) return direct;
  for (const entry of readdirSync(root)) {
    const candidate = join(root, entry);
    if (!statSync(candidate).isDirectory()) continue;
    const found = findCapture(candidate, name);
    if (found) return found;
  }
  return undefined;
}

const collection = JSON.parse(readFileSync(resolve(COLLECTION), 'utf8')) as {
  sourceCommit: string;
  fixtures: readonly Readonly<{ id: string; manifest: string }>[];
};
const captured = new Map(report.passes.threejs2d.fixtures.map((fixture) => [fixture.id, fixture]));

const missing = collection.fixtures.filter(({ id }) => !captured.has(id)).map(({ id }) => id);
if (missing.length > 0) {
  throw new Error(`The capture did not reach these live fixtures: ${missing.join(', ')}.`);
}

mkdirSync(resolve(BASELINE_ROOT), { recursive: true });

for (const entry of collection.fixtures) {
  const fixture = captured.get(entry.id)!;
  const source = findCapture(join(captureRoot, 'threejs-2d'), fixture.screenshot);
  if (!source) throw new Error(`Capture is missing for ${fixture.id}: ${fixture.screenshot}`);

  const manifestPath = resolve(entry.manifest);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown> & {
    baseline: { image: string; masks: string };
    candidate: { image: string; masks: string };
  };

  // 1. RETARGET FIRST, before any copy.
  //
  // `refresh-candidate-captures.ts` writes to wherever `candidate.image` points and never calls
  // `resolveEvidenceOutputRoot`, so the immutability guard cannot stop it. While the manifests
  // still pointed inside `artifacts/threejs-2d`, a refresh would have overwritten the Skia-era
  // files this program exists to preserve. Retargeting both sides first closes that window.
  const baselineImage = `${BASELINE_ROOT}/${entry.id}-baseline.png`;
  const candidateImage = `${BASELINE_ROOT}/${entry.id}-candidate.png`;
  manifest.baseline = { ...manifest.baseline, image: baselineImage };
  manifest.candidate = { ...manifest.candidate, image: candidateImage };

  // 2. Write the baseline bytes. `capture:refresh` only ever writes a candidate, so nothing else
  // in the repository can produce a baseline.
  mkdirSync(dirname(resolve(baselineImage)), { recursive: true });
  copyFileSync(source, resolve(baselineImage));
  copyFileSync(source, resolve(candidateImage));

  // 3. The tested commit comes from the capture run. A manifest cannot carry the hash of the
  // commit that adds it.
  manifest.sourceCommit = report.testedCommit;

  // 4. Both sides now come from the same compositing path, so the flag that recorded a moved layer
  // is no longer true. Leaving it set would keep the Skia-era relaxations and throw away the
  // precision this re-baseline buys: exact native readable-set identity and the mask-local family.
  manifest.compositingChanged = false;

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flush: true });
}

// The set manifest carries its own commit and the comparator throws when a nested fixture
// disagrees with it, so one side alone is not a smaller change: it is a broken collection.
collection.sourceCommit = report.testedCommit;
writeFileSync(resolve(COLLECTION), `${JSON.stringify(collection, null, 2)}\n`, { encoding: 'utf8', flush: true });

process.stdout.write(
  `Re-baselined ${collection.fixtures.length} live fixtures at ${report.testedCommit.slice(0, 8)}.\n` +
  `The frozen Skia captures are untouched and no longer referenced.\n`,
);
