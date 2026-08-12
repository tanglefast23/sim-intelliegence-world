export const MIN_WORLD_ZOOM = 1;
export const MAX_WORLD_ZOOM = 3;
export const WORLD_ZOOM_STEP = 0.05;

const ZOOM_STEPS_PER_UNIT = Math.round(1 / WORLD_ZOOM_STEP);
const FLOAT_TOLERANCE = 1e-8;

export function isWorldZoom(candidate: unknown): candidate is number {
  if (typeof candidate !== 'number' || !Number.isFinite(candidate)) return false;
  if (candidate < MIN_WORLD_ZOOM || candidate > MAX_WORLD_ZOOM) return false;
  return Math.abs(candidate * ZOOM_STEPS_PER_UNIT - Math.round(candidate * ZOOM_STEPS_PER_UNIT)) <
    FLOAT_TOLERANCE;
}

export function assertWorldZoom(candidate: number): number {
  if (!isWorldZoom(candidate)) {
    throw new RangeError('World zoom must be from 100% to 300% in 5% increments.');
  }
  return Math.round(candidate * 100) / 100;
}

export function stepWorldZoom(current: number, direction: -1 | 1): number {
  const next = assertWorldZoom(current) + direction * WORLD_ZOOM_STEP;
  const clamped = Math.min(MAX_WORLD_ZOOM, Math.max(MIN_WORLD_ZOOM, next));
  return Math.round(clamped * 100) / 100;
}

export function worldZoomPercentage(zoom: number): number {
  return Math.round(assertWorldZoom(zoom) * 100);
}
