import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { compareRendererManifest, type RendererFixtureSetReport } from './compare-renderer-frames';

/**
 * The headline renderer qualification.
 *
 * `qualify:renderer` compares ONE manifest and reports one number. That was how six frozen
 * fixtures came to sit inside the live set and be counted in a "25 of 25 pass": the comparator
 * reports whatever its file contains, and the file contained both kinds of evidence.
 *
 * The two kinds cannot be one number. Live fixtures are re-captured from the shipping renderer and
 * a failure there means the renderer changed. Frozen fixtures record a Skia-versus-Three.js
 * comparison that can no longer be made, because Skia is gone and their capture runner was retired
 * with it. They can only ever compare themselves against themselves, so a pass from them says
 * nothing about a new change.
 *
 * This command runs both and prints them apart. Only the live set decides the exit code.
 */
const LIVE = 'tests/fixtures/rendering/threejs-all-maps-v1.json';

/**
 * The surviving frozen record.
 *
 * There were two villa collections holding different evidence, which is why the split needed
 * saying out loud rather than doing quietly:
 *
 * - `threejs-stage-3-specialized-v1.json` — stage-6 captures, source commit 6ec433dd, the same
 *   commit the live set carries. These are the six rows that used to sit inside the live set.
 * - `threejs-villa-v1.json` — stage-2 captures, source commit 701a8fd0. Earlier evidence of the
 *   same six cases, superseded by the stage-6 captures above.
 *
 * The stage-3 set survives as the frozen record. The stage-2 set stays on disk as history and is
 * not run here; reviving either needs a villa capture runner, which does not exist.
 */
const FROZEN = 'tests/fixtures/rendering/threejs-stage-3-specialized-v1.json';

function run(manifestPath: string): RendererFixtureSetReport {
  const manifest = JSON.parse(readFileSync(resolve(process.cwd(), manifestPath), 'utf8')) as unknown;
  const report = compareRendererManifest(manifest, 'parity');
  if (!('fixtures' in report) || !Array.isArray(report.fixtures)) {
    throw new Error(`${manifestPath} is not a fixture set.`);
  }
  return report as RendererFixtureSetReport;
}

function summarize(label: string, report: RendererFixtureSetReport): string {
  const passed = report.fixtures.filter(({ report: fixture }) => fixture.passed).length;
  return `${label}: ${passed} of ${report.fixtures.length} passed`;
}

function main(): void {
  const outputIndex = process.argv.indexOf('--output');
  const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined;

  const live = run(LIVE);
  const frozen = run(FROZEN);

  process.stdout.write(`${summarize('Live', live)}\n`);
  for (const failure of live.failures) process.stdout.write(`  live: ${failure}\n`);
  // Frozen results are printed for the record and never gate. A frozen fixture compares a file
  // against itself, so its pass is not evidence about the current renderer.
  process.stdout.write(`${summarize('Frozen history (not gating)', frozen)}\n`);
  for (const failure of frozen.failures) process.stdout.write(`  frozen: ${failure}\n`);

  if (outputPath) {
    const resolved = resolve(process.cwd(), outputPath);
    mkdirSync(dirname(resolved), { recursive: true });
    writeFileSync(resolved, `${JSON.stringify({ schemaVersion: 1, live, frozen }, null, 2)}\n`, {
      encoding: 'utf8',
      flush: true,
    });
    process.stdout.write(`Wrote ${outputPath}\n`);
  }

  if (!live.passed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
