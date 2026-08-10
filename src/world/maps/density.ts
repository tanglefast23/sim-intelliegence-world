import type { CompiledObjectPartV2, DensityMetrics, StaticSolidOwner } from './compiled-v2';
import { pointsInRect, tileKey, type TilePoint, type TileRect, type WorldMapV2 } from './schema';

function tileOrder(left: TilePoint, right: TilePoint): number {
  return left.y - right.y || left.x - right.x;
}

function isInside(tile: TilePoint, bounds: TileRect): boolean {
  return tile.x >= bounds.x && tile.x < bounds.x + bounds.width &&
    tile.y >= bounds.y && tile.y < bounds.y + bounds.height;
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function assertRatio(label: string, value: number, minimum: number, maximum?: number): void {
  if (value < minimum || (maximum !== undefined && value > maximum)) {
    const range = maximum === undefined ? `at least ${minimum}` : `${minimum}-${maximum}`;
    throw new Error(`${label} must be ${range}; received ${value.toFixed(4)}.`);
  }
}

export function countOrthogonalClusters(tiles: readonly TilePoint[]): number {
  const remaining = new Set(tiles.map(tileKey));
  let clusters = 0;
  const ordered = [...tiles].sort(tileOrder);
  for (const start of ordered) {
    const startKey = tileKey(start);
    if (!remaining.delete(startKey)) continue;
    clusters += 1;
    const queue = [start];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const tile = queue[cursor]!;
      const neighbors = [
        { x: tile.x, y: tile.y - 1 },
        { x: tile.x - 1, y: tile.y },
        { x: tile.x + 1, y: tile.y },
        { x: tile.x, y: tile.y + 1 },
      ];
      for (const neighbor of neighbors) {
        if (!remaining.delete(tileKey(neighbor))) continue;
        queue.push(neighbor);
      }
    }
  }
  return clusters;
}

function allEmpty(
  emptyKeys: ReadonlySet<string>,
  startX: number,
  endX: number,
  startY: number,
  endY: number,
): boolean {
  for (let y = startY; y <= endY; y += 1) {
    for (let x = startX; x <= endX; x += 1) {
      if (!emptyKeys.has(`${x},${y}`)) return false;
    }
  }
  return true;
}

export function findMaximalEmptyRectangles(
  emptyKeys: ReadonlySet<string>,
  bounds: TileRect,
  minimumWidthExclusive = 6,
  minimumHeightExclusive = 6,
): TileRect[] {
  const results: TileRect[] = [];
  const maxX = bounds.x + bounds.width - 1;
  const maxY = bounds.y + bounds.height - 1;
  for (let top = bounds.y; top <= maxY; top += 1) {
    const columns = Array.from({ length: bounds.width }, () => true);
    for (let bottom = top; bottom <= maxY; bottom += 1) {
      for (let offset = 0; offset < bounds.width; offset += 1) {
        if (!emptyKeys.has(`${bounds.x + offset},${bottom}`)) columns[offset] = false;
      }
      const height = bottom - top + 1;
      if (height <= minimumHeightExclusive) continue;
      let offset = 0;
      while (offset < columns.length) {
        while (offset < columns.length && !columns[offset]) offset += 1;
        const start = offset;
        while (offset < columns.length && columns[offset]) offset += 1;
        const end = offset - 1;
        const width = end - start + 1;
        if (width <= minimumWidthExclusive) continue;
        const left = bounds.x + start;
        const right = bounds.x + end;
        const extendsLeft = left > bounds.x && allEmpty(emptyKeys, left - 1, left - 1, top, bottom);
        const extendsRight = right < maxX && allEmpty(emptyKeys, right + 1, right + 1, top, bottom);
        const extendsUp = top > bounds.y && allEmpty(emptyKeys, left, right, top - 1, top - 1);
        const extendsDown = bottom < maxY && allEmpty(emptyKeys, left, right, bottom + 1, bottom + 1);
        if (!extendsLeft && !extendsRight && !extendsUp && !extendsDown) {
          results.push({ x: left, y: top, width, height });
        }
      }
    }
  }
  return results.sort((left, right) => (
    left.y - right.y || left.x - right.x || left.height - right.height || left.width - right.width
  ));
}

export function measureAndValidateDensity(input: Readonly<{
  map: WorldMapV2;
  staticSolidOwnerByTile: ReadonlyMap<string, StaticSolidOwner>;
  objectParts: readonly CompiledObjectPartV2[];
}>): ReadonlyMap<string, DensityMetrics> {
  const { map, staticSolidOwnerByTile, objectParts } = input;
  const effectKeys = new Set(map.effects.map(({ tile }) => tileKey(tile)));
  const results = new Map<string, DensityMetrics>();
  for (const area of map.areas) {
    const areaTiles = pointsInRect(area.bounds);
    const eligibleTiles = areaTiles.filter((tile) => {
      const owner = staticSolidOwnerByTile.get(tileKey(tile));
      return owner?.kind !== 'terrain' && owner?.kind !== 'wall' && owner?.kind !== 'door';
    });
    if (eligibleTiles.length === 0) throw new Error(`Area ${area.id} has no eligible floor cells.`);
    const eligibleKeys = new Set(eligibleTiles.map(tileKey));
    const objectSolidKeys = new Set(eligibleTiles
      .filter((tile) => staticSolidOwnerByTile.get(tileKey(tile))?.kind === 'object')
      .map(tileKey));
    const areaParts = objectParts.filter(({ tile }) => eligibleKeys.has(tileKey(tile)));
    const detailKeys = new Set([
      ...areaParts.map(({ tile }) => tileKey(tile)),
      ...[...effectKeys].filter((key) => eligibleKeys.has(key)),
    ]);
    const areaObjects = map.objects.filter(({ areaId }) => areaId === area.id);
    const clusterTiles = [...new Map(areaParts.map(({ tile }) => [tileKey(tile), tile])).values()];
    const walkableCount = eligibleTiles.length - objectSolidKeys.size;
    const metrics: DensityMetrics = {
      areaId: area.id,
      profile: area.densityProfile,
      eligibleCellCount: eligibleTiles.length,
      objectSolidCellCount: objectSolidKeys.size,
      detailCellCount: detailKeys.size,
      walkableCellCount: walkableCount,
      objectSolidRatio: ratio(objectSolidKeys.size, eligibleTiles.length),
      detailRatio: ratio(detailKeys.size, eligibleTiles.length),
      walkableRatio: ratio(walkableCount, eligibleTiles.length),
      objectPartCount: areaParts.length,
      distinctObjectKinds: new Set(areaObjects.map(({ kind }) => kind)).size,
      objectClusterCount: countOrthogonalClusters(clusterTiles),
    };

    if (area.densityProfile === 'furnished-interior') {
      assertRatio(`Area ${area.id} solid-object ratio`, metrics.objectSolidRatio, 0.08, 0.30);
      assertRatio(`Area ${area.id} detail ratio`, metrics.detailRatio, 0.12);
      assertRatio(`Area ${area.id} walkable ratio`, metrics.walkableRatio, 0.55);
      if (metrics.eligibleCellCount > 24 && (metrics.objectPartCount < 3 || metrics.distinctObjectKinds < 2)) {
        throw new Error(`Area ${area.id} needs three object parts and two object kinds.`);
      }
      const intentionalKeys = new Set(area.intentionalOpenAreas.flatMap(pointsInRect).map(tileKey));
      const emptyKeys = new Set(eligibleTiles.map(tileKey).filter((key) => !detailKeys.has(key)));
      const unmarkedRectangles = findMaximalEmptyRectangles(emptyKeys, area.bounds).filter((rectangle) => (
        pointsInRect(rectangle).some((tile) => !intentionalKeys.has(tileKey(tile)))
      ));
      if (unmarkedRectangles.length > 0) {
        throw new Error(`Area ${area.id} contains an unmarked empty rectangle larger than 6x6.`);
      }
    } else if (area.densityProfile === 'active-public') {
      assertRatio(`Area ${area.id} solid-object ratio`, metrics.objectSolidRatio, 0.02, 0.12);
      assertRatio(`Area ${area.id} detail ratio`, metrics.detailRatio, 0.08, 0.24);
      if (metrics.objectClusterCount < 2) throw new Error(`Area ${area.id} needs two object clusters.`);
    } else if (area.densityProfile === 'relaxation-natural') {
      assertRatio(`Area ${area.id} solid-object ratio`, metrics.objectSolidRatio, 0.01, 0.08);
      assertRatio(`Area ${area.id} detail ratio`, metrics.detailRatio, 0.05, 0.18);
    } else if (area.densityProfile === 'service-docks') {
      assertRatio(`Area ${area.id} solid-object ratio`, metrics.objectSolidRatio, 0.05, 0.22);
      assertRatio(`Area ${area.id} detail ratio`, metrics.detailRatio, 0.08, 0.25);
    } else {
      const structuralSolidCount = areaTiles.filter((tile) => {
        const kind = staticSolidOwnerByTile.get(tileKey(tile))?.kind;
        return kind === 'wall' || kind === 'object';
      }).length;
      if (structuralSolidCount < 6 || metrics.detailCellCount < 8) {
        throw new Error(`Area ${area.id} does not meet the structural-placeholder minimum.`);
      }
    }
    results.set(area.id, metrics);
  }
  return results;
}
