/**
 * Impact, recoil and fall poses for the scripted shooting scene. Render-only, pure, no clock.
 *
 * The scene owns the timeline and drives `poseProgress`; this file only turns a normalised progress
 * into a transform. The character is one 24x30 quad with two frames per direction and no prone
 * sprite, so a fall is the quad rotating about the bottom pivot `addAtlasPlacement` already supports.
 * That is the only way to fall without new art, which the locked style rule forbids.
 *
 * Hitstop — holding the pose flat for a few dozen milliseconds at the moment of contact — is the
 * standard impact-feedback technique: Swink, *Game Feel* (2008); Nijman, *The Art of Screenshake*
 * (2013); Jonasson and Purho, *Juice It or Lose It* (2012).
 */

export type ImpactPose = Readonly<{
  /** World pixels, added to the sprite origin. */
  offsetX: number;
  /** World pixels, positive DOWN. */
  offsetY: number;
  /** Rotation about PROTAGONIST_WOBBLE_PIVOT — the same pivot as the walk wobble. */
  angleDegrees: number;
}>;

export type ImpactPoseInput = Readonly<{
  /** 0..1, clamped internally so an overrunning scene clock is safe. */
  poseProgress: number;
  /**
   * The direction the FORCE travels in screen x, not the shooter's facing.
   * A shooter on the victim's left gives the victim +1 and the shooter's own recoil -1.
   */
  poseDirection: -1 | 1;
  reducedMotion: boolean;
}>;

/** Beat lengths. The scene converts its clock to poseProgress with these. */
export const IMPACT_BEAT_MS = 500;
export const RECOIL_BEAT_MS = 120;
export const FALL_BEAT_MS = 640;

/** Fraction of IMPACT_BEAT_MS held flat at the recoil pose. 0.12 * 500 = 60 ms of hitstop. */
export const HITSTOP_FRACTION = 0.12;

/** Degrees the body lies at once it is down. */
export const FALL_DEGREES = 90;
/** Peak of the fall's overshoot, so the body settles rather than clicking into place. */
export const FALL_OVERSHOOT_DEGREES = 96;
/** Progress at which the overshoot peaks and the settle back to FALL_DEGREES begins. */
const FALL_OVERSHOOT_PROGRESS = 0.8;

const IMPACT_ANGLE_DEGREES = 14;
const IMPACT_OFFSET_PIXELS = 3;
const RECOIL_ANGLE_DEGREES = 4;
const RECOIL_OFFSET_PIXELS = 1;

const UPRIGHT: ImpactPose = Object.freeze({ offsetX: 0, offsetY: 0, angleDegrees: 0 });

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Being hit: the torso snaps in the direction of the force and HOLDS there for the hitstop, then
 * decays. The hold is what sells the collision as something that cost energy; without it the same
 * curve reads as a nudge.
 */
export function impactPose({ poseProgress, poseDirection, reducedMotion }: ImpactPoseInput): ImpactPose {
  if (reducedMotion) return UPRIGHT;
  const progress = clamp01(poseProgress);
  const decay = progress <= HITSTOP_FRACTION
    ? 1
    : (1 - (progress - HITSTOP_FRACTION) / (1 - HITSTOP_FRACTION)) ** 2;
  if (decay === 0) return UPRIGHT;
  return {
    offsetX: poseDirection * IMPACT_OFFSET_PIXELS * decay,
    offsetY: 0,
    angleDegrees: poseDirection * IMPACT_ANGLE_DEGREES * decay,
  };
}

/** Firing: the equal and opposite beat, short and small. */
export function recoilPose({ poseProgress, poseDirection, reducedMotion }: ImpactPoseInput): ImpactPose {
  if (reducedMotion) return UPRIGHT;
  const decay = (1 - clamp01(poseProgress)) ** 2;
  if (decay === 0) return UPRIGHT;
  return {
    offsetX: poseDirection * RECOIL_OFFSET_PIXELS * decay,
    offsetY: 0,
    angleDegrees: poseDirection * RECOIL_ANGLE_DEGREES * decay,
  };
}

/** The settled result of a fall. A state, not an animation. */
export function downPose(poseDirection: -1 | 1): ImpactPose {
  return { offsetX: 0, offsetY: 0, angleDegrees: poseDirection * FALL_DEGREES };
}

/**
 * Falling: accelerate past 90 degrees to the overshoot, then settle back onto it.
 *
 * Reduced motion is NOT a blanket zero here. Zeroing this would leave a shot character standing
 * upright for ever, which is a state error rather than a reduction in motion, so reduced motion
 * snaps straight to the terminal pose and skips only the animation.
 */
export function fallPose({ poseProgress, poseDirection, reducedMotion }: ImpactPoseInput): ImpactPose {
  if (reducedMotion) return downPose(poseDirection);
  const progress = clamp01(poseProgress);
  const degrees = progress < FALL_OVERSHOOT_PROGRESS
    ? FALL_OVERSHOOT_DEGREES * (progress / FALL_OVERSHOOT_PROGRESS) ** 2
    : FALL_OVERSHOOT_DEGREES + (FALL_DEGREES - FALL_OVERSHOOT_DEGREES) *
      ((progress - FALL_OVERSHOOT_PROGRESS) / (1 - FALL_OVERSHOOT_PROGRESS));
  return { offsetX: 0, offsetY: 0, angleDegrees: poseDirection * degrees };
}
