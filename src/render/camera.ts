import type { TilePoint } from '../world/maps/schema';
import { assertZoomLevel, type ZoomLevel } from './atlas';

export type CameraState = Readonly<{ x: number; y: number; zoom: ZoomLevel }>;
export type ViewportSize = Readonly<{ width: number; height: number }>;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function clampCamera(
  camera: CameraState,
  viewport: ViewportSize,
  mapPixels: ViewportSize,
): CameraState {
  const visibleWidth = viewport.width / camera.zoom;
  const visibleHeight = viewport.height / camera.zoom;
  return {
    zoom: camera.zoom,
    x: Math.round(clamp(camera.x, 0, Math.max(0, mapPixels.width - visibleWidth))),
    y: Math.round(clamp(camera.y, 0, Math.max(0, mapPixels.height - visibleHeight))),
  };
}

export function centerCameraOnTile(
  tile: TilePoint,
  zoom: ZoomLevel,
  viewport: ViewportSize,
  mapPixels: ViewportSize,
  tileSize = 32,
): CameraState {
  return clampCamera({
    zoom,
    x: tile.x * tileSize + tileSize / 2 - viewport.width / zoom / 2,
    y: tile.y * tileSize + tileSize / 2 - viewport.height / zoom / 2,
  }, viewport, mapPixels);
}

export function panCamera(
  camera: CameraState,
  screenDelta: Readonly<{ x: number; y: number }>,
  viewport: ViewportSize,
  mapPixels: ViewportSize,
): CameraState {
  return clampCamera({
    ...camera,
    x: camera.x - screenDelta.x / camera.zoom,
    y: camera.y - screenDelta.y / camera.zoom,
  }, viewport, mapPixels);
}

export function zoomCameraAt(
  camera: CameraState,
  nextZoomCandidate: number,
  anchor: Readonly<{ x: number; y: number }>,
  viewport: ViewportSize,
  mapPixels: ViewportSize,
): CameraState {
  const nextZoom = assertZoomLevel(nextZoomCandidate);
  const worldX = camera.x + anchor.x / camera.zoom;
  const worldY = camera.y + anchor.y / camera.zoom;
  return clampCamera({
    zoom: nextZoom,
    x: worldX - anchor.x / nextZoom,
    y: worldY - anchor.y / nextZoom,
  }, viewport, mapPixels);
}

export function screenToTile(
  camera: CameraState,
  screen: Readonly<{ x: number; y: number }>,
  tileSize = 32,
): TilePoint {
  return {
    x: Math.floor((camera.x + screen.x / camera.zoom) / tileSize),
    y: Math.floor((camera.y + screen.y / camera.zoom) / tileSize),
  };
}

export function worldToScreen(
  camera: CameraState,
  world: Readonly<{ x: number; y: number }>,
): Readonly<{ x: number; y: number }> {
  return {
    x: Math.round((world.x - camera.x) * camera.zoom),
    y: Math.round((world.y - camera.y) * camera.zoom),
  };
}
