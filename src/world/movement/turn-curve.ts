import type { CompiledMapV2 } from '../maps/compiled-v2';
import type { TilePoint } from '../maps/schema';
import { tileKey } from '../maps/schema';
import { tileFootPoint, type WorldPoint } from './motion-clock';

export const TURN_RADIUS = 6;
export const FOOT_CLEARANCE_RADIUS = 3;

export type TurnCurve = Readonly<{
  start: WorldPoint;
  control: WorldPoint;
  end: WorldPoint;
  touchedTileKeys: readonly string[];
}>;

const ARC_LENGTH_SAMPLES = 16;

function unit(from: WorldPoint, to: WorldPoint): WorldPoint {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const length = Math.hypot(deltaX, deltaY);
  return length === 0 ? { x: 0, y: 0 } : { x: deltaX / length, y: deltaY / length };
}

function touchedTiles(start: WorldPoint, control: WorldPoint, end: WorldPoint): TilePoint[] {
  const minimumX = Math.floor((Math.min(start.x, control.x, end.x) - FOOT_CLEARANCE_RADIUS) / 32);
  const maximumX = Math.floor((Math.max(start.x, control.x, end.x) + FOOT_CLEARANCE_RADIUS) / 32);
  const minimumY = Math.floor((Math.min(start.y, control.y, end.y) - FOOT_CLEARANCE_RADIUS) / 32);
  const maximumY = Math.floor((Math.max(start.y, control.y, end.y) + FOOT_CLEARANCE_RADIUS) / 32);
  const tiles: TilePoint[] = [];
  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) tiles.push({ x, y });
  }
  return tiles;
}

export function buildTurnCurve(
  map: CompiledMapV2,
  previous: TilePoint,
  corner: TilePoint,
  next: TilePoint,
  dynamicBlockers: ReadonlySet<string> = new Set(),
): TurnCurve | undefined {
  const incoming = { x: corner.x - previous.x, y: corner.y - previous.y };
  const outgoing = { x: next.x - corner.x, y: next.y - corner.y };
  if (incoming.x === outgoing.x && incoming.y === outgoing.y) return undefined;
  if (incoming.x === -outgoing.x && incoming.y === -outgoing.y) return undefined;
  const previousPoint = tileFootPoint(previous);
  const cornerPoint = tileFootPoint(corner);
  const nextPoint = tileFootPoint(next);
  const incomingUnit = unit(previousPoint, cornerPoint);
  const outgoingUnit = unit(cornerPoint, nextPoint);
  const start = {
    x: cornerPoint.x - incomingUnit.x * TURN_RADIUS,
    y: cornerPoint.y - incomingUnit.y * TURN_RADIUS,
  };
  const end = {
    x: cornerPoint.x + outgoingUnit.x * TURN_RADIUS,
    y: cornerPoint.y + outgoingUnit.y * TURN_RADIUS,
  };
  const routeKeys = new Set([tileKey(previous), tileKey(corner), tileKey(next)]);
  const touched = touchedTiles(start, cornerPoint, end);
  if (touched.some((tile) => (
    tile.x < 0 || tile.y < 0 || tile.x >= map.source.width || tile.y >= map.source.height ||
    map.blockedKeys.has(tileKey(tile)) || (dynamicBlockers.has(tileKey(tile)) && !routeKeys.has(tileKey(tile)))
  ))) return undefined;
  return { start, control: cornerPoint, end, touchedTileKeys: touched.map(tileKey).sort() };
}

export function sampleQuadratic(curve: TurnCurve, progress: number): WorldPoint {
  const t = Math.max(0, Math.min(1, progress));
  const inverse = 1 - t;
  return {
    x: inverse * inverse * curve.start.x + 2 * inverse * t * curve.control.x + t * t * curve.end.x,
    y: inverse * inverse * curve.start.y + 2 * inverse * t * curve.control.y + t * t * curve.end.y,
  };
}

export function sampleQuadraticByDistance(curve: TurnCurve, progress: number): WorldPoint {
  const targetProgress = Math.max(0, Math.min(1, progress));
  const points: WorldPoint[] = [];
  const cumulativeLengths = [0];
  let totalLength = 0;
  for (let index = 0; index <= ARC_LENGTH_SAMPLES; index += 1) {
    const point = sampleQuadratic(curve, index / ARC_LENGTH_SAMPLES);
    points.push(point);
    if (index > 0) {
      const previousPoint = points[index - 1]!;
      totalLength += Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y);
      cumulativeLengths.push(totalLength);
    }
  }
  if (totalLength === 0) return { ...curve.end };
  const targetLength = totalLength * targetProgress;
  let upperIndex = 1;
  while (upperIndex < cumulativeLengths.length && cumulativeLengths[upperIndex]! < targetLength) {
    upperIndex += 1;
  }
  const boundedUpperIndex = Math.min(upperIndex, ARC_LENGTH_SAMPLES);
  const lowerIndex = Math.max(0, boundedUpperIndex - 1);
  const lowerLength = cumulativeLengths[lowerIndex]!;
  const upperLength = cumulativeLengths[boundedUpperIndex]!;
  const localProgress = upperLength === lowerLength
    ? 0
    : (targetLength - lowerLength) / (upperLength - lowerLength);
  const lower = points[lowerIndex]!;
  const upper = points[boundedUpperIndex]!;
  return {
    x: lower.x + (upper.x - lower.x) * localProgress,
    y: lower.y + (upper.y - lower.y) * localProgress,
  };
}
