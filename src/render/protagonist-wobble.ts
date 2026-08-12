import type { MovementDirection, MovementState } from '../world/pathfinding/movement';

export const PROTAGONIST_WOBBLE_AMPLITUDE_DEGREES = 15;
export const PROTAGONIST_WOBBLE_SETTLE_DISTANCE = 96;
export const PROTAGONIST_WOBBLE_PIVOT = Object.freeze({ x: 12, y: 29 });

export type ProtagonistWobbleInput = Readonly<{
  direction: MovementDirection;
  status: MovementState['status'];
  horizontalRunDistance: number;
  reducedMotion: boolean;
}>;

export function protagonistWobbleDegrees({
  direction,
  status,
  horizontalRunDistance,
  reducedMotion,
}: ProtagonistWobbleInput): number {
  if (
    reducedMotion ||
    status !== 'moving' ||
    (direction !== 'left' && direction !== 'right') ||
    horizontalRunDistance <= 0 ||
    horizontalRunDistance >= PROTAGONIST_WOBBLE_SETTLE_DISTANCE ||
    horizontalRunDistance === 32 ||
    horizontalRunDistance === 64
  ) return 0;

  const progress = Math.max(0, Math.min(
    1,
    horizontalRunDistance / PROTAGONIST_WOBBLE_SETTLE_DISTANCE,
  ));
  const directionSign = direction === 'left' ? -1 : 1;
  return directionSign * PROTAGONIST_WOBBLE_AMPLITUDE_DEGREES *
    Math.sin(3 * Math.PI * progress) * (1 - progress) ** 2;
}

export type BottomPivotTransformInput = Readonly<{
  worldX: number;
  worldY: number;
  zoom: 1 | 2 | 3;
  angleDegrees: number;
  pivotX?: number;
  pivotY?: number;
}>;

export type BottomPivotTransform = Readonly<{
  scos: number;
  ssin: number;
  tx: number;
  ty: number;
}>;

export function bottomPivotTransform({
  worldX,
  worldY,
  zoom,
  angleDegrees,
  pivotX = PROTAGONIST_WOBBLE_PIVOT.x,
  pivotY = PROTAGONIST_WOBBLE_PIVOT.y,
}: BottomPivotTransformInput): BottomPivotTransform {
  if (angleDegrees === 0) {
    return { scos: zoom, ssin: 0, tx: worldX * zoom, ty: worldY * zoom };
  }
  const thetaRadians = angleDegrees * Math.PI / 180;
  const scos = zoom * Math.cos(thetaRadians);
  const ssin = zoom * Math.sin(thetaRadians);
  return {
    scos,
    ssin,
    tx: (worldX + pivotX) * zoom - (scos * pivotX - ssin * pivotY),
    ty: (worldY + pivotY) * zoom - (ssin * pivotX + scos * pivotY),
  };
}
