import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Asset } from 'expo-asset';

import type { WorldFrameState } from './world-frame';
import { ThreeWorldRenderer } from './three/world-renderer';

const atlasImage = require('../../assets/generated/world-atlas.png') as number;

export function ThreeWorldSurface({
  frame,
  onContextStateChange,
  onReady,
}: Readonly<{
  frame: WorldFrameState;
  onContextStateChange: (state: 'lost' | 'restored' | 'timed-out') => void;
  onReady: () => void;
}>) {
  const frameRef = useRef(frame);
  const rendererRef = useRef<ThreeWorldRenderer | undefined>(undefined);
  const onReadyRef = useRef(onReady);
  const onContextStateChangeRef = useRef(onContextStateChange);
  frameRef.current = frame;
  onReadyRef.current = onReady;
  onContextStateChangeRef.current = onContextStateChange;

  useEffect(() => {
    const host = document.querySelector('#threejs-world-canvas');
    if (!(host instanceof HTMLElement)) throw new Error('Three.js canvas host is missing.');
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label', 'Three.js 2D world canvas');
    canvas.style.display = 'block';
    canvas.style.height = '100%';
    canvas.style.width = '100%';
    host.append(canvas);
    let disposed = false;
    const local = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const matchLegacyColors = window.siWorldSmokeMode === true || local;
    void ThreeWorldRenderer.create(
      canvas,
      Asset.fromModule(atlasImage).uri,
      matchLegacyColors,
      () => onReadyRef.current(),
      (state) => onContextStateChangeRef.current(state),
    ).then((renderer) => {
      if (disposed) {
        renderer.dispose();
        return;
      }
      rendererRef.current = renderer;
      renderer.setFrame(frameRef.current);
      renderer.start();
      if (window.siWorldSmokeMode === true || local) window.siWorldThreeRendererEvidence = () => renderer.evidence();
    }).catch((error: unknown) => {
      if (!disposed) onContextStateChangeRef.current('timed-out');
      console.error(`SI_WORLD_THREE_RENDERER_FAILURE ${error instanceof Error ? error.message : String(error)}`);
    });
    return () => {
      disposed = true;
      delete window.siWorldThreeRendererEvidence;
      rendererRef.current?.dispose();
      rendererRef.current = undefined;
      canvas.remove();
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.setFrame(frame);
  }, [frame]);

  return <View nativeID="threejs-world-canvas" pointerEvents="none" style={styles.canvas} />;
}

const styles = StyleSheet.create({
  canvas: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
});
