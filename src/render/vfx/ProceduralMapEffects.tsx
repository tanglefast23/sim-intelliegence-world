import { Path, usePathValue, type SkPathBuilder } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { useSharedValue } from 'react-native-reanimated';

import type { VfxGeometry, VfxPrimitiveRole } from './types';

export const PROCEDURAL_VFX_RENDER_NODE_COUNT = 19 as const;

type VfxCamera = Readonly<{
  x: number;
  y: number;
  zoom: number;
  dpr: number;
}>;

type ProceduralMapEffectsProps = Readonly<{
  camera: VfxCamera;
  colors: Readonly<Record<VfxPrimitiveRole, string>>;
  geometries: readonly VfxGeometry[];
}>;

function addScreenRect(
  builder: SkPathBuilder,
  camera: VfxCamera,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  'worklet';
  const screenX = Math.round((x - camera.x) * camera.zoom * camera.dpr) / camera.dpr;
  const screenY = Math.round((y - camera.y) * camera.zoom * camera.dpr) / camera.dpr;
  builder.addRect({
    x: screenX,
    y: screenY,
    width: width * camera.zoom,
    height: height * camera.zoom,
  });
}

function appendRole(
  builder: SkPathBuilder,
  geometries: readonly VfxGeometry[],
  camera: VfxCamera,
  role: VfxPrimitiveRole,
): void {
  'worklet';
  for (let geometryIndex = 0; geometryIndex < geometries.length; geometryIndex += 1) {
    const geometry = geometries[geometryIndex];
    if (!geometry) continue;
    for (let rectIndex = 0; rectIndex < geometry.rects.length; rectIndex += 1) {
      const primitive = geometry.rects[rectIndex];
      if (primitive?.role === role) {
        addScreenRect(builder, camera, primitive.x, primitive.y, primitive.width, primitive.height);
      }
    }
  }
}

export function ProceduralMapEffects({ camera, colors, geometries }: ProceduralMapEffectsProps) {
  const geometriesValue = useSharedValue(geometries);
  const cameraValue = useSharedValue(camera);

  useEffect(() => {
    geometriesValue.value = geometries;
  }, [geometries, geometriesValue]);

  useEffect(() => {
    cameraValue.value = camera;
  }, [camera, cameraValue]);

  const fireHalo = usePathValue((builder) => {
    'worklet';
    appendRole(builder, geometriesValue.value, cameraValue.value, 'fire-halo');
  });
  const fireOuter = usePathValue((builder) => {
    'worklet';
    appendRole(builder, geometriesValue.value, cameraValue.value, 'fire-outer');
  });
  const fireCore = usePathValue((builder) => {
    'worklet';
    appendRole(builder, geometriesValue.value, cameraValue.value, 'fire-core');
  });
  const fireEmber = usePathValue((builder) => {
    'worklet';
    appendRole(builder, geometriesValue.value, cameraValue.value, 'fire-ember');
  });
  const sparklePrimary = usePathValue((builder) => {
    'worklet';
    appendRole(builder, geometriesValue.value, cameraValue.value, 'sparkle-primary');
  });
  const sparkleShadow = usePathValue((builder) => {
    'worklet';
    appendRole(builder, geometriesValue.value, cameraValue.value, 'sparkle-shadow');
  });
  const sparkleSatellite = usePathValue((builder) => {
    'worklet';
    appendRole(builder, geometriesValue.value, cameraValue.value, 'sparkle-satellite');
  });
  const insectsHalo = usePathValue((builder) => {
    'worklet';
    appendRole(builder, geometriesValue.value, cameraValue.value, 'insects-halo');
  });
  const insectsPrimary = usePathValue((builder) => {
    'worklet';
    appendRole(builder, geometriesValue.value, cameraValue.value, 'insects-primary');
  });
  const leavesShadow = usePathValue((builder) => {
    'worklet';
    appendRole(builder, geometriesValue.value, cameraValue.value, 'leaves-shadow');
  });
  const leavesPrimary = usePathValue((builder) => {
    'worklet';
    appendRole(builder, geometriesValue.value, cameraValue.value, 'leaves-primary');
  });
  const neonHalo = usePathValue((builder) => {
    'worklet';
    appendRole(builder, geometriesValue.value, cameraValue.value, 'neon-halo');
  });
  const neonPrimary = usePathValue((builder) => {
    'worklet';
    appendRole(builder, geometriesValue.value, cameraValue.value, 'neon-primary');
  });
  const palmShadow = usePathValue((builder) => {
    'worklet';
    appendRole(builder, geometriesValue.value, cameraValue.value, 'palm-shadow');
  });
  const palmPrimary = usePathValue((builder) => {
    'worklet';
    appendRole(builder, geometriesValue.value, cameraValue.value, 'palm-primary');
  });
  const steamShadow = usePathValue((builder) => {
    'worklet';
    appendRole(builder, geometriesValue.value, cameraValue.value, 'steam-shadow');
  });
  const steamPrimary = usePathValue((builder) => {
    'worklet';
    appendRole(builder, geometriesValue.value, cameraValue.value, 'steam-primary');
  });
  const waterShadow = usePathValue((builder) => {
    'worklet';
    appendRole(builder, geometriesValue.value, cameraValue.value, 'water-shadow');
  });
  const waterPrimary = usePathValue((builder) => {
    'worklet';
    appendRole(builder, geometriesValue.value, cameraValue.value, 'water-primary');
  });

  return (
    <>
      <Path color={colors['fire-halo']} path={fireHalo} />
      <Path color={colors['fire-outer']} path={fireOuter} />
      <Path color={colors['fire-core']} path={fireCore} />
      <Path color={colors['fire-ember']} path={fireEmber} />
      <Path color={colors['sparkle-shadow']} path={sparkleShadow} />
      <Path color={colors['sparkle-primary']} path={sparklePrimary} />
      <Path color={colors['sparkle-satellite']} path={sparkleSatellite} />
      <Path color={colors['insects-halo']} path={insectsHalo} />
      <Path color={colors['insects-primary']} path={insectsPrimary} />
      <Path color={colors['leaves-shadow']} path={leavesShadow} />
      <Path color={colors['leaves-primary']} path={leavesPrimary} />
      <Path color={colors['neon-halo']} path={neonHalo} />
      <Path color={colors['neon-primary']} path={neonPrimary} />
      <Path color={colors['palm-shadow']} path={palmShadow} />
      <Path color={colors['palm-primary']} path={palmPrimary} />
      <Path color={colors['steam-shadow']} path={steamShadow} />
      <Path color={colors['steam-primary']} path={steamPrimary} />
      <Path color={colors['water-shadow']} path={waterShadow} />
      <Path color={colors['water-primary']} path={waterPrimary} />
    </>
  );
}
