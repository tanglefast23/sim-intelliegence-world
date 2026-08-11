import { Path, usePathValue, type SkPathBuilder } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { useSharedValue } from 'react-native-reanimated';

import {
  VFX_MAX_DELTA_MILLISECONDS,
  VFX_STEP_MILLISECONDS,
  VFX_SUSPENSION_GAP_MILLISECONDS,
  type PreparedVfxEmitter,
  type VfxPrimitiveRole,
} from './types';

export const PROCEDURAL_VFX_RENDER_NODE_COUNT = 7 as const;

type VfxCamera = Readonly<{
  x: number;
  y: number;
  zoom: number;
  dpr: number;
}>;

type ProceduralMapEffectsProps = Readonly<{
  camera: VfxCamera;
  emitters: readonly PreparedVfxEmitter[];
  mapEntryIdentity: string;
  onAgeStepChange?: (ageStep: number) => void;
  reducedMotion: boolean;
  running: boolean;
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
  emitters: readonly PreparedVfxEmitter[],
  camera: VfxCamera,
  ageMilliseconds: number,
  reducedMotion: boolean,
  role: VfxPrimitiveRole,
): void {
  'worklet';
  const step = Math.floor(ageMilliseconds / VFX_STEP_MILLISECONDS);
  for (let index = 0; index < emitters.length; index += 1) {
    const emitter = emitters[index];
    if (emitter === undefined) continue;
    const centerX = emitter.tile.x * 32 + 16;
    const centerY = emitter.tile.y * 32 + 16;
    const phase = reducedMotion ? emitter.phaseOffset : (step + emitter.phaseOffset) % 4;
    if (emitter.kind === 'fire') {
      if (role === 'fire-halo') {
        addScreenRect(builder, camera, centerX - 4, centerY - 9, 9, 10);
      } else if (role === 'fire-outer') {
        if (phase === 0) addScreenRect(builder, camera, centerX - 2, centerY - 7, 4, 5);
        else if (phase === 1) addScreenRect(builder, camera, centerX - 1, centerY - 8, 3, 6);
        else if (phase === 2) addScreenRect(builder, camera, centerX - 3, centerY - 6, 5, 4);
        else addScreenRect(builder, camera, centerX - 2, centerY - 8, 4, 6);
      } else if (role === 'fire-core') {
        addScreenRect(builder, camera, centerX - 1, centerY - 4, 3, 4);
      } else if (role === 'fire-ember' && !reducedMotion) {
        addScreenRect(
          builder,
          camera,
          centerX + emitter.lateralSign * (2 + (phase % 2)),
          centerY - 8 - (phase % 3),
          1,
          1,
        );
      }
      continue;
    }
    if (role === 'sparkle-shadow') {
      const arm = reducedMotion ? 2 : 2 + (phase % 2);
      addScreenRect(builder, camera, centerX - 1, centerY - arm - 1, 3, arm * 2 + 3);
      addScreenRect(builder, camera, centerX - arm - 1, centerY - 1, arm * 2 + 3, 3);
    } else if (role === 'sparkle-primary') {
      const arm = reducedMotion ? 2 : 2 + (phase % 2);
      addScreenRect(builder, camera, centerX, centerY - arm, 1, arm * 2 + 1);
      addScreenRect(builder, camera, centerX - arm, centerY, arm * 2 + 1, 1);
    } else if (role === 'sparkle-satellite' && !reducedMotion) {
      addScreenRect(
        builder,
        camera,
        centerX + emitter.lateralSign * (3 + (phase % 2)),
        centerY - 3 + phase,
        1,
        1,
      );
    }
  }
}

export function ProceduralMapEffects({
  camera,
  emitters,
  mapEntryIdentity,
  onAgeStepChange,
  reducedMotion,
  running,
}: ProceduralMapEffectsProps) {
  const ageMilliseconds = useSharedValue(0);
  const ageStepValue = useSharedValue(0);
  const frameActive = useSharedValue(false);
  const reducedMotionValue = useSharedValue(reducedMotion);
  const emittersValue = useSharedValue(emitters);
  const cameraValue = useSharedValue(camera);

  useEffect(() => {
    reducedMotionValue.value = reducedMotion;
  }, [reducedMotion, reducedMotionValue]);

  useEffect(() => {
    emittersValue.value = emitters;
  }, [emitters, emittersValue]);

  useEffect(() => {
    cameraValue.value = camera;
  }, [camera, cameraValue]);

  useEffect(() => {
    ageMilliseconds.value = 0;
    ageStepValue.value = 0;
    frameActive.value = false;
  }, [ageMilliseconds, ageStepValue, frameActive, mapEntryIdentity]);

  useEffect(() => {
    if (!running) {
      frameActive.value = false;
      return undefined;
    }
    let animationFrame = 0;
    let previousTime: number | undefined;
    let reportedAgeStep = Math.floor(ageMilliseconds.value / VFX_STEP_MILLISECONDS);
    const animate = (time: number) => {
      const rawDelta = previousTime === undefined ? 0 : time - previousTime;
      previousTime = time;
      if (!frameActive.value || rawDelta > VFX_SUSPENSION_GAP_MILLISECONDS) {
        frameActive.value = true;
      } else {
        ageMilliseconds.value += Math.min(rawDelta, VFX_MAX_DELTA_MILLISECONDS);
        const ageStep = Math.floor(ageMilliseconds.value / VFX_STEP_MILLISECONDS);
        if (ageStep !== reportedAgeStep) {
          reportedAgeStep = ageStep;
          ageStepValue.value = ageStep;
          onAgeStepChange?.(ageStep);
        }
      }
      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [ageMilliseconds, ageStepValue, frameActive, mapEntryIdentity, onAgeStepChange, running]);

  const fireHalo = usePathValue((builder) => {
    'worklet';
    const reduced = reducedMotionValue.value;
    appendRole(builder, emittersValue.value, cameraValue.value, reduced ? 0 : ageStepValue.value * VFX_STEP_MILLISECONDS, reduced, 'fire-halo');
  });
  const fireOuter = usePathValue((builder) => {
    'worklet';
    const reduced = reducedMotionValue.value;
    appendRole(builder, emittersValue.value, cameraValue.value, reduced ? 0 : ageStepValue.value * VFX_STEP_MILLISECONDS, reduced, 'fire-outer');
  });
  const fireCore = usePathValue((builder) => {
    'worklet';
    const reduced = reducedMotionValue.value;
    appendRole(builder, emittersValue.value, cameraValue.value, reduced ? 0 : ageStepValue.value * VFX_STEP_MILLISECONDS, reduced, 'fire-core');
  });
  const fireEmber = usePathValue((builder) => {
    'worklet';
    const reduced = reducedMotionValue.value;
    appendRole(builder, emittersValue.value, cameraValue.value, reduced ? 0 : ageStepValue.value * VFX_STEP_MILLISECONDS, reduced, 'fire-ember');
  });
  const sparklePrimary = usePathValue((builder) => {
    'worklet';
    const reduced = reducedMotionValue.value;
    appendRole(builder, emittersValue.value, cameraValue.value, reduced ? 0 : ageStepValue.value * VFX_STEP_MILLISECONDS, reduced, 'sparkle-primary');
  });
  const sparkleShadow = usePathValue((builder) => {
    'worklet';
    const reduced = reducedMotionValue.value;
    appendRole(builder, emittersValue.value, cameraValue.value, reduced ? 0 : ageStepValue.value * VFX_STEP_MILLISECONDS, reduced, 'sparkle-shadow');
  });
  const sparkleSatellite = usePathValue((builder) => {
    'worklet';
    const reduced = reducedMotionValue.value;
    appendRole(builder, emittersValue.value, cameraValue.value, reduced ? 0 : ageStepValue.value * VFX_STEP_MILLISECONDS, reduced, 'sparkle-satellite');
  });

  return (
    <>
      <Path color="#f0783226" path={fireHalo} />
      <Path color="#c64f2280" path={fireOuter} />
      <Path color="#ffd15c" path={fireCore} />
      <Path color="#ffe49a80" path={fireEmber} />
      <Path color="#5c4428cc" path={sparkleShadow} />
      <Path color="#fff4c8e6" path={sparklePrimary} />
      <Path color="#fff3c4e6" path={sparkleSatellite} />
    </>
  );
}
