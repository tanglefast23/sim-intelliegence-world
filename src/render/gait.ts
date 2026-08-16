import { segmentLength, tileFootPoint, type WorldPoint } from '../world/movement/motion-clock';
import { TURN_RADIUS, type TurnCurve } from '../world/movement/turn-curve';
import type { MovementDirection, MovementState } from '../world/pathfinding/movement';

/**
 * Render-layer gait. Every value here is a pure read of a MovementState the simulation already
 * produced, so nothing in this file can move a character, change a duration, or draw from the PRNG.
 *
 * `protagonist-wobble.ts` is the model: literal zero under reduced motion, closed-form curves, no
 * integrator and no clock of its own.
 *
 * What is deliberately NOT here, because it already ships:
 *   - positional ease in and out at a route's ends  -> `routeMotionProgress` in motion-clock.ts
 *   - the acceleration lean when a horizontal run starts -> `protagonistWobbleDegrees`
 *   - the one-pixel alternating bounce -> `movementPresentation` in atlas.ts
 */

/**
 * One foot plant per 32 world pixels TRAVELLED, which is exactly one flip of
 * `MovementState.walkFrame` (`walkFrame = floor(travelDistance / 32) % 2`).
 *
 * Distance, not tiles. A diagonal segment is hypot(32, 32) = 45.25 px, so on a diagonal route the
 * plants do not land on tile boundaries. That is correct: a stride is a distance.
 */
export const STRIDE_PIXELS = 32;

/**
 * Peak lean into a corner, in degrees, BEFORE the apex ramp is applied.
 *
 * The ramp cannot reach 1. At the apex of a 90-degree corner the Bezier midpoint sits
 * hypot(TURN_RADIUS / 4, TURN_RADIUS / 4) = 2.12 px from the control point, so the ramp peaks at
 * 1 - 2.12 / 6 = 0.646 and the corner actually reads at about 5.8 degrees. The constant is 9 rather
 * than 6 for exactly that reason.
 */
export const TURN_LEAN_DEGREES = 9;

/** Peak pitch back against travel while stopping, in degrees. */
export const STOP_LEAN_DEGREES = 5;

/**
 * Cap on the composed character angle.
 *
 * `protagonistWobbleDegrees` alone reaches 15. Without a cap, a corner taken during the opening lean
 * of a run would compose to 21 degrees and read as drunk rather than as weight.
 */
export const MAX_COMPOSED_ANGLE_DEGREES = 16;

/** Dip into the down pose just after contact, in world pixels. */
const BOB_DOWN_PIXELS = 1.6;
/** Rise at the passing pose, in world pixels. */
const BOB_LIFT_PIXELS = 1.2;
/** Makes `q^2 * (1 - q)` peak at exactly 1, at q = 2/3. */
const STOP_ENVELOPE_SCALE = 6.75;

export type GaitInput = Readonly<{
  travelDistance: number;
  moving: boolean;
  reducedMotion: boolean;
}>;

/**
 * Stride phase in [0, 1). 0 is contact, the frame a foot lands.
 *
 * `travelDistance` is the simulation's own accumulator and is monotonic within a route, so this is a
 * deterministic stride clock that costs no new state.
 */
export function gaitStridePhase(travelDistance: number): number {
  if (!(travelDistance > 0)) return 0;
  return (travelDistance % STRIDE_PIXELS) / STRIDE_PIXELS;
}

/**
 * Vertical bob synced to the stride, in world pixels, positive DOWN.
 *
 * The phase is the whole technique. A walk cycle runs contact -> down -> passing -> up, and the hips
 * are at their LOWEST in the down pose, just after the foot plants and the leading knee bends to
 * absorb the body's weight, then at their HIGHEST at passing. A naive sine that peaks at contact
 * reads as a bounce; this reads as weight.
 *
 *   bob(p) = 1.6 * sin(2*pi*p) * (1 - p)^2  -  1.2 * sin(pi*p)
 *
 *   p     0     0.10    0.25    0.50    0.75    1
 *   bob   0   +0.391  +0.051  -1.200  -0.949   0
 *
 * 1.6 px peak to peak on a 30 px sprite, inside the one-to-three-pixel band that pixel-art practice
 * works in. Literal zero at every contact, so the wrap has no seam.
 *
 * The caller snaps the result to the device-pixel lattice. At 1x that quantises to whole pixels,
 * which is the intended crunchy look and also the free distance degrade; at 3x with DPR 2 there are
 * six sub-steps per world pixel and the same curve reads as smooth.
 */
export function gaitBobPixels({ travelDistance, moving, reducedMotion }: GaitInput): number {
  if (reducedMotion || !moving) return 0;
  const phase = gaitStridePhase(travelDistance);
  if (phase === 0) return 0;
  return BOB_DOWN_PIXELS * Math.sin(2 * Math.PI * phase) * (1 - phase) ** 2 -
    BOB_LIFT_PIXELS * Math.sin(Math.PI * phase);
}

export type GaitTurnInput = Readonly<{
  turnCurve: TurnCurve | undefined;
  foot: WorldPoint;
  reducedMotion: boolean;
}>;

/**
 * Momentum lean into a latched turn curve, in degrees.
 *
 * The sign is the x component of the heading change, which is the curve's second difference:
 * `end.x - 2 * control.x + start.x`. `buildTurnCurve` places start and end exactly TURN_RADIUS from
 * the corner, so both legs share a magnitude and the raw difference needs no normalising. A runner
 * rolls INTO the corner, so the body tips toward the inside of the arc in screen x.
 *
 * The ramp is live geometry — distance from the foot to the control point — so the lean peaks at the
 * apex and self-cancels on the way out. That matters: `latchedTurnCurve` is not cleared until the
 * route ends, so a phase-based ramp would keep leaning long after the corner.
 */
export function gaitTurnLeanDegrees({ turnCurve, foot, reducedMotion }: GaitTurnInput): number {
  if (reducedMotion || !turnCurve) return 0;
  const curvatureX = turnCurve.end.x - 2 * turnCurve.control.x + turnCurve.start.x;
  if (curvatureX === 0) return 0;
  const distance = Math.hypot(foot.x - turnCurve.control.x, foot.y - turnCurve.control.y);
  if (distance >= TURN_RADIUS) return 0;
  return Math.sign(curvatureX) * TURN_LEAN_DEGREES * (1 - distance / TURN_RADIUS);
}

export type GaitStopInput = Readonly<{
  direction: MovementDirection;
  /** Progress through the route's FINAL segment. Undefined on any other segment. */
  stopProgress: number | undefined;
  reducedMotion: boolean;
}>;

/**
 * Deceleration lean, in degrees. Pitches the body BACK against the direction of travel as the actor
 * arrives, then returns it upright.
 *
 * The envelope is `6.75 * q^2 * (1 - q)`: it peaks at exactly 1 at q = 2/3 and is exactly 0 at
 * q = 1. That last property is the point. q = 1 is the frame `status` flips to `idle`, and a `q^2`
 * envelope would peak there and snap to zero — a visible three-pixel pop at every horizontal stop.
 * This one arrives upright on its own, so the handover to idle is invisible, and no post-stop clock
 * is needed to settle anything.
 *
 * Horizontal only, and about the same bottom pivot as the shipped wobble: a rigid quad rotating
 * about its feet has no meaningful roll axis for up and down, and a vertical pitch would need a
 * Y-shear the sprite geometry does not have.
 */
export function gaitStopLeanDegrees({ direction, stopProgress, reducedMotion }: GaitStopInput): number {
  if (reducedMotion || stopProgress === undefined) return 0;
  if (direction !== 'left' && direction !== 'right') return 0;
  const q = Math.max(0, Math.min(1, stopProgress));
  const envelope = STOP_ENVELOPE_SCALE * q * q * (1 - q);
  if (envelope === 0) return 0;
  return (direction === 'right' ? -1 : 1) * STOP_LEAN_DEGREES * envelope;
}

/** Composes the shipped wobble with the two new leans and caps the result. */
export function gaitAngleDegrees(
  wobbleDegrees: number,
  turnLeanDegrees: number,
  stopLeanDegrees: number,
): number {
  const total = wobbleDegrees + turnLeanDegrees + stopLeanDegrees;
  if (total > MAX_COMPOSED_ANGLE_DEGREES) return MAX_COMPOSED_ANGLE_DEGREES;
  if (total < -MAX_COMPOSED_ANGLE_DEGREES) return -MAX_COMPOSED_ANGLE_DEGREES;
  return total;
}

export type FootPlant = Readonly<{
  /** 'protagonist', or the NPC state id. */
  actorId: string;
  /**
   * Plant counter within the current route: floor(travelDistance / 32). Monotonic while a route
   * runs; resets to 0 when the route replans or ends.
   *
   * CONSUMER RULE: keep the last DEFINED index per actor and fire when it changes, in either
   * direction. `undefined` is a gap, not an event — a replan frame has no segment, so the sequence
   * reads N-1 -> undefined -> 0, and treating undefined -> 0 as a transition double-fires.
   */
  index: number;
  /** 0 or 1. Equal to MovementState.walkFrame, so left and right feet alternate. */
  foot: 0 | 1;
  /** World pixels travelled since contact, always in [0, 32). The plant's age, in pixels. */
  distanceSincePixels: number;
  /** Ground contact point — the FOOT line, the same anchor `characterShadows` uses. */
  worldX: number;
  worldY: number;
  direction: MovementDirection;
}>;

/**
 * The foot plant an actor is currently inside, or undefined when it is not walking.
 *
 * The contact point is back-projected from the live foot along the current heading. It is EXACT only
 * on a mid-route segment, where `routeMotionProgress` returns its input unchanged. Two bounded
 * errors elsewhere, both under a tile and neither worth correcting for a dust puff:
 *
 *   - Eased segments. On a route's first segment (easeIn) and last (easeOut) the foot advances at
 *     eased progress while `travelDistance` accumulates linearly with time. Peak error about 4.8 px.
 *   - Turn curves. Inside a latched corner the path is a Bezier, not a line. Error bounded by
 *     TURN_RADIUS = 6 px, for one stride.
 *
 * Both scale with `distanceSincePixels`, so spawning on the frame where it is smallest minimises them.
 *
 * No reducedMotion argument: a plant is geometry, not motion. The consumer owns that policy.
 */
export function actorFootPlant(actorId: string, movement: MovementState): FootPlant | undefined {
  const segment = movement.segment;
  if (!segment || movement.status !== 'moving') return undefined;
  const index = Math.floor(movement.travelDistance / STRIDE_PIXELS);
  const distanceSincePixels = movement.travelDistance - index * STRIDE_PIXELS;
  const from = tileFootPoint(segment.from);
  const to = tileFootPoint(segment.to);
  const length = segmentLength(segment.from, segment.to);
  const headingX = length === 0 ? 0 : (to.x - from.x) / length;
  const headingY = length === 0 ? 0 : (to.y - from.y) / length;
  return {
    actorId,
    index,
    foot: (index % 2) as 0 | 1,
    distanceSincePixels,
    worldX: movement.visualFoot.x - headingX * distanceSincePixels,
    worldY: movement.visualFoot.y - headingY * distanceSincePixels,
    direction: movement.direction,
  };
}
