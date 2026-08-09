import {
  parseSmokeResult,
  validatePackageListing,
  validateScreenshotBuffers,
} from '../../scripts/electron/package-smoke-utils';

describe('packaged Electron smoke evidence', () => {
  test('accepts one complete renderer readiness report', () => {
    const stdout = [
      'startup',
      `SI_WORLD_SMOKE_RESULT ${JSON.stringify({
        appUrl: 'app://game/',
        assetsLoaded: true,
        bridgeKeys: ['getRuntimeInfo', 'reportRendererReady'],
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
          bridgeKeys: ['getRuntimeInfo', 'reportRendererReady'],
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
          bridgeKeys: ['getRuntimeInfo', 'reportRendererReady'],
          canvasKitReady: true,
          nodeAccessBlocked: true,
        })}`,
      ),
    ).toThrow('untrusted renderer URL');
  });

  test('requires runtime files and rejects project-source leaks', () => {
    const requiredListing = [
      '/build/electron/main/index.js',
      '/build/electron/preload/index.js',
      '/dist/canvaskit.wasm',
      '/dist/index.html',
      '/dist/assets/assets/proof/phase2-atlas.abc123.png',
      '/dist/assets/assets/proof/phase2-tone.abc123.wav',
      '/dist/assets/node_modules/@expo-google-fonts/silkscreen/400Regular/Silkscreen_400Regular.abc123.ttf',
      '/node_modules/zod/package.json',
    ].join('\n');
    expect(() => validatePackageListing(requiredListing)).not.toThrow();
    expect(() => validatePackageListing(`${requiredListing}\n/src/domain/prng.ts`)).toThrow(
      'excluded source',
    );
    expect(() => validatePackageListing(requiredListing.replace('/dist/index.html\n', ''))).toThrow(
      'missing /dist/index.html',
    );
    expect(() => validatePackageListing(requiredListing.replace(/\/dist\/assets\/assets\/proof\/phase2-atlas[^\n]+\n/u, ''))).toThrow(
      'missing required resource',
    );
  });

  test('requires two distinct non-empty PNG screenshots', () => {
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const loading = Buffer.concat([signature, Buffer.alloc(5_000, 1)]);
    const ready = Buffer.concat([signature, Buffer.alloc(5_000, 2)]);

    expect(() => validateScreenshotBuffers(loading, ready)).not.toThrow();
    expect(() => validateScreenshotBuffers(Buffer.alloc(20), ready)).toThrow('too small');
    expect(() => validateScreenshotBuffers(loading, loading)).toThrow('identical');
  });
});
