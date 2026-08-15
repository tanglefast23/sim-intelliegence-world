import { Canvas, Line, Oval, rect, vec } from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';

import { worldToScreen, type CameraState, type ViewportSize } from './camera';
import type { DistrictLighting } from './district-lighting';

const TILE_SIZE = 32;

function withOpacity(color: string, opacity: number): string {
  const alpha = Math.round(Math.max(0, Math.min(1, opacity)) * 255).toString(16).padStart(2, '0');
  return `${color}${alpha}`;
}

export function DistrictLightingOverlay({
  camera,
  lighting,
  surface,
}: Readonly<{
  camera: CameraState;
  lighting: DistrictLighting;
  surface: ViewportSize;
}>) {
  return (
    <View
      accessibilityLabel={`${lighting.name} district lighting`}
      nativeID="world-district-lighting"
      pointerEvents="none"
      style={styles.overlay}
    >
      <Canvas style={StyleSheet.flatten([styles.canvas, surface])}>
        {lighting.casters.map((caster, index) => {
          const foot = worldToScreen(camera, {
            x: caster.x * TILE_SIZE + TILE_SIZE / 2,
            y: caster.y * TILE_SIZE + TILE_SIZE / 2,
          });
          return (
            <Line
              color={lighting.shadow.color}
              key={`caster-${index}`}
              p1={vec(foot.x, foot.y)}
              p2={vec(foot.x + lighting.shadow.x * camera.zoom * 1.5, foot.y + lighting.shadow.y * camera.zoom * 1.5)}
              strokeCap="round"
              strokeWidth={5 * camera.zoom}
            />
          );
        })}
        {lighting.pools.map((pool, index) => {
          const center = worldToScreen(camera, {
            x: pool.x * TILE_SIZE + TILE_SIZE / 2,
            y: pool.y * TILE_SIZE + TILE_SIZE / 2,
          });
          const radius = pool.radius * camera.zoom;
          return [
            <Oval color={withOpacity(lighting.accent, lighting.poolOpacity * 0.18)} key={`${index}-outer`} rect={rect(center.x - radius * 1.18, center.y - radius * 0.58, radius * 2.36, radius * 1.16)} />,
            <Oval color={withOpacity(lighting.accent, lighting.poolOpacity * 0.45)} key={`${index}-middle`} rect={rect(center.x - radius * 0.72, center.y - radius * 0.34, radius * 1.44, radius * 0.68)} />,
            <Oval color={withOpacity(lighting.accent, lighting.poolOpacity * 0.8)} key={`${index}-inner`} rect={rect(center.x - radius * 0.38, center.y - radius * 0.17, radius * 0.76, radius * 0.34)} />,
          ];
        })}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { left: 0, position: 'absolute', top: 0 },
  overlay: { bottom: 0, left: 0, overflow: 'hidden', position: 'absolute', right: 0, top: 0 },
});
