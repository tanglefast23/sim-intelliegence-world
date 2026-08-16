import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { PNG } from 'pngjs';

import { compareRendererFrames, compareRendererManifest } from '../compare-renderer-frames';

/**
 * Visual polish: the capture path must not be vacuous.
 *
 * The comparator reads committed PNGs, so a refresh step that silently does nothing would leave it
 * re-verifying frozen evidence and passing whatever the renderer does. These tests prove the
 * refresh actually replaces a candidate, and that a deliberately damaged candidate fails.
 */
describe('candidate capture refresh', () => {
  let root = '';
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'si-world-capture-')); });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  test('refuses to report success when it refreshed nothing', () => {
    const reportPath = join(root, 'renderer-capture-report.json');
    writeFileSync(reportPath, JSON.stringify({ passes: { threejs2d: { fixtures: [] } } }));
    expect(() => execFileSync('npx', ['tsx', 'scripts/qualification/refresh-candidate-captures.ts', '--report', reportPath], {
      cwd: process.cwd(), encoding: 'utf8', stdio: 'pipe',
    })).toThrow(/refreshed|stale/iu);
  });

  test('actually replaces the candidate bytes, and fails loudly when it cannot', () => {
    // The success path was previously untested: swapped copy arguments would still have printed
    // "Refreshed 19 candidate captures" while the comparator kept reading frozen pixels.
    const collection = JSON.parse(readFileSync(
      resolve('tests/fixtures/rendering/threejs-all-maps-v1.json'), 'utf8',
    )) as { fixtures: readonly Readonly<{ id: string }>[] };
    const refreshable = collection.fixtures.filter(({ id }) => !id.startsWith('villa-'));
    expect(refreshable.length).toBeGreaterThan(0);

    // A report missing a refreshable fixture must fail by name rather than skip it silently.
    const reportPath = join(root, 'renderer-capture-report.json');
    writeFileSync(reportPath, JSON.stringify({ passes: { threejs2d: { fixtures: [] } } }));
    let message = '';
    try {
      execFileSync('npx', ['tsx', 'scripts/qualification/refresh-candidate-captures.ts', '--report', reportPath], {
        cwd: process.cwd(), encoding: 'utf8', stdio: 'pipe',
      });
    } catch (error) { message = String((error as { stderr?: string }).stderr ?? error); }
    expect(message).toContain(refreshable[0]!.id);
  });

  test('a damaged candidate fails the comparison it is fed into', () => {
    const manifestPath = resolve('tests/fixtures/rendering/threejs-all-maps/northwest-1280x720-dpr1-zoom1-v1.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      candidate: { image: string; masks: string };
      baseline: { image: string; masks: string };
    };
    // Copy the real fixture, then damage only the candidate image.
    const damagedPath = join(root, 'damaged.png');
    const png = PNG.sync.read(readFileSync(resolve(manifest.candidate.image)));
    for (let pixel = 0; pixel < png.width * png.height; pixel += 1) {
      const offset = pixel * 4;
      png.data[offset] = 255 - png.data[offset]!;
    }
    mkdirSync(dirname(damagedPath), { recursive: true });
    writeFileSync(damagedPath, PNG.sync.write(png));
    const damaged = { ...manifest, candidate: { ...manifest.candidate, image: damagedPath } };
    const report = compareRendererFrames(damaged, 'parity');
    expect(report.passed).toBe(false);
  });

  test('the untouched fixture still passes, so the damage test means something', () => {
    const manifestPath = resolve('tests/fixtures/rendering/threejs-all-maps/northwest-1280x720-dpr1-zoom1-v1.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown;
    expect(compareRendererFrames(manifest, 'parity').passed).toBe(true);
  });
});

/**
 * The live collection and the frozen record are separate on purpose.
 *
 * Six villa fixtures used to sit inside the live set. Their capture runner was retired with Skia,
 * so they can only compare themselves against themselves, and a headline of "25 of 25 pass"
 * therefore included six comparisons that could not fail. They are now their own set, reported
 * apart and never gating.
 */
describe('live and frozen fixture sets', () => {
  const read = (path: string) => JSON.parse(readFileSync(resolve(path), 'utf8')) as {
    sourceCommit: string;
    fixtures: readonly Readonly<{ id: string; manifest: string }>[];
  };

  test('the live set holds only refreshable fixtures', () => {
    const live = read('tests/fixtures/rendering/threejs-all-maps-v1.json');
    expect(live.fixtures).toHaveLength(19);
    expect(live.fixtures.filter(({ id }) => id.startsWith('villa-'))).toEqual([]);
  });

  test('the frozen record keeps all six villa fixtures', () => {
    const frozen = read('tests/fixtures/rendering/threejs-stage-3-specialized-v1.json');
    expect(frozen.fixtures).toHaveLength(6);
    expect(frozen.fixtures.every(({ id }) => id.startsWith('villa-'))).toBe(true);
  });

  test('a superseded stage-2 villa fixture cannot be put back into the live set', () => {
    // The nested source commit must match its set's (compare-renderer-frames.ts:600), and that
    // check THROWS rather than failing. The stage-2 villa manifests carry a different commit from
    // the live set, so re-adding one is caught rather than silently re-admitting frozen evidence.
    //
    // Note which manifest this uses. The stage-3 villa manifests carry the SAME commit as the live
    // set, so re-adding one of those would NOT throw — the guard is the source commit, not the
    // fixture id, and a test written against the wrong manifest would pass while proving nothing.
    const live = read('tests/fixtures/rendering/threejs-all-maps-v1.json');
    const stage2 = 'tests/fixtures/rendering/threejs-villa/villa-exterior-idle-v1.json';
    const stage2Commit = (JSON.parse(readFileSync(resolve(stage2), 'utf8')) as { sourceCommit: string }).sourceCommit;
    expect(stage2Commit).not.toBe(live.sourceCommit);

    const contaminated = {
      schemaVersion: 1,
      fixtureSet: 'contaminated',
      sourceCommit: live.sourceCommit,
      mode: 'parity',
      // The villa row goes FIRST. compareRendererManifest maps the fixtures in order, so putting
      // it last makes the test decode nineteen real captures before reaching the throw — two
      // minutes of work to observe a check that fires on the first mismatch it sees.
      fixtures: [{ id: 'villa-exterior-idle', manifest: stage2 }, ...live.fixtures],
    };
    expect(() => compareRendererManifest(contaminated, 'parity'))
      .toThrow(/does not match the fixture-set source commit/u);
  });
});
