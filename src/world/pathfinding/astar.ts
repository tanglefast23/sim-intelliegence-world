import type { TilePoint } from '../maps/schema';
import { tileKey } from '../maps/schema';
import { canTraverseDiagonal, isStaticMovementBlocked } from './walkability';

export type PathResult =
  | Readonly<{ status: 'found'; path: readonly TilePoint[]; totalCost: number; visitedNodes: number }>
  | Readonly<{ status: 'unreachable'; reason: 'blocked-target' | 'no-route'; visitedNodes: number }>;

type SearchNode = Readonly<{
  tile: TilePoint;
  g: number;
  h: number;
  f: number;
  sequence: number;
}>;

export const PATH_DIRECTIONS: readonly Readonly<TilePoint & { cost: 10 | 14 }>[] = [
  { x: 0, y: -1, cost: 10 },
  { x: -1, y: -1, cost: 14 },
  { x: -1, y: 0, cost: 10 },
  { x: -1, y: 1, cost: 14 },
  { x: 0, y: 1, cost: 10 },
  { x: 1, y: 1, cost: 14 },
  { x: 1, y: 0, cost: 10 },
  { x: 1, y: -1, cost: 14 },
];

function compareNodes(left: SearchNode, right: SearchNode): number {
  return left.f - right.f ||
    left.h - right.h ||
    left.tile.y - right.tile.y ||
    left.tile.x - right.tile.x ||
    left.sequence - right.sequence;
}

export function octileDistance(left: TilePoint, right: TilePoint): number {
  const deltaX = Math.abs(left.x - right.x);
  const deltaY = Math.abs(left.y - right.y);
  const diagonal = Math.min(deltaX, deltaY);
  return diagonal * 14 + (Math.max(deltaX, deltaY) - diagonal) * 10;
}

function reconstructPath(
  parents: ReadonlyMap<string, string>,
  points: ReadonlyMap<string, TilePoint>,
  start: TilePoint,
  target: TilePoint,
): TilePoint[] {
  const path: TilePoint[] = [];
  let cursor = tileKey(target);
  const startKey = tileKey(start);
  while (cursor !== startKey) {
    const point = points.get(cursor);
    const parent = parents.get(cursor);
    if (!point || !parent) throw new Error('Path reconstruction lost a parent node.');
    path.push(point);
    cursor = parent;
  }
  return path.reverse();
}

export function findPath(input: Readonly<{
  width: number;
  height: number;
  start: TilePoint;
  target: TilePoint;
  blockedKeys: ReadonlySet<string>;
}>): PathResult {
  const { width, height, start, target, blockedKeys } = input;
  const targetKey = tileKey(target);
  if (blockedKeys.has(targetKey)) return { status: 'unreachable', reason: 'blocked-target', visitedNodes: 0 };
  if (tileKey(start) === targetKey) return { status: 'found', path: [], totalCost: 0, visitedNodes: 0 };

  let sequence = 0;
  const initialH = octileDistance(start, target);
  const open: SearchNode[] = [{ tile: start, g: 0, h: initialH, f: initialH, sequence }];
  const bestCost = new Map<string, number>([[tileKey(start), 0]]);
  const parents = new Map<string, string>();
  const points = new Map<string, TilePoint>([[tileKey(start), start]]);
  const closed = new Set<string>();

  while (open.length > 0) {
    open.sort(compareNodes);
    const current = open.shift();
    if (!current) break;
    const currentKey = tileKey(current.tile);
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);
    if (currentKey === targetKey) {
      return {
        status: 'found',
        path: reconstructPath(parents, points, start, target),
        totalCost: current.g,
        visitedNodes: closed.size,
      };
    }

    for (const direction of PATH_DIRECTIONS) {
      const tile = { x: current.tile.x + direction.x, y: current.tile.y + direction.y };
      const blockers = { width, height, blockedKeys };
      if (isStaticMovementBlocked(blockers, tile) || !canTraverseDiagonal(blockers, current.tile, tile)) continue;
      const key = tileKey(tile);
      if (closed.has(key)) continue;
      const nextCost = current.g + direction.cost;
      if (nextCost >= (bestCost.get(key) ?? Number.POSITIVE_INFINITY)) continue;
      bestCost.set(key, nextCost);
      parents.set(key, currentKey);
      points.set(key, tile);
      const h = octileDistance(tile, target);
      sequence += 1;
      open.push({ tile, g: nextCost, h, f: nextCost + h, sequence });
    }
  }
  return { status: 'unreachable', reason: 'no-route', visitedNodes: closed.size };
}
