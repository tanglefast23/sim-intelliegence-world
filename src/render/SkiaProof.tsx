import { Canvas, Rect } from '@shopify/react-native-skia';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GameScreen } from '../application/GameScreen';
import { getDesktopBridge } from '../application/DesktopBridge';
import { createRendererReadyReport } from '../application/RendererReadiness';

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
  const [runtime, setRuntime] = useState('Browser proof');
  const [gameReady, setGameReady] = useState(false);
  const markGameReady = useCallback(() => setGameReady(true), []);

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
        const canvas = document.querySelector('canvas');
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
      .catch(() => {
        setRuntime('Desktop bridge rejected the readiness proof');
      });
  }, [assetsLoaded, gameReady]);

  return (
    <View style={styles.screen}>
      <Canvas style={styles.readinessCanvas}>
        <Rect color="#17201b" height={2} width={2} x={0} y={0} />
      </Canvas>
      <View style={styles.card}>
        <GameScreen onReady={markGameReady} />
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        SI WORLD / THE ISLAND
      </Text>
      <Text style={styles.status}>Click-to-move prototype · four deterministic 64×48 neighborhoods</Text>
      <Text style={styles.runtime}>{runtime}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
  },
  runtime: {
    color: '#7f9784',
    fontFamily: 'Silkscreen',
    fontSize: 12,
    marginTop: 8,
  },
  readinessCanvas: { height: 2, left: 0, opacity: 0, position: 'absolute', top: 0, width: 2 },
  screen: {
    alignItems: 'center',
    backgroundColor: '#17201b',
    flex: 1,
    justifyContent: 'center',
  },
  status: {
    color: '#b8c9b7',
    fontFamily: 'Silkscreen',
    fontSize: 14,
    marginTop: 8,
  },
  title: {
    color: '#f5dd9d',
    fontFamily: 'Silkscreen',
    fontSize: 22,
    marginTop: 12,
  },
});
