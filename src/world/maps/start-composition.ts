import type { CompiledMapV2 } from './compiled-v2';
import { pointsInRect, type TilePoint, type TileRect } from './schema';

export type StartCompositionTarget = Readonly<{
  id: string;
  surfaceWidth: number;
  surfaceHeight: number;
}>;

export type StartCompositionEvidence = Readonly<{
  targetId: string;
  zoom: 1 | 2 | 3;
  viewportWorldRect: Readonly<{ x: number; y: number; width: number; height: number }>;
}>;

export function selectAutomaticWorldZoom(surfaceWidth: number, surfaceHeight: number): 1 | 2 | 3 {
  if (!Number.isFinite(surfaceWidth) || !Number.isFinite(surfaceHeight) || surfaceWidth <= 0 || surfaceHeight <= 0) {
    throw new Error('World surface dimensions must be positive finite numbers.');
  }
  const choices = ([1, 2, 3] as const).map((zoom) => {
    const visibleWidth = Math.floor(surfaceWidth / (32 * zoom));
    const visibleHeight = Math.floor(surfaceHeight / (32 * zoom));
    const error = Math.max(Math.abs(visibleWidth / 40 - 1), Math.abs(visibleHeight / 22 - 1));
    return { zoom, error };
  });
  choices.sort((left, right) => left.error - right.error || left.zoom - right.zoom);
  return choices[0]!.zoom;
}

function viewportAroundAnchor(
  anchor: TilePoint,
  surfaceWidth: number,
  surfaceHeight: number,
  zoom: 1 | 2 | 3,
  mapWidth: number,
  mapHeight: number,
): Readonly<{ x: number; y: number; width: number; height: number }> {
  const width = surfaceWidth / zoom;
  const height = surfaceHeight / zoom;
  const mapPixelWidth = mapWidth * 32;
  const mapPixelHeight = mapHeight * 32;
  const desiredX = anchor.x * 32 + 16 - width / 2;
  const desiredY = anchor.y * 32 + 16 - height / 2;
  const x = width >= mapPixelWidth ? (mapPixelWidth - width) / 2 : Math.max(0, Math.min(desiredX, mapPixelWidth - width));
  const y = height >= mapPixelHeight ? (mapPixelHeight - height) / 2 : Math.max(0, Math.min(desiredY, mapPixelHeight - height));
  return { x, y, width, height };
}

function tileIntersects(tile: TilePoint, viewport: Readonly<{ x: number; y: number; width: number; height: number }>): boolean {
  const left = tile.x * 32;
  const top = tile.y * 32;
  return left < viewport.x + viewport.width && left + 32 > viewport.x &&
    top < viewport.y + viewport.height && top + 32 > viewport.y;
}

function areaIntersects(bounds: TileRect, viewport: Readonly<{ x: number; y: number; width: number; height: number }>): boolean {
  return pointsInRect(bounds).some((tile) => tileIntersects(tile, viewport));
}

export function validateStartComposition(
  map: CompiledMapV2,
  targets: readonly StartCompositionTarget[],
  requiredZooms: ReadonlySet<1 | 2 | 3> = new Set(),
): readonly StartCompositionEvidence[] {
  const composition = map.source.startComposition;
  if (!composition) throw new Error(`Map ${map.source.id} has no start composition.`);
  if (targets.length === 0) throw new Error('Start composition needs at least one responsive target.');
  const evidence = targets.map((target) => {
    const zoom = selectAutomaticWorldZoom(target.surfaceWidth, target.surfaceHeight);
    const viewport = viewportAroundAnchor(
      composition.cameraAnchor,
      target.surfaceWidth,
      target.surfaceHeight,
      zoom,
      map.source.width,
      map.source.height,
    );
    for (const actorId of composition.requiredActorIds) {
      const tile = map.source.spawns[actorId];
      if (!tile) throw new Error(`Start composition references unknown actor spawn ${actorId}.`);
      if (!tileIntersects(tile, viewport)) throw new Error(`Start actor ${actorId} is outside target ${target.id}.`);
    }
    for (const partId of composition.requiredDetailPartIds) {
      const part = map.objectPartById.get(partId);
      if (!part) throw new Error(`Start composition references unknown detail part ${partId}.`);
      if (!tileIntersects(part.tile, viewport)) throw new Error(`Start detail ${partId} is outside target ${target.id}.`);
    }
    for (const areaId of composition.landmarkAreaIds) {
      const area = map.areaById.get(areaId);
      if (!area) throw new Error(`Start composition references unknown landmark area ${areaId}.`);
      if (!areaIntersects(area.bounds, viewport)) throw new Error(`Start landmark ${areaId} is outside target ${target.id}.`);
    }
    return { targetId: target.id, zoom, viewportWorldRect: viewport };
  });
  const observedZooms = new Set(evidence.map(({ zoom }) => zoom));
  for (const zoom of requiredZooms) {
    if (!observedZooms.has(zoom)) throw new Error(`Start-composition targets never select required ${zoom}x zoom.`);
  }
  return evidence;
}
