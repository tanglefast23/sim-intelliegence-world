import { Canvas, Rect } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';

import { GameScreen } from '../application/GameScreen';
import { getDesktopBridge } from '../application/DesktopBridge';
import { createRendererReadyReport } from '../application/RendererReadiness';
import { DevHarnessScreen } from '../ui/dev-harness/DevHarnessScreen';
import { coalescedResizeDelay, OUTER_MARGIN, responsiveSurface, SURFACE_BORDER } from './responsive-layout';
import type { ViewportSize } from './camera';

function hasNoNodeAccess(): boolean {
  const candidate = globalThis as typeof globalThis & {
    Buffer?: unknown;
    module?: unknown;
    require?: unknown;
  };
  return (
    typeof candidate.require === 'undefined' &&
    typeof candidate.module === 'undefined' &&
    typeof candidate.Buffer === 'undefined'
  );
}

function localhostDevHarnessMode(): boolean {
  if (typeof window === 'undefined') return false;
  const localHost = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
  return localHost && new URLSearchParams(window.location.search).get('devHarness') === '1';
}

type SkiaProofProps = Readonly<{
  assetsLoaded: boolean;
}>;

function afterNextPaint(): Promise<void> {
  return new Promise((resolvePaint) => requestAnimationFrame(() => resolvePaint()));
}

async function afterTwoPaints(): Promise<void> {
  await afterNextPaint();
  await afterNextPaint();
}

export default function SkiaProof({ assetsLoaded }: SkiaProofProps) {
  const devHarnessMode = typeof window !== 'undefined' && (
    window.siWorldDevHarnessMode === true || localhostDevHarnessMode()
  );
  const windowDimensions = useWindowDimensions();
  const expectedSurface = useMemo(
    () => responsiveSurface(windowDimensions.width, windowDimensions.height).surface,
    [windowDimensions.height, windowDimensions.width],
  );
  const [surface, setSurface] = useState<ViewportSize>(expectedSurface);
  const [runtime, setRuntime] = useState('Browser proof');
  const [gameReady, setGameReady] = useState(false);
  const markGameReady = useCallback(() => setGameReady(true), []);

  useEffect(() => {
    if (devHarnessMode) markGameReady();
  }, [devHarnessMode, markGameReady]);

  useEffect(() => {
    if (!gameReady) {
      return;
    }
    const bridge = getDesktopBridge();
    if (!bridge) {
      return;
    }
    void afterTwoPaints()
      .then(async () => {
        const canvasHost = document.querySelector('#world-canvas') ?? document.querySelector('#active-surface-canvas');
        const identifiedCanvas = canvasHost instanceof HTMLCanvasElement
          ? canvasHost
          : canvasHost?.querySelector<HTMLCanvasElement>('canvas');
        const canvas = identifiedCanvas ?? [...document.querySelectorAll<HTMLCanvasElement>('canvas')]
          .filter((candidate) => {
            const bounds = candidate.getBoundingClientRect();
            return bounds.width > 0 && bounds.height > 0;
          })
          .sort((left, right) => (
            right.getBoundingClientRect().width * right.getBoundingClientRect().height -
            left.getBoundingClientRect().width * left.getBoundingClientRect().height
          ))[0];
        const report = createRendererReadyReport({
          appUrl: window.location.href,
          assetsLoaded,
          bridgeKeys: Object.keys(window.siWorldDesktop ?? {}).sort(),
          canvasHeight: canvas?.height ?? 0,
          canvasWidth: canvas?.width ?? 0,
          nodeAccessBlocked: hasNoNodeAccess(),
        });
        return Promise.all([bridge.getRuntimeInfo(), bridge.reportRendererReady(report)]);
      })
      .then(([info]) => {
        setRuntime(`Electron ${info.electronVersion} · sandboxed`);
      })
      .catch((error: unknown) => {
        const detail = error instanceof Error ? error.message : String(error);
        setRuntime(`Desktop bridge rejected the readiness proof: ${detail}`);
        console.error(`SI_WORLD_RENDERER_READY_FAILURE ${detail}`);
      });
  }, [assetsLoaded, gameReady]);

  useEffect(() => {
    const timer = setTimeout(() => setSurface(expectedSurface), coalescedResizeDelay());
    return () => clearTimeout(timer);
  }, [expectedSurface]);

  const measureSurface = useCallback((event: LayoutChangeEvent) => {
    const width = Math.max(1, Math.floor(event.nativeEvent.layout.width));
    const height = Math.max(1, Math.floor(event.nativeEvent.layout.height));
    setSurface((current) => current.width === width && current.height === height ? current : { width, height });
  }, []);

  return (
    <View style={styles.screen}>
      <Canvas nativeID="active-surface-canvas" style={StyleSheet.flatten([styles.surfaceCanvas, surface])}>
        <Rect color="#17201b" height={surface.height} width={surface.width} x={0} y={0} />
      </Canvas>
      <View style={styles.surfaceFrame}>
        <View nativeID="active-game-surface" onLayout={measureSurface} style={styles.surface}>
          {devHarnessMode
            ? <DevHarnessScreen surface={surface} />
            : <GameScreen onReady={markGameReady} surface={surface} />}
        </View>
      </View>
      {__DEV__ ? <Text nativeID="development-runtime" style={styles.runtime}>{runtime}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  runtime: {
    color: '#7f9784',
    fontFamily: 'Silkscreen',
    fontSize: 12,
    bottom: 4,
    position: 'absolute',
    right: 12,
  },
  surfaceCanvas: {
    left: OUTER_MARGIN + SURFACE_BORDER,
    position: 'absolute',
    top: OUTER_MARGIN + SURFACE_BORDER,
  },
  screen: {
    alignItems: 'center',
    backgroundColor: '#17201b',
    flex: 1,
    padding: OUTER_MARGIN,
  },
  surface: { flex: 1, minHeight: 1, minWidth: 1, width: '100%' },
  surfaceFrame: {
    borderColor: '#0f1412',
    borderWidth: SURFACE_BORDER,
    flex: 1,
    overflow: 'hidden',
    width: '100%',
  },
});
