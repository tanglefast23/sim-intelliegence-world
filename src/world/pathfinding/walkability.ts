import type { TilePoint } from '../maps/schema';
import { tileKey } from '../maps/schema';

export type StaticMovementBlockers = Readonly<{
  width: number;
  height: number;
  blockedKeys: ReadonlySet<string>;
}>;

export type SegmentClaimBlockers = StaticMovementBlockers & Readonly<{
  occupiedKeys?: ReadonlySet<string>;
  reservedKeys?: ReadonlySet<string>;
  selfKeys?: ReadonlySet<string>;
}>;

export function isStaticMovementBlocked(blockers: StaticMovementBlockers, tile: TilePoint): boolean {
  return tile.x < 0 || tile.y < 0 || tile.x >= blockers.width || tile.y >= blockers.height ||
    blockers.blockedKeys.has(tileKey(tile));
}

export function isSegmentClaimBlocked(blockers: SegmentClaimBlockers, tile: TilePoint): boolean {
  if (isStaticMovementBlocked(blockers, tile)) return true;
  const key = tileKey(tile);
  if (blockers.selfKeys?.has(key)) return false;
  return Boolean(blockers.occupiedKeys?.has(key) || blockers.reservedKeys?.has(key));
}

export function canTraverseDiagonal(
  blockers: StaticMovementBlockers,
  from: TilePoint,
  to: TilePoint,
): boolean {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  if (Math.abs(deltaX) !== 1 || Math.abs(deltaY) !== 1) return true;
  return !isStaticMovementBlocked(blockers, { x: from.x + deltaX, y: from.y }) &&
    !isStaticMovementBlocked(blockers, { x: from.x, y: from.y + deltaY });
}
