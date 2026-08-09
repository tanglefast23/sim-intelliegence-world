import type { RendererReadyReport } from '../../electron/ipc/contracts';

const EXPECTED_BRIDGE_KEYS = ['getRuntimeInfo', 'reportRendererReady'] as const;

export type RendererReadinessMeasurements = Readonly<{
  appUrl: string;
  assetsLoaded: boolean;
  bridgeKeys: readonly string[];
  canvasHeight: number;
  canvasWidth: number;
  nodeAccessBlocked: boolean;
}>;

export function createRendererReadyReport(
  measurements: RendererReadinessMeasurements,
): RendererReadyReport {
  if (measurements.appUrl !== 'app://game/') {
    throw new Error('Renderer is not at the packaged app root.');
  }
  if (!measurements.assetsLoaded) {
    throw new Error('Packaged renderer assets are not ready.');
  }
  if (measurements.canvasWidth <= 0 || measurements.canvasHeight <= 0) {
    throw new Error('CanvasKit did not create a measurable canvas.');
  }
  if (!measurements.nodeAccessBlocked) {
    throw new Error('A Node global is visible in the renderer.');
  }
  if (
    measurements.bridgeKeys.length !== EXPECTED_BRIDGE_KEYS.length ||
    !EXPECTED_BRIDGE_KEYS.every((key, index) => measurements.bridgeKeys[index] === key)
  ) {
    throw new Error('Desktop bridge surface does not match the locked contract.');
  }

  return {
    appUrl: measurements.appUrl,
    assetsLoaded: true,
    bridgeKeys: [...EXPECTED_BRIDGE_KEYS],
    canvasKitReady: true,
    nodeAccessBlocked: true,
  };
}
