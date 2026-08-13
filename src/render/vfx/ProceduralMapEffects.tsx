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

export const PROCEDURAL_VFX_RENDER_NODE_COUNT = 19 as const;

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
    if (emitter.kind === 'sparkle' && role === 'sparkle-shadow') {
      const arm = reducedMotion ? 2 : 2 + (phase % 2);
      addScreenRect(builder, camera, centerX - 1, centerY - arm - 1, 3, arm * 2 + 3);
      addScreenRect(builder, camera, centerX - arm - 1, centerY - 1, arm * 2 + 3, 3);
    } else if (emitter.kind === 'sparkle' && role === 'sparkle-primary') {
      const arm = reducedMotion ? 2 : 2 + (phase % 2);
      addScreenRect(builder, camera, centerX, centerY - arm, 1, arm * 2 + 1);
      addScreenRect(builder, camera, centerX - arm, centerY, arm * 2 + 1, 1);
    } else if (emitter.kind === 'sparkle' && role === 'sparkle-satellite' && !reducedMotion) {
      addScreenRect(
        builder,
        camera,
        centerX + emitter.lateralSign * (3 + (phase % 2)),
        centerY - 3 + phase,
        1,
        1,
      );
    } else if (emitter.kind === 'insects' && role === 'insects-halo') {
      const drift = reducedMotion ? 0 : emitter.lateralSign * phase;
      addScreenRect(builder, camera, centerX - 9 + drift, centerY - 7 + phase, 3, 3);
      addScreenRect(builder, camera, centerX + 5 - drift, centerY + 3 - phase, 3, 3);
    } else if (emitter.kind === 'insects' && role === 'insects-primary') {
      const drift = reducedMotion ? 0 : emitter.lateralSign * phase;
      addScreenRect(builder, camera, centerX - 8 + drift, centerY - 6 + phase, 1, 1);
      addScreenRect(builder, camera, centerX + 6 - drift, centerY + 4 - phase, 1, 1);
    } else if (emitter.kind === 'leaves' && role === 'leaves-shadow') {
      const drift = reducedMotion ? 0 : emitter.lateralSign * phase;
      addScreenRect(builder, camera, centerX - 11 + drift, centerY + 4, 5, 2);
    } else if (emitter.kind === 'leaves' && role === 'leaves-primary') {
      const drift = reducedMotion ? 0 : emitter.lateralSign * phase;
      addScreenRect(builder, camera, centerX - 10 + drift, centerY - 5 + phase, 4, 2);
      addScreenRect(builder, camera, centerX - 1 - drift, centerY - 1, 3, 2);
      addScreenRect(builder, camera, centerX + 7 + drift, centerY - 7 + phase, 4, 2);
    } else if (emitter.kind === 'neon' && role === 'neon-halo') {
      addScreenRect(builder, camera, centerX - 10, centerY - 5, 20, 10);
    } else if (emitter.kind === 'neon' && role === 'neon-primary') {
      const pulse = reducedMotion || phase === 3 ? 0 : 1;
      addScreenRect(builder, camera, centerX - 8 + pulse, centerY - 1, 16 - pulse * 2, 2);
    } else if (emitter.kind === 'palm' && role === 'palm-shadow') {
      const sway = reducedMotion ? 0 : emitter.lateralSign * (phase % 2);
      addScreenRect(builder, camera, centerX - 10 + sway, centerY + 3, 20, 3);
    } else if (emitter.kind === 'palm' && role === 'palm-primary') {
      const sway = reducedMotion ? 0 : emitter.lateralSign * (phase % 2);
      addScreenRect(builder, camera, centerX - 11 + sway, centerY - 2, 9, 3);
      addScreenRect(builder, camera, centerX + 2 + sway, centerY - 5, 9, 3);
    } else if (emitter.kind === 'steam' && role === 'steam-shadow') {
      const rise = reducedMotion ? 0 : phase * 2;
      addScreenRect(builder, camera, centerX - 5, centerY - 7 - rise, 3, 7);
      addScreenRect(builder, camera, centerX + 2, centerY - 11 + rise / 2, 3, 8);
    } else if (emitter.kind === 'steam' && role === 'steam-primary') {
      const rise = reducedMotion ? 0 : phase * 2;
      const drift = reducedMotion ? 0 : emitter.lateralSign * phase;
      addScreenRect(builder, camera, centerX - 4 + drift, centerY - 9 - rise, 2, 6);
      addScreenRect(builder, camera, centerX + 3 - drift, centerY - 14 + rise / 2, 2, 7);
    } else if (emitter.kind === 'water' && role === 'water-shadow') {
      const drift = reducedMotion ? 0 : phase - 2;
      addScreenRect(builder, camera, centerX - 11 + drift, centerY, 22, 4);
      addScreenRect(builder, camera, centerX - 7 - drift, centerY - 6, 14, 3);
    } else if (emitter.kind === 'water' && role === 'water-primary') {
      const drift = reducedMotion ? 0 : phase - 2;
      addScreenRect(builder, camera, centerX - 9 + drift, centerY + 1, 7, 2);
      addScreenRect(builder, camera, centerX + 2 + drift, centerY + 1, 7, 2);
      addScreenRect(builder, camera, centerX - 5 - drift, centerY - 5, 10, 1);
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
  const leavesShadow = usePathValue((builder) => {
    'worklet';
    const reduced = reducedMotionValue.value;
    appendRole(builder, emittersValue.value, cameraValue.value, reduced ? 0 : ageStepValue.value * VFX_STEP_MILLISECONDS, reduced, 'leaves-shadow');
  });
  const insectsHalo = usePathValue((builder) => {
    'worklet';
    const reduced = reducedMotionValue.value;
    appendRole(builder, emittersValue.value, cameraValue.value, reduced ? 0 : ageStepValue.value * VFX_STEP_MILLISECONDS, reduced, 'insects-halo');
  });
  const insectsPrimary = usePathValue((builder) => {
    'worklet';
    const reduced = reducedMotionValue.value;
    appendRole(builder, emittersValue.value, cameraValue.value, reduced ? 0 : ageStepValue.value * VFX_STEP_MILLISECONDS, reduced, 'insects-primary');
  });
  const leavesPrimary = usePathValue((builder) => {
    'worklet';
    const reduced = reducedMotionValue.value;
    appendRole(builder, emittersValue.value, cameraValue.value, reduced ? 0 : ageStepValue.value * VFX_STEP_MILLISECONDS, reduced, 'leaves-primary');
  });
  const neonHalo = usePathValue((builder) => {
    'worklet';
    const reduced = reducedMotionValue.value;
    appendRole(builder, emittersValue.value, cameraValue.value, reduced ? 0 : ageStepValue.value * VFX_STEP_MILLISECONDS, reduced, 'neon-halo');
  });
  const neonPrimary = usePathValue((builder) => {
    'worklet';
    const reduced = reducedMotionValue.value;
    appendRole(builder, emittersValue.value, cameraValue.value, reduced ? 0 : ageStepValue.value * VFX_STEP_MILLISECONDS, reduced, 'neon-primary');
  });
  const steamShadow = usePathValue((builder) => {
    'worklet';
    const reduced = reducedMotionValue.value;
    appendRole(builder, emittersValue.value, cameraValue.value, reduced ? 0 : ageStepValue.value * VFX_STEP_MILLISECONDS, reduced, 'steam-shadow');
  });
  const palmShadow = usePathValue((builder) => {
    'worklet';
    const reduced = reducedMotionValue.value;
    appendRole(builder, emittersValue.value, cameraValue.value, reduced ? 0 : ageStepValue.value * VFX_STEP_MILLISECONDS, reduced, 'palm-shadow');
  });
  const palmPrimary = usePathValue((builder) => {
    'worklet';
    const reduced = reducedMotionValue.value;
    appendRole(builder, emittersValue.value, cameraValue.value, reduced ? 0 : ageStepValue.value * VFX_STEP_MILLISECONDS, reduced, 'palm-primary');
  });
  const steamPrimary = usePathValue((builder) => {
    'worklet';
    const reduced = reducedMotionValue.value;
    appendRole(builder, emittersValue.value, cameraValue.value, reduced ? 0 : ageStepValue.value * VFX_STEP_MILLISECONDS, reduced, 'steam-primary');
  });
  const waterShadow = usePathValue((builder) => {
    'worklet';
    const reduced = reducedMotionValue.value;
    appendRole(builder, emittersValue.value, cameraValue.value, reduced ? 0 : ageStepValue.value * VFX_STEP_MILLISECONDS, reduced, 'water-shadow');
  });
  const waterPrimary = usePathValue((builder) => {
    'worklet';
    const reduced = reducedMotionValue.value;
    appendRole(builder, emittersValue.value, cameraValue.value, reduced ? 0 : ageStepValue.value * VFX_STEP_MILLISECONDS, reduced, 'water-primary');
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
      <Path color="#f6cd5133" path={insectsHalo} />
      <Path color="#ffe889e6" path={insectsPrimary} />
      <Path color="#392c2259" path={leavesShadow} />
      <Path color="#e0a14ed9" path={leavesPrimary} />
      <Path color="#ef48bb33" path={neonHalo} />
      <Path color="#ff67d9e6" path={neonPrimary} />
      <Path color="#26341f66" path={palmShadow} />
      <Path color="#86a451d9" path={palmPrimary} />
      <Path color="#3f342c4d" path={steamShadow} />
      <Path color="#fff0d6a6" path={steamPrimary} />
      <Path color="#174c5966" path={waterShadow} />
      <Path color="#8ef1e6d9" path={waterPrimary} />
    </>
  );
}
