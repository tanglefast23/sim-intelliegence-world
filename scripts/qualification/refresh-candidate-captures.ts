import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Visual polish: refresh the candidate side of every locked manifest.
 *
 * Stage 7 retired the paired Skia-versus-Three.js runners, and correctly so, but it also removed
 * the only way to give the comparator a fresh capture. Without this the comparator re-reads frozen
 * PNGs and passes whatever the renderer does.
 *
 * This copies newly captured Three.js frames over the candidate images the manifests name. It never
 * touches a baseline: those are frozen Skia captures recording a comparison that can no longer be
 * made, and overwriting one would erase the reference rather than test against it.
 */
const REPORT = process.argv.includes('--report')
  ? process.argv[process.argv.indexOf('--report') + 1]!
  : 'output/verification/visual-polish/capture/renderer-capture-report.json';

type Fixture = Readonly<{ id: string; screenshot: string }>;
type Report = Readonly<{ passes: Readonly<{ threejs2d: Readonly<{ fixtures: readonly Fixture[] }> }> }>;

const report = JSON.parse(readFileSync(resolve(REPORT), 'utf8')) as Report;
const captureRoot = dirname(resolve(REPORT));

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

/**
 * Drive from the comparator collection, not the capture report.
 *
 * Driving from the report hid six villa fixtures that the capture never visits: they were silently
 * skipped, so the comparator kept reading frozen candidates for them and still reported a pass.
 * That is the vacuity this path exists to remove. Anything the capture cannot refresh must be
 * declared here, not discovered by its absence.
 */
const COLLECTION = 'tests/fixtures/rendering/threejs-all-maps-v1.json';

/**
 * The six frozen villa fixtures used to be skipped by name here, because they sat inside the live
 * collection and could not be refreshed. They now live in their own frozen set
 * (`threejs-stage-3-specialized-v1.json`), reported separately by `qualify:renderer:sets`, so the
 * live collection contains only refreshable fixtures and every one of them must refresh.
 *
 * That is the point of the split: a skip list inside a live set is a place for evidence to hide.
 */
const collection = JSON.parse(readFileSync(resolve(COLLECTION), 'utf8')) as {
  fixtures: readonly Readonly<{ id: string; manifest: string }>[];
};
const captured = new Map(report.passes.threejs2d.fixtures.map((fixture) => [fixture.id, fixture]));
const unrefreshed: string[] = [];

let refreshed = 0;
for (const entry of collection.fixtures) {
  const fixture = captured.get(entry.id);
  if (!fixture) { unrefreshed.push(entry.id); continue; }
  const manifestPath = resolve(entry.manifest);
  if (!existsSync(manifestPath)) { unrefreshed.push(entry.id); continue; }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { candidate: { image: string } };
  const destination = resolve(manifest.candidate.image);
  // The runner writes one directory per DPR and VFX mode, so the capture is a level deeper.
  const source = findCapture(join(captureRoot, 'threejs-2d'), fixture.screenshot);
  if (!source) throw new Error(`Capture is missing for ${fixture.id}: ${fixture.screenshot}`);
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  refreshed += 1;
}

if (unrefreshed.length > 0) {
  throw new Error(
    `These fixtures were not refreshed, so the comparison would be stale for them: ${unrefreshed.join(', ')}.`,
  );
}
if (refreshed === 0) throw new Error('No candidate capture was refreshed; the comparison would be stale.');
process.stdout.write(`Refreshed ${refreshed} candidate captures across the live collection.\n`);
