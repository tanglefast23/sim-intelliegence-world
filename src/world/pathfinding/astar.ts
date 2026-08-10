import type { TilePoint } from '../maps/schema';
import { tileKey } from '../maps/schema';

export type PathResult =
  | Readonly<{ status: 'found'; path: readonly TilePoint[]; visitedNodes: number }>
  | Readonly<{ status: 'unreachable'; reason: 'blocked-target' | 'no-route'; visitedNodes: number }>;

type SearchNode = Readonly<{
  tile: TilePoint;
  g: number;
  h: number;
  f: number;
  sequence: number;
}>;

const CARDINAL_DIRECTIONS: readonly TilePoint[] = [
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
];

function compareNodes(left: SearchNode, right: SearchNode): number {
  return left.f - right.f ||
    left.h - right.h ||
    left.tile.y - right.tile.y ||
    left.tile.x - right.tile.x ||
    left.sequence - right.sequence;
}

function manhattan(left: TilePoint, right: TilePoint): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
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

export function findCardinalPath(input: Readonly<{
  width: number;
  height: number;
  start: TilePoint;
  target: TilePoint;
  blockedKeys: ReadonlySet<string>;
}>): PathResult {
  const { width, height, start, target, blockedKeys } = input;
  const targetKey = tileKey(target);
  if (blockedKeys.has(targetKey)) return { status: 'unreachable', reason: 'blocked-target', visitedNodes: 0 };
  if (tileKey(start) === targetKey) return { status: 'found', path: [], visitedNodes: 0 };

  let sequence = 0;
  const initialH = manhattan(start, target);
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
        visitedNodes: closed.size,
      };
    }

    for (const direction of CARDINAL_DIRECTIONS) {
      const tile = { x: current.tile.x + direction.x, y: current.tile.y + direction.y };
      if (tile.x < 0 || tile.y < 0 || tile.x >= width || tile.y >= height) continue;
      const key = tileKey(tile);
      if (blockedKeys.has(key) || closed.has(key)) continue;
      const nextCost = current.g + 1;
      if (nextCost >= (bestCost.get(key) ?? Number.POSITIVE_INFINITY)) continue;
      bestCost.set(key, nextCost);
      parents.set(key, currentKey);
      points.set(key, tile);
      const h = manhattan(tile, target);
      sequence += 1;
      open.push({ tile, g: nextCost, h, f: nextCost + h, sequence });
    }
  }
  return { status: 'unreachable', reason: 'no-route', visitedNodes: closed.size };
}
