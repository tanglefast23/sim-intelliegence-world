import type { TilePoint } from '../maps/schema';

export const TILE_SIZE = 32;
export const WORLD_MOVEMENT_SPEED_SCALE = 0.8;
export const CARDINAL_SEGMENT_MS = 145 / WORLD_MOVEMENT_SPEED_SCALE;
export const DIAGONAL_SEGMENT_MS = 205 / WORLD_MOVEMENT_SPEED_SCALE;
export const MAX_MOVEMENT_FRAME_MS = 50;

export type WorldPoint = Readonly<{ x: number; y: number }>;
export type MotionSegment = Readonly<{
  from: TilePoint;
  to: TilePoint;
  elapsedMs: number;
  durationMs: number;
}>;

export function tileFootPoint(tile: TilePoint): WorldPoint {
  return { x: tile.x * TILE_SIZE + 16, y: tile.y * TILE_SIZE + 29 };
}

export function segmentDuration(from: TilePoint, to: TilePoint): number {
  return from.x !== to.x && from.y !== to.y ? DIAGONAL_SEGMENT_MS : CARDINAL_SEGMENT_MS;
}

export function segmentLength(from: TilePoint, to: TilePoint): number {
  return Math.hypot((to.x - from.x) * TILE_SIZE, (to.y - from.y) * TILE_SIZE);
}

export function sampleSegment(segment: MotionSegment): WorldPoint {
  const from = tileFootPoint(segment.from);
  const to = tileFootPoint(segment.to);
  const progress = Math.max(0, Math.min(1, segment.elapsedMs / segment.durationMs));
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  };
}

export function routeMotionProgress(
  progress: number,
  easeIn: boolean,
  easeOut: boolean,
): number {
  const t = Math.max(0, Math.min(1, progress));
  if (easeIn && easeOut) return t * t * (3 - 2 * t);
  if (easeIn) return t * t * (2 - t);
  if (easeOut) return t + t * t - t * t * t;
  return t;
}

export function sampleSegmentAtProgress(segment: MotionSegment, progress: number): WorldPoint {
  const from = tileFootPoint(segment.from);
  const to = tileFootPoint(segment.to);
  const t = Math.max(0, Math.min(1, progress));
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}

export function snapWorldPoint(point: WorldPoint, zoom: 1 | 2 | 3, dpr: number): WorldPoint {
  const physicalScale = zoom * Math.max(1, dpr);
  return {
    x: Math.round(point.x * physicalScale) / physicalScale,
    y: Math.round(point.y * physicalScale) / physicalScale,
  };
}
