import { createRendererShellReadyReport, createRendererWorldReadyReport } from '../RendererReadiness';

const commonMeasurements = {
  appUrl: 'app://game/',
  assetsLoaded: true,
  bridgeKeys: [
    'abortConversation', 'beginConversation', 'completeVerbalMissionTurn', 'confirmVerbalMissionGoal',
    'endConversation', 'getRuntimeInfo',
    'loadPresentationPreferences', 'loadSave', 'migrateSave', 'readVerbalMissionTurn',
    'reportRendererReady', 'requestSave', 'savePresentationPreferences', 'sendConversationTurn',
  ],
  nodeAccessBlocked: true,
} as const;

describe('renderer readiness measurements', () => {
  test('creates the shell report before a world canvas exists', () => {
    expect(createRendererShellReadyReport(commonMeasurements)).toEqual({
      ...commonMeasurements,
      bridgeKeys: [...commonMeasurements.bridgeKeys],
      schemaVersion: 2,
      phase: 'shell',
      shellReady: true,
    });
  });

  // Stage 7 removed the Skia world variant with CanvasKit itself, so one world report remains.
  test.each([
    {
      rendererKind: 'threejs-2d' as const,
      webgl2Ready: true,
      expected: { rendererKind: 'threejs-2d', webgl2Ready: true },
    },
  ])('creates the strict $rendererKind world report', ({ expected, ...renderer }) => {
    expect(createRendererWorldReadyReport({
      ...commonMeasurements,
      canvasHeight: 160,
      canvasWidth: 320,
      ...renderer,
    })).toEqual({
      ...commonMeasurements,
      bridgeKeys: [...commonMeasurements.bridgeKeys],
      schemaVersion: 2,
      phase: 'world',
      worldFrameReady: true,
      ...expected,
    });
  });

  test.each([
    { ...commonMeasurements, assetsLoaded: false },
    { ...commonMeasurements, nodeAccessBlocked: false },
    { ...commonMeasurements, appUrl: 'https://example.com/' },
    { ...commonMeasurements, bridgeKeys: ['getRuntimeInfo'] },
  ])('rejects incomplete or untrusted shell measurements', (measurements) => {
    expect(() => createRendererShellReadyReport(measurements)).toThrow();
  });

  test('rejects empty canvases and missing WebGL 2', () => {
    expect(() => createRendererWorldReadyReport({
      ...commonMeasurements,
      canvasHeight: 160,
      canvasWidth: 0,
      rendererKind: 'threejs-2d',
    })).toThrow('measurable canvas');
    expect(() => createRendererWorldReadyReport({
      ...commonMeasurements,
      canvasHeight: 160,
      canvasWidth: 320,
      rendererKind: 'threejs-2d',
    })).toThrow('WebGL 2');
  });
});
