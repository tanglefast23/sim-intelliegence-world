import { WORLD_MAP_CATALOG } from '../../../application/runtime/map-catalog';
import { HITSTOP_FRACTION, IMPACT_BEAT_MS, RECOIL_BEAT_MS } from '../../../render/impact-motion';
import { MAX_SHAKE_WORLD_PX } from '../../../render/camera-motion';
import {
  TRANSIENT_VFX_MAX_CUES,
  TRANSIENT_VFX_MAX_RECTS,
  TRANSIENT_VFX_STEP_MILLISECONDS,
} from '../../../render/vfx/transient';
import {
  buildShootingSceneTrace,
  officerAt,
  protagonistAt,
  shootingSceneCues,
  HITSTOP_MS,
  SCENE_FIRE_MS,
  SCENE_IMPACT_TRAUMA,
  SCENE_LAND_MS,
  SCENE_START_ZOOM,
  SCENE_PUSH_IN_ZOOM,
  SCENE_TOTAL_MS,
  SHOOTING_SCENE_MAP_ID,
  SHOOTING_SCENE_VARIANTS,
  OFFICER_TILE,
  PROTAGONIST_TILE,
  type ShootingSceneTrace,
} from '../shooting-scene';

const NOON = buildShootingSceneTrace('noon');
const NIGHT = buildShootingSceneTrace('night');
const REDUCED = buildShootingSceneTrace('reduced-motion');

function at(trace: ShootingSceneTrace, tMs: number) {
  const sample = trace.samples.find((entry) => entry.tMs === tMs);
  if (!sample) throw new Error(`No shooting-scene sample at ${tMs} ms.`);
  return sample;
}

/**
 * The joint acceptance test for the whole five-agent program: camera, physics and VFX driven through
 * one scripted timeline. The camera runs through the real `sampleCameraDirector` and the poses
 * through the real `impact-motion` beats, so this fails if any of the three contracts moves.
 */
describe('shooting scene', () => {
  test('replays byte-identically', () => {
    expect(buildShootingSceneTrace('noon')).toEqual(NOON);
    expect(buildShootingSceneTrace('reduced-motion')).toEqual(REDUCED);
  });

  test('covers the whole beat sheet at the transient step rate', () => {
    expect(NOON.stepMs).toBe(TRANSIENT_VFX_STEP_MILLISECONDS);
    expect(NOON.samples.at(0)?.tMs).toBe(0);
    expect(NOON.samples.at(-1)?.tMs).toBe(SCENE_TOTAL_MS);
    expect(NOON.samples).toHaveLength(SCENE_TOTAL_MS / TRANSIENT_VFX_STEP_MILLISECONDS + 1);
  });

  test('fires, lands, stains and settles at the scripted milliseconds', () => {
    // Silence before the shot.
    expect(at(NOON, SCENE_FIRE_MS - TRANSIENT_VFX_STEP_MILLISECONDS).cueIds).toEqual([]);
    // Muzzle flash and tracer.
    expect(at(NOON, SCENE_FIRE_MS).cueIds).toEqual(['shooting-scene-shot']);
    expect(at(NOON, SCENE_FIRE_MS).aerialRects).toBeGreaterThan(0);
    // Blood arrives after the round lands, never with the flash.
    expect(at(NOON, SCENE_FIRE_MS).groundRects).toBe(0);
    expect(at(NOON, SCENE_FIRE_MS + 150).cueIds).toContain('shooting-scene-blood');
    // The stain outlives the shot and is gone by the end.
    expect(at(NOON, 5_000).cueIds).toEqual(['shooting-scene-blood']);
    expect(at(NOON, SCENE_TOTAL_MS).cueIds).toEqual([]);
    expect(at(NOON, SCENE_TOTAL_MS).rectCount).toBe(0);
  });

  test('holds the particle budget with room to spare', () => {
    for (const trace of [NOON, NIGHT, REDUCED]) {
      expect(trace.peakRectCount).toBeLessThanOrEqual(TRANSIENT_VFX_MAX_RECTS);
      expect(trace.peakCueCount).toBeLessThanOrEqual(TRANSIENT_VFX_MAX_CUES);
    }
    // The loudest moment of the centrepiece scene. Recorded so a regression that inflates the kit
    // shows up as a number rather than as a slow frame.
    expect(NOON.peakRectCount).toBe(13);
    expect(NOON.peakCueCount).toBe(2);
    expect(NOON.peakRectCount / TRANSIENT_VFX_MAX_RECTS).toBeLessThan(0.15);
  });

  test('drives the physics pose beats, with the force direction the right way round', () => {
    // The officer stands EAST and fires west: the round travels -1, his recoil is +1.
    expect(officerAt(SCENE_FIRE_MS).pose).toBe('recoil');
    expect(officerAt(SCENE_FIRE_MS).poseDirection).toBe(1);
    expect(protagonistAt(SCENE_LAND_MS).pose).toBe('impact');
    expect(protagonistAt(SCENE_LAND_MS).poseDirection).toBe(-1);
    expect(officerAt(SCENE_FIRE_MS).poseDirection).toBe(-protagonistAt(SCENE_LAND_MS).poseDirection);

    expect(officerAt(SCENE_FIRE_MS + RECOIL_BEAT_MS).pose).toBe('idle');
    expect(protagonistAt(SCENE_LAND_MS + IMPACT_BEAT_MS).pose).toBe('idle');
    expect(at(NOON, SCENE_LAND_MS).protagonistPose).toBe('impact');
    expect(at(NOON, SCENE_LAND_MS + IMPACT_BEAT_MS).protagonistPose).toBe('idle');
  });

  test('takes hitstop from the physics constants and defines none of its own', () => {
    // 0.12 * 500 = 60 ms, held inside impactPose. The scene clock stays linear so there is exactly
    // one implementation of the hold.
    expect(HITSTOP_MS).toBe(IMPACT_BEAT_MS * HITSTOP_FRACTION);
    expect(HITSTOP_MS).toBe(60);
  });

  test('pushes in, shakes on impact, and pulls back inside the camera envelope', () => {
    expect(at(NOON, 0).cameraZoom).toBe(SCENE_START_ZOOM);
    expect(at(NOON, 600).cameraZoom).toBe(SCENE_PUSH_IN_ZOOM);
    // Settled back by the end of the pull-back.
    expect(at(NOON, SCENE_TOTAL_MS).cameraZoom).toBe(SCENE_START_ZOOM);

    const shakeStart = at(NOON, SCENE_LAND_MS + TRANSIENT_VFX_STEP_MILLISECONDS);
    expect(Math.abs(shakeStart.cameraOffsetX) + Math.abs(shakeStart.cameraOffsetY)).toBeGreaterThan(0);
    for (const sample of NOON.samples) {
      expect(Math.abs(sample.cameraOffsetX)).toBeLessThanOrEqual(MAX_SHAKE_WORLD_PX);
      expect(Math.abs(sample.cameraOffsetY)).toBeLessThanOrEqual(MAX_SHAKE_WORLD_PX);
    }
    // The shake is a decaying impulse, not a loop: it is over well before the scene ends.
    expect(at(NOON, SCENE_LAND_MS + 400).cameraOffsetX).toBe(0);
    expect(at(NOON, SCENE_LAND_MS + 400).cameraOffsetY).toBe(0);
    expect(SCENE_IMPACT_TRAUMA).toBeLessThan(1);
  });

  test('noon and night differ only in emitted light, never in geometry', () => {
    expect(NIGHT.peakRectCount).toBe(NOON.peakRectCount);
    for (const [index, sample] of NOON.samples.entries()) {
      const night = NIGHT.samples[index]!;
      expect(night.rectCount).toBe(sample.rectCount);
      expect(night.groundRects).toBe(sample.groundRects);
      expect(night.aerialRects).toBe(sample.aerialRects);
      expect(night.glowCount).toBe(sample.glowCount);
    }
    // This is the terrain coupling: the same shot reads harder after dark.
    expect(at(NIGHT, SCENE_FIRE_MS).glowOpacity).toBeGreaterThan(at(NOON, SCENE_FIRE_MS).glowOpacity);
  });

  test('reduced motion removes every camera move and all VFX travel, and keeps the read', () => {
    for (const sample of REDUCED.samples) {
      expect(sample.cameraOffsetX).toBe(0);
      expect(sample.cameraOffsetY).toBe(0);
      expect(sample.cameraZoom).toBe(SCENE_START_ZOOM);
      expect(sample.glowCount).toBe(0);
    }
    // The informational marks survive: a muzzle, a line, an impact, and the stain.
    expect(at(REDUCED, SCENE_FIRE_MS).aerialRects).toBe(10);
    expect(at(REDUCED, 5_000).cueIds).toEqual(['shooting-scene-blood']);
  });

  test('emits exactly two cues for one hit and never invents a third', () => {
    const cues = shootingSceneCues();
    expect(cues.map(({ kind }) => kind)).toEqual(['shot', 'blood']);
    expect(cues.every(({ startMs }) => startMs >= SCENE_FIRE_MS)).toBe(true);
  });

  test('covers every variant', () => {
    expect(SHOOTING_SCENE_VARIANTS).toEqual(['noon', 'night', 'reduced-motion']);
  });

  test('stages both actors and the whole bullet path on walkable ground', () => {
    // The first pair chosen for this scene sat on two blocked tiles, which would have put the
    // officer inside a wall and run the tracer through a building.
    const map = WORLD_MAP_CATALOG[SHOOTING_SCENE_MAP_ID];
    expect(PROTAGONIST_TILE.y).toBe(OFFICER_TILE.y);
    for (let x = PROTAGONIST_TILE.x; x <= OFFICER_TILE.x; x += 1) {
      expect(map.blockedKeys.has(`${x},${PROTAGONIST_TILE.y}`)).toBe(false);
    }
  });
});
