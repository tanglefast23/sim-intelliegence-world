import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getDesktopBridge } from '../application/DesktopBridge';
import { createRendererReadyReport } from '../application/RendererReadiness';
import { AtlasProof } from './AtlasProof';

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
  const [atlasReady, setAtlasReady] = useState(false);
  const markAtlasReady = useCallback(() => setAtlasReady(true), []);

  useEffect(() => {
    if (!atlasReady) {
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
  }, [assetsLoaded, atlasReady]);

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <AtlasProof onReady={markAtlasReady} />
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        SI World desktop shell
      </Text>
      <Text style={styles.status}>Generated atlas, CanvasKit, font, and audio resources loaded.</Text>
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
