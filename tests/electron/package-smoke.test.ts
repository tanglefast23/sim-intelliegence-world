import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  evaluateRendererFps,
  findPackageArchive,
  findPackagedExecutable,
  parseSmokeResult,
  validatePackageListing,
  validateScreenshotBuffers,
  validateWorldZoomBuffers,
} from '../../scripts/electron/package-smoke-utils';
import { resolveEvidenceOutputRoot } from '../../scripts/verification/evidence-output';
import { PNG } from 'pngjs';

import {
  captureLoadingSmokeFrame,
  captureNonEmptySmokeFrame,
  retrySmokeCapture,
  SMOKE_CAPTURE_RETRY_MILLISECONDS,
} from '../../electron/main/smoke-capture';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function screenshot(width: number, height: number, fill: number): Buffer {
  const png = new PNG({ width, height });
  png.data.fill(fill);
  return PNG.sync.write(png);
}

describe('packaged Electron smoke evidence', () => {
  test('uses explicit output roots and rejects immutable historical evidence', () => {
    const root = join(tmpdir(), 'si-world-evidence-root');
    expect(resolveEvidenceOutputRoot([], { defaultRelative: 'output/verification/package' }, root))
      .toBe(join(root, 'output/verification/package'));
    expect(resolveEvidenceOutputRoot(
      ['--high-dpi', '--output-root', 'artifacts/phase-24/art-quality/phase-26-foundation'],
      { allowedFlags: ['--high-dpi'] },
      root,
    )).toBe(join(root, 'artifacts/phase-24/art-quality/phase-26-foundation'));
    expect(() => resolveEvidenceOutputRoot(
      ['--output-root', 'artifacts/phase-22/responsive'],
      {},
      root,
    )).toThrow('Historical evidence is immutable');
    expect(() => resolveEvidenceOutputRoot(
      ['artifacts/phase-24/new'],
      {},
      root,
    )).toThrow('Use --output-root');
    expect(() => resolveEvidenceOutputRoot([], { required: true }, root)).toThrow('requires --output-root');
  });

  test('passes the high-DPI scale factor on the packaged process command line', () => {
    const responsiveSmoke = readFileSync(
      join(process.cwd(), 'scripts/electron/run-responsive-package-smoke.ts'),
      'utf8',
    );
    expect(responsiveSmoke).toContain("highDpi ? ['--force-device-scale-factor=2'] : []");
  });

  test('selects the current platform and architecture from a multi-target output root', () => {
    const root = mkdtempSync(join(tmpdir(), 'si-world-package-targets-'));
    try {
      const armExecutable = join(root, 'SI World-darwin-arm64', 'SI World.app', 'Contents', 'MacOS', 'si-world');
      const x64Executable = join(root, 'SI World-darwin-x64', 'SI World.app', 'Contents', 'MacOS', 'si-world');
      const armArchive = join(root, 'SI World-darwin-arm64', 'SI World.app', 'Contents', 'Resources', 'app.asar');
      const x64Archive = join(root, 'SI World-darwin-x64', 'SI World.app', 'Contents', 'Resources', 'app.asar');
      for (const file of [armExecutable, x64Executable, armArchive, x64Archive]) {
        mkdirSync(join(file, '..'), { recursive: true });
        writeFileSync(file, 'fixture');
      }
      expect(findPackagedExecutable(root, 'darwin', 'arm64')).toBe(armExecutable);
      expect(findPackagedExecutable(root, 'darwin', 'x64')).toBe(x64Executable);
      expect(findPackageArchive(root, 'darwin', 'arm64')).toBe(armArchive);
      expect(findPackageArchive(root, 'darwin', 'x64')).toBe(x64Archive);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  test('retries transient screenshot failures but keeps a bounded failure', async () => {
    let attempts = 0;
    const waits: number[] = [];
    await expect(retrySmokeCapture(
      async () => {
        attempts += 1;
        if (attempts < 3) throw new Error('UnknownVizError');
        return 'captured';
      },
      async (milliseconds) => { waits.push(milliseconds); },
    )).resolves.toBe('captured');
    expect(attempts).toBe(3);
    expect(waits).toEqual([SMOKE_CAPTURE_RETRY_MILLISECONDS, SMOKE_CAPTURE_RETRY_MILLISECONDS]);

    let failedAttempts = 0;
    await expect(retrySmokeCapture(
      async () => {
        failedAttempts += 1;
        throw new Error('permanent');
      },
      async () => undefined,
      { maximumAttempts: 2 },
    )).rejects.toThrow('failed after 2 attempts');
    expect(failedAttempts).toBe(2);
  });

  test('rejects empty frames and never accepts a late non-loading frame', async () => {
    let emptyAttempts = 0;
    await expect(captureNonEmptySmokeFrame(
      async () => ({ isEmpty: () => ++emptyAttempts < 3 }),
      async () => undefined,
    )).resolves.toEqual(expect.objectContaining({ isEmpty: expect.any(Function) }));
    expect(emptyAttempts).toBe(3);

    await expect(captureNonEmptySmokeFrame(
      async () => ({ isEmpty: () => true }),
      async () => undefined,
      { maximumAttempts: 2 },
    )).rejects.toThrow('Electron returned an empty screenshot');

    let loading = true;
    let captureAttempts = 0;
    await expect(captureLoadingSmokeFrame(
      async () => {
        captureAttempts += 1;
        loading = false;
        throw new Error('UnknownVizError');
      },
      async () => loading,
      async () => undefined,
      { maximumAttempts: 3 },
    )).rejects.toThrow('Loading shell is no longer visible');
    expect(captureAttempts).toBe(1);

    const loadingChecks = [true, false];
    await expect(captureLoadingSmokeFrame(
      async () => ({ isEmpty: () => false }),
      async () => loadingChecks.shift() ?? false,
      async () => undefined,
      { maximumAttempts: 1 },
    )).rejects.toThrow('Loading shell changed during screenshot capture');

    await expect(captureLoadingSmokeFrame(
      async () => ({ isEmpty: () => false }),
      async () => true,
      async () => undefined,
      { maximumAttempts: 1 },
    )).resolves.toEqual(expect.objectContaining({ isEmpty: expect.any(Function) }));
  });

  test('stops retries when the caller deadline expires', async () => {
    let now = 0;
    let attempts = 0;
    const waits: number[] = [];
    await expect(retrySmokeCapture(
      async () => {
        attempts += 1;
        now = 500;
        throw new Error('capture failed');
      },
      async (milliseconds) => { waits.push(milliseconds); },
      { deadlineMilliseconds: 400, now: () => now },
    )).rejects.toThrow('failed after 1 attempt');
    expect(attempts).toBe(1);
    expect(waits).toEqual([]);
  });

  test('keeps renderer FPS qualification strict while recording hosted shell measurements', () => {
    expect(evaluateRendererFps(60)).toEqual(expect.objectContaining({
      profile: 'qualification', thresholdPassed: true, thresholdRequired: true,
    }));
    expect(() => evaluateRendererFps(19.99)).toThrow('rounded 60 FPS');
    expect(evaluateRendererFps(19.99, 'platform-shell')).toEqual(expect.objectContaining({
      measuredFps: 19.99, profile: 'platform-shell', thresholdPassed: false, thresholdRequired: false,
    }));
    expect(() => evaluateRendererFps('unknown', 'platform-shell')).toThrow('measurement is invalid');
    expect(() => evaluateRendererFps(60, 'weakened')).toThrow('Unknown package smoke profile');
  });

  test('accepts one complete renderer readiness report', () => {
    const stdout = [
      'startup',
      `SI_WORLD_SMOKE_RESULT ${JSON.stringify({
        appUrl: 'app://game/',
        assetsLoaded: true,
        bridgeKeys: [
        'abortConversation', 'beginConversation', 'endConversation', 'getRuntimeInfo',
        'loadPresentationPreferences', 'loadSave', 'migrateSave', 'reportRendererReady', 'requestSave',
        'savePresentationPreferences', 'sendConversationTurn',
        ],
        canvasKitReady: true,
        nodeAccessBlocked: true,
      })}`,
    ].join('\n');

    expect(parseSmokeResult(stdout)).toEqual(
      expect.objectContaining({
        assetsLoaded: true,
        canvasKitReady: true,
        nodeAccessBlocked: true,
      }),
    );
  });

  test('rejects missing or weakened proof', () => {
    expect(() => parseSmokeResult('startup only')).toThrow('did not emit');
    expect(() =>
      parseSmokeResult(
        `SI_WORLD_SMOKE_RESULT ${JSON.stringify({
          appUrl: 'app://game/',
          assetsLoaded: true,
          bridgeKeys: [
            'abortConversation', 'beginConversation', 'endConversation', 'getRuntimeInfo',
            'loadPresentationPreferences', 'loadSave', 'migrateSave', 'reportRendererReady', 'requestSave',
            'savePresentationPreferences', 'sendConversationTurn',
          ],
          canvasKitReady: false,
          nodeAccessBlocked: true,
        })}`,
      ),
    ).toThrow();
    expect(() =>
      parseSmokeResult(
        `SI_WORLD_SMOKE_RESULT ${JSON.stringify({
          appUrl: 'https://example.com/',
          assetsLoaded: true,
          bridgeKeys: [
            'abortConversation', 'beginConversation', 'endConversation', 'getRuntimeInfo',
            'loadPresentationPreferences', 'loadSave', 'migrateSave', 'reportRendererReady', 'requestSave',
            'savePresentationPreferences', 'sendConversationTurn',
          ],
          canvasKitReady: true,
          nodeAccessBlocked: true,
        })}`,
      ),
    ).toThrow('untrusted renderer URL');
  });

  test('requires runtime files and rejects project-source leaks', () => {
    const requiredListing = [
      '/build/electron/main/index.js',
      '/build/electron/main/smoke-capture.js',
      '/build/electron/preload/index.js',
      '/build/electron/persistence/save-repository.js',
      '/build/src/domain/state/schema.js',
      '/dist/canvaskit.wasm',
      '/dist/index.html',
      '/dist/assets/assets/proof/phase2-atlas.abc123.png',
      '/dist/assets/assets/proof/phase2-tone.abc123.wav',
      '/dist/assets/assets/generated/world-atlas.abc123.png',
      '/dist/assets/assets/generated/audio/greeting.abc123.wav',
      '/dist/assets/assets/generated/audio/laugh.abc123.wav',
      '/dist/assets/assets/generated/audio/sigh.abc123.wav',
      '/dist/assets/assets/generated/audio/consequence.abc123.wav',
      '/dist/assets/node_modules/@expo-google-fonts/silkscreen/400Regular/Silkscreen_400Regular.abc123.ttf',
      '/node_modules/zod/package.json',
    ].join('\n');
    expect(() => validatePackageListing(requiredListing)).not.toThrow();
    expect(() => validatePackageListing(requiredListing.replaceAll('/', '\\'))).not.toThrow();
    expect(() => validatePackageListing(`${requiredListing}\n/src/domain/prng.ts`)).toThrow(
      'excluded source',
    );
    expect(() => validatePackageListing(requiredListing.replace('/dist/index.html\n', ''))).toThrow(
      'missing /dist/index.html',
    );
    expect(() => validatePackageListing(
      requiredListing.replace('/build/electron/main/smoke-capture.js\n', ''),
    )).toThrow('missing /build/electron/main/smoke-capture.js');
    expect(() => validatePackageListing(requiredListing.replace(/\/dist\/assets\/assets\/proof\/phase2-atlas[^\n]+\n/u, ''))).toThrow(
      'missing required resource',
    );
  });

  test('requires two distinct non-empty PNG screenshots', () => {
    const loading = screenshot(640, 360, 1);
    const ready = screenshot(640, 360, 2);

    expect(() => validateScreenshotBuffers(loading, ready)).not.toThrow();
    expect(loading.byteLength).toBeLessThan(4_096);
    expect(() => validateScreenshotBuffers(Buffer.alloc(20), ready)).toThrow('not a PNG');
    expect(() => validateScreenshotBuffers(
      Buffer.concat([PNG_SIGNATURE, Buffer.from('invalid')]),
      ready,
    )).toThrow('not a valid PNG');
    expect(() => validateScreenshotBuffers(screenshot(320, 180, 1), ready)).toThrow(
      'dimensions are too small',
    );
    expect(() => validateScreenshotBuffers(screenshot(800, 450, 1), ready)).toThrow(
      'dimensions do not match',
    );
    expect(() => validateScreenshotBuffers(
      screenshot(800, 450, 1),
      ready,
      { requireSameDimensions: false },
    )).not.toThrow();
    expect(() => validateScreenshotBuffers(loading, loading)).toThrow('identical');
  });

  test('requires three distinct world zoom PNG screenshots', () => {
    const zooms = [1, 2, 3].map((fill) => screenshot(640, 360, fill));
    expect(() => validateWorldZoomBuffers(zooms)).not.toThrow();
    expect(() => validateWorldZoomBuffers(zooms.slice(0, 2))).toThrow('exactly three');
    expect(() => validateWorldZoomBuffers([
      screenshot(320, 180, 1), zooms[1]!, zooms[2]!,
    ])).toThrow('dimensions are too small');
    expect(() => validateWorldZoomBuffers([
      Buffer.concat([PNG_SIGNATURE, Buffer.from('invalid')]), zooms[1]!, zooms[2]!,
    ])).toThrow('not a valid PNG');
    expect(() => validateWorldZoomBuffers([
      screenshot(800, 450, 1), zooms[1]!, zooms[2]!,
    ])).toThrow('dimensions do not match');
    expect(() => validateWorldZoomBuffers([zooms[0]!, zooms[0]!, zooms[2]!])).toThrow('must be distinct');
  });
});
