import { createRendererReadyReport } from '../RendererReadiness';

const completeMeasurements = {
  appUrl: 'app://game/',
  assetsLoaded: true,
  bridgeKeys: ['getRuntimeInfo', 'reportRendererReady'],
  canvasHeight: 160,
  canvasWidth: 320,
  nodeAccessBlocked: true,
} as const;

describe('renderer readiness measurements', () => {
  test('creates the closed report only after all measurements pass', () => {
    expect(createRendererReadyReport(completeMeasurements)).toEqual({
      appUrl: 'app://game/',
      assetsLoaded: true,
      bridgeKeys: ['getRuntimeInfo', 'reportRendererReady'],
      canvasKitReady: true,
      nodeAccessBlocked: true,
    });
  });

  test.each([
    { ...completeMeasurements, assetsLoaded: false },
    { ...completeMeasurements, canvasWidth: 0 },
    { ...completeMeasurements, nodeAccessBlocked: false },
    { ...completeMeasurements, appUrl: 'https://example.com/' },
    { ...completeMeasurements, bridgeKeys: ['getRuntimeInfo'] },
  ])('rejects incomplete or untrusted measurements', (measurements) => {
    expect(() => createRendererReadyReport(measurements)).toThrow();
  });
});
