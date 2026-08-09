import { Canvas, Circle, Group, Rect } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { getDesktopBridge } from '../application/DesktopBridge';
import { createRendererReadyReport } from '../application/RendererReadiness';

const proofAtlas = require('../../assets/proof/phase2-atlas.png') as number;

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

  useEffect(() => {
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
  }, [assetsLoaded]);

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Canvas style={styles.canvas}>
          <Rect color="#314b3b" height={160} width={320} x={0} y={0} />
          <Group>
            <Circle color="#f5dd9d" cx={82} cy={80} r={38} />
            <Circle color="#cf6f4b" cx={160} cy={80} r={38} />
            <Circle color="#82a66c" cx={238} cy={80} r={38} />
          </Group>
        </Canvas>
        <Image accessibilityLabel="Phase 2 atlas proof" source={proofAtlas} style={styles.atlas} />
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        SI World desktop shell
      </Text>
      <Text style={styles.status}>CanvasKit, font, image, and audio resources loaded.</Text>
      <Text style={styles.runtime}>{runtime}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  atlas: {
    height: 96,
    marginLeft: 18,
    width: 96,
  },
  canvas: {
    height: 160,
    width: 320,
  },
  card: {
    alignItems: 'center',
    flexDirection: 'row',
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
    fontSize: 24,
    marginTop: 22,
  },
});
