/**
 * The scripted shooting scene: the joint acceptance test for camera, physics and VFX together.
 *
 * PURE and clock-free. `buildShootingSceneTrace` steps the whole scene at the transient VFX rate and
 * returns a validated frame-by-frame record, so the beat sheet is asserted in Jest with no window,
 * no Electron and no GPU. Same shape as `buildDeterministicMovementTrace` in movement-evidence.ts.
 *
 * There is no combat system in this game. This is one authored sequence presenting an
 * already-decided action, which is exactly the boundary docs/specs/2026-08-11-skia-procedural-vfx.md
 * section 3.3 draws: "This program does not add a combat system."
 *
 * The officer is `tomas_reed`. No cop sprite exists and no new art may be added, and he is already
 * faction `island_administration` with an authored `procedural` disposition, so casting him needs no
 * retcon. The scene changes no content, quest or schedule data.
 */

import { z } from 'zod';

import {
  applyImpulse,
  INITIAL_CAMERA_MOTION,
  playShots,
  sampleCameraDirector,
  type CameraMotion,
  type CameraShot,
} from '../../render/camera-motion';
import type { CameraState, ViewportSize } from '../../render/camera';
import { centerCameraOnWorld } from '../../render/camera';
import { HITSTOP_FRACTION, IMPACT_BEAT_MS, RECOIL_BEAT_MS } from '../../render/impact-motion';
import type { CharacterPose } from '../../render/world-frame';
import {
  combatShotCues,
  sampleTransientVfx,
  TRANSIENT_VFX_MAX_CUES,
  TRANSIENT_VFX_MAX_RECTS,
  TRANSIENT_VFX_STEP_MILLISECONDS,
  type CombatShotEvent,
  type TransientVfxCue,
  type TransientVfxPalette,
} from '../../render/vfx/transient';
import { transientVfxPalette } from '../../render/vfx/transient';
import { districtLighting } from '../../render/district-lighting';

const TILE_SIZE = 32;
export const SHOOTING_SCENE_MAP_ID = 'northwest_residential' as const;
export const SHOOTING_SCENE_MAP_PIXELS: ViewportSize = Object.freeze({ width: 64 * 32, height: 48 * 32 });

export const SHOOTING_SCENE_VARIANTS = ['noon', 'night', 'reduced-motion'] as const;
export type ShootingSceneVariant = (typeof SHOOTING_SCENE_VARIANTS)[number];

/** Noon and deep night, so the muzzle halo's dependence on the live sun is visible and assertable. */
const VARIANT_MINUTE: Readonly<Record<ShootingSceneVariant, number>> = Object.freeze({
  noon: 12 * 60,
  night: 23 * 60,
  'reduced-motion': 23 * 60,
});

/**
 * Open OUTDOOR ground in the villas district, five tiles apart.
 *
 * Three properties, all asserted, all of which the first two attempts got wrong: every tile from
 * the protagonist to the officer is unblocked, so the tracer never crosses a wall; the row is not a
 * roofed interior, so the muzzle glow is not clipped away by shelter cells and the sun actually
 * reaches the scene; and the span is exactly the bullet path.
 */
export const PROTAGONIST_TILE = Object.freeze({ x: 18, y: 27 });
export const OFFICER_TILE = Object.freeze({ x: 23, y: 27 });

function footPoint(tile: Readonly<{ x: number; y: number }>): Readonly<{ x: number; y: number }> {
  return Object.freeze({ x: tile.x * TILE_SIZE + 16, y: tile.y * TILE_SIZE + 29 });
}

export const PROTAGONIST_FOOT = footPoint(PROTAGONIST_TILE);
export const OFFICER_FOOT = footPoint(OFFICER_TILE);
/** Chest height on a 30 px character cell, so the shot is not fired from the ankles. */
const CHEST_RISE = 16;
export const MUZZLE_POINT = Object.freeze({ x: OFFICER_FOOT.x - 10, y: OFFICER_FOOT.y - CHEST_RISE });
export const IMPACT_POINT = Object.freeze({ x: PROTAGONIST_FOOT.x, y: PROTAGONIST_FOOT.y - CHEST_RISE });

/**
 * Beat sheet. Every value is a millisecond from scene start.
 *
 * Hitstop is NOT re-implemented here. `impactPose` already holds the pose flat for
 * `IMPACT_BEAT_MS * HITSTOP_FRACTION` = 60 ms, so the scene clock stays linear and there is exactly
 * one implementation of the hold. `HITSTOP_MS` is exported only so a test can assert the number.
 */
export const HITSTOP_MS = IMPACT_BEAT_MS * HITSTOP_FRACTION;
export const SCENE_PUSH_IN_MS = 600;
export const SCENE_FIRE_MS = 900;
/** The tracer's third step. `shotRects` puts the impact spark at step 2 of the same cue. */
export const SCENE_LAND_MS = 1_000;
export const SCENE_HOLD_MS = 500;
export const SCENE_PULL_BACK_MS = 1_000;
/** Blood starts 150 ms after the shot and lives 4 s; the scene outlasts it by one step. */
export const SCENE_TOTAL_MS = 5_150;

export const SCENE_START_ZOOM = 2;
export const SCENE_PUSH_IN_ZOOM = 3;
export const SCENE_IMPACT_TRAUMA = 0.55;

const SHOT_EVENT: CombatShotEvent = Object.freeze({
  id: 'shooting-scene',
  shooterId: 'tomas_reed',
  targetId: 'protagonist',
  origin: MUZZLE_POINT,
  impact: IMPACT_POINT,
  outcome: 'hit',
});

/**
 * The camera queue. `focus` frames both actors, so the push-in is composed rather than centred on
 * one of them. Trauma is layered separately at the landing frame, never queued as a shot.
 */
export function shootingSceneShots(): readonly CameraShot[] {
  const points = [PROTAGONIST_FOOT, OFFICER_FOOT];
  return Object.freeze([
    { kind: 'focus', points, zoom: SCENE_PUSH_IN_ZOOM, durationMs: SCENE_PUSH_IN_MS, ease: 'in-out' },
    { kind: 'hold', durationMs: SCENE_LAND_MS + IMPACT_BEAT_MS - SCENE_PUSH_IN_MS + SCENE_HOLD_MS },
    { kind: 'focus', points, zoom: SCENE_START_ZOOM, durationMs: SCENE_PULL_BACK_MS, ease: 'in-out' },
  ] as const);
}

export type ShootingSceneActor = Readonly<{
  pose: CharacterPose;
  poseProgress: number;
  poseDirection: -1 | 1;
}>;

/**
 * The officer fires and takes the recoil beat.
 *
 * `poseDirection` is the direction the FORCE travels in screen x. The officer stands east of the
 * protagonist and fires west, so the round travels -1 and his own recoil is the equal and opposite
 * +1. Getting this pair backwards is the obvious bug, so it is asserted.
 */
export function officerAt(tMs: number): ShootingSceneActor {
  if (tMs < SCENE_FIRE_MS || tMs >= SCENE_FIRE_MS + RECOIL_BEAT_MS) {
    return { pose: 'idle', poseProgress: 0, poseDirection: 1 };
  }
  return {
    pose: 'recoil',
    poseProgress: (tMs - SCENE_FIRE_MS) / RECOIL_BEAT_MS,
    poseDirection: 1,
  };
}

/** The protagonist is hit. The force travels west, so -1. */
export function protagonistAt(tMs: number): ShootingSceneActor {
  if (tMs < SCENE_LAND_MS || tMs >= SCENE_LAND_MS + IMPACT_BEAT_MS) {
    return { pose: 'idle', poseProgress: 0, poseDirection: -1 };
  }
  return {
    pose: 'impact',
    poseProgress: (tMs - SCENE_LAND_MS) / IMPACT_BEAT_MS,
    poseDirection: -1,
  };
}

export function shootingScenePalette(variant: ShootingSceneVariant): TransientVfxPalette {
  return transientVfxPalette(districtLighting(SHOOTING_SCENE_MAP_ID, VARIANT_MINUTE[variant]));
}

export function shootingSceneAbsoluteMinute(variant: ShootingSceneVariant): number {
  return VARIANT_MINUTE[variant];
}

/** Cues are created once, at scene start, so the timeline is a pure function of `tMs`. */
export function shootingSceneCues(): readonly TransientVfxCue[] {
  return combatShotCues(SHOT_EVENT, SCENE_FIRE_MS);
}

export function shootingSceneInitialCamera(viewport: ViewportSize): CameraState {
  return centerCameraOnWorld(
    { x: (PROTAGONIST_FOOT.x + OFFICER_FOOT.x) / 2, y: (PROTAGONIST_FOOT.y + OFFICER_FOOT.y) / 2 },
    SCENE_START_ZOOM,
    viewport,
    SHOOTING_SCENE_MAP_PIXELS,
  );
}

const SampleSchema = z.object({
  tMs: z.number().int().nonnegative(),
  cueIds: z.array(z.string().min(1)).readonly(),
  rectCount: z.number().int().nonnegative().max(TRANSIENT_VFX_MAX_RECTS),
  groundRects: z.number().int().nonnegative(),
  aerialRects: z.number().int().nonnegative(),
  glowCount: z.number().int().nonnegative(),
  glowOpacity: z.number().nonnegative(),
  officerPose: z.string().min(1),
  protagonistPose: z.string().min(1),
  protagonistPoseProgress: z.number().nonnegative(),
  cameraZoom: z.number().positive(),
  cameraOffsetX: z.number(),
  cameraOffsetY: z.number(),
}).strict();

export const ShootingSceneTraceSchema = z.object({
  schemaVersion: z.literal(1),
  variant: z.enum(SHOOTING_SCENE_VARIANTS),
  stepMs: z.literal(TRANSIENT_VFX_STEP_MILLISECONDS),
  totalMs: z.literal(SCENE_TOTAL_MS),
  peakRectCount: z.number().int().nonnegative().max(TRANSIENT_VFX_MAX_RECTS),
  peakCueCount: z.number().int().nonnegative().max(TRANSIENT_VFX_MAX_CUES),
  samples: z.array(SampleSchema).min(2),
}).strict();

export type ShootingSceneTrace = z.infer<typeof ShootingSceneTraceSchema>;

const TRACE_VIEWPORT: ViewportSize = Object.freeze({ width: 1_280, height: 720 });

export type ShootingSceneCameraStep = Readonly<{
  motion: CameraMotion;
  camera: CameraState;
  offset: Readonly<{ x: number; y: number }>;
  impulseApplied: boolean;
}>;

/**
 * One camera step of the scene. Shared by the trace builder and the rendered component so a captured
 * frame and an asserted frame cannot drift apart.
 */
export function stepShootingSceneCamera(
  previous: ShootingSceneCameraStep,
  tMs: number,
  deltaMs: number,
  viewport: ViewportSize,
  reducedMotion: boolean,
): ShootingSceneCameraStep {
  let motion = previous.motion;
  let impulseApplied = previous.impulseApplied;
  if (!reducedMotion && !impulseApplied && tMs >= SCENE_LAND_MS) {
    motion = applyImpulse(motion, SCENE_IMPACT_TRAUMA, { x: -1, y: 0 });
    impulseApplied = true;
  }
  const sample = sampleCameraDirector(motion, previous.camera, {
    deltaMs,
    followPoint: PROTAGONIST_FOOT,
    viewport,
    mapPixels: SHOOTING_SCENE_MAP_PIXELS,
    reducedMotion,
  });
  return { motion: sample.motion, camera: sample.camera, offset: sample.offset, impulseApplied };
}

export function initialShootingSceneCameraStep(
  viewport: ViewportSize,
  reducedMotion: boolean,
): ShootingSceneCameraStep {
  return {
    motion: reducedMotion ? INITIAL_CAMERA_MOTION : playShots(INITIAL_CAMERA_MOTION, shootingSceneShots()),
    camera: shootingSceneInitialCamera(viewport),
    offset: { x: 0, y: 0 },
    impulseApplied: false,
  };
}

/** Replays the camera from zero to `tMs`, so a pinned capture gets the zoom and shake it should. */
export function shootingSceneCameraAt(
  tMs: number,
  viewport: ViewportSize,
  reducedMotion: boolean,
): ShootingSceneCameraStep {
  let step = initialShootingSceneCameraStep(viewport, reducedMotion);
  for (let at = 0; at <= tMs; at += TRANSIENT_VFX_STEP_MILLISECONDS) {
    step = stepShootingSceneCamera(step, at, at === 0 ? 0 : TRANSIENT_VFX_STEP_MILLISECONDS, viewport, reducedMotion);
  }
  return step;
}

/** Rounds like `movement-evidence.ts` does, so float residue never destabilises the trace. */
function rounded(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

/**
 * Steps the whole scene and records what camera, physics and VFX each produced.
 *
 * The camera is driven through the real `sampleCameraDirector`, not a stand-in, which is what makes
 * this an integration test of the three systems rather than three separate unit tests.
 */
export function buildShootingSceneTrace(variant: ShootingSceneVariant): ShootingSceneTrace {
  const reducedMotion = variant === 'reduced-motion';
  const palette = shootingScenePalette(variant);
  const cues = shootingSceneCues();
  // Reduced motion drives no camera at all: no push-in, no pull-back, no shake.
  let step = initialShootingSceneCameraStep(TRACE_VIEWPORT, reducedMotion);
  const samples: z.infer<typeof SampleSchema>[] = [];
  let peakRectCount = 0;
  let peakCueCount = 0;

  for (let tMs = 0; tMs <= SCENE_TOTAL_MS; tMs += TRANSIENT_VFX_STEP_MILLISECONDS) {
    step = stepShootingSceneCamera(
      step,
      tMs,
      tMs === 0 ? 0 : TRANSIENT_VFX_STEP_MILLISECONDS,
      TRACE_VIEWPORT,
      reducedMotion,
    );
    const sample = step;

    const vfx = sampleTransientVfx(cues, tMs, reducedMotion, palette);
    const protagonist = protagonistAt(tMs);
    peakRectCount = Math.max(peakRectCount, vfx.liveRects);
    peakCueCount = Math.max(peakCueCount, vfx.activeCueIds.length);
    samples.push({
      tMs,
      cueIds: vfx.activeCueIds,
      rectCount: vfx.liveRects,
      groundRects: vfx.rects.filter(({ layer }) => layer === 'ground').length,
      aerialRects: vfx.rects.filter(({ layer }) => layer === 'aerial').length,
      glowCount: vfx.glows.length,
      glowOpacity: rounded(vfx.glows[0]?.opacity ?? 0),
      officerPose: officerAt(tMs).pose,
      protagonistPose: protagonist.pose,
      protagonistPoseProgress: rounded(protagonist.poseProgress),
      cameraZoom: sample.camera.zoom,
      cameraOffsetX: rounded(sample.offset.x),
      cameraOffsetY: rounded(sample.offset.y),
    });
  }

  return ShootingSceneTraceSchema.parse({
    schemaVersion: 1,
    variant,
    stepMs: TRANSIENT_VFX_STEP_MILLISECONDS,
    totalMs: SCENE_TOTAL_MS,
    peakRectCount,
    peakCueCount,
    samples,
  });
}
