import {
  downPose,
  fallPose,
  FALL_DEGREES,
  FALL_OVERSHOOT_DEGREES,
  HITSTOP_FRACTION,
  impactPose,
  recoilPose,
} from '../impact-motion';

const hit = (poseProgress: number, poseDirection: -1 | 1 = 1, reducedMotion = false) =>
  impactPose({ poseProgress, poseDirection, reducedMotion });
const fall = (poseProgress: number, poseDirection: -1 | 1 = 1, reducedMotion = false) =>
  fallPose({ poseProgress, poseDirection, reducedMotion });

describe('impact and recoil', () => {
  test('holds the pose flat through the hitstop, then decays', () => {
    // Hitstop is the technique: time holds at the frame of contact so the collision reads as
    // something that cost energy. Without the hold the same curve reads as a nudge.
    const atContact = hit(0).angleDegrees;
    expect(hit(HITSTOP_FRACTION / 2).angleDegrees).toBe(atContact);
    expect(hit(HITSTOP_FRACTION).angleDegrees).toBe(atContact);
    expect(Math.abs(hit(HITSTOP_FRACTION + 0.01).angleDegrees)).toBeLessThan(Math.abs(atContact));
    expect(hit(1).angleDegrees).toBe(0);
    expect(hit(1).offsetX).toBe(0);
  });

  test('throws the body in the direction the force travels', () => {
    expect(hit(0, 1).angleDegrees).toBeGreaterThan(0);
    expect(hit(0, 1).offsetX).toBeGreaterThan(0);
    expect(hit(0, -1).angleDegrees).toBe(-hit(0, 1).angleDegrees);
  });

  test('the shooter kicks opposite the victim, and smaller', () => {
    // The two beats take OPPOSITE poseDirection values: a bullet flying right gives the victim +1
    // and the shooter -1. That is what makes the recoil read as equal and opposite.
    const victim = hit(0, 1).angleDegrees;
    const shooter = recoilPose({ poseProgress: 0, poseDirection: -1, reducedMotion: false }).angleDegrees;
    expect(Math.sign(shooter)).toBe(-Math.sign(victim));
    expect(Math.abs(shooter)).toBeLessThan(Math.abs(victim));
    expect(recoilPose({ poseProgress: 1, poseDirection: -1, reducedMotion: false }).angleDegrees).toBe(0);
  });

  test('clamps an overrunning scene clock instead of running away', () => {
    expect(hit(4).angleDegrees).toBe(hit(1).angleDegrees);
    expect(hit(-2).angleDegrees).toBe(hit(0).angleDegrees);
  });
});

describe('falling', () => {
  test('overshoots past ninety degrees and settles on exactly ninety', () => {
    expect(fall(0).angleDegrees).toBe(0);
    expect(fall(0.8).angleDegrees).toBeCloseTo(FALL_OVERSHOOT_DEGREES, 9);
    expect(Math.max(...[0.8, 0.85, 0.9].map((p) => fall(p).angleDegrees)))
      .toBeGreaterThan(FALL_DEGREES);
    expect(fall(1).angleDegrees).toBe(FALL_DEGREES);
    expect(fall(1).angleDegrees).toBe(downPose(1).angleDegrees);
    expect(fall(1, -1).angleDegrees).toBe(downPose(-1).angleDegrees);
  });
});

describe('reduced motion', () => {
  test('drops the pure motion beats', () => {
    expect(hit(0, 1, true)).toEqual({ offsetX: 0, offsetY: 0, angleDegrees: 0 });
    expect(recoilPose({ poseProgress: 0, poseDirection: 1, reducedMotion: true }))
      .toEqual({ offsetX: 0, offsetY: 0, angleDegrees: 0 });
  });

  test('still lands the body, because a shot character left standing is a state error', () => {
    expect(fall(0, 1, true).angleDegrees).toBe(FALL_DEGREES);
    expect(fall(0.5, -1, true).angleDegrees).toBe(-FALL_DEGREES);
  });
});
