import type { TilePoint } from '../world/maps/schema';
import { assertWorldZoom } from '../domain/presentation/world-zoom';

export type CameraState = Readonly<{ x: number; y: number; zoom: number }>;
export type ViewportSize = Readonly<{ width: number; height: number }>;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function cameraAxisBounds(viewportPixels: number, mapPixels: number, zoom: number): Readonly<{
  minimum: number;
  maximum: number;
}> {
  const visibleWorldPixels = viewportPixels / zoom;
  if (visibleWorldPixels >= mapPixels) {
    const centered = (mapPixels - visibleWorldPixels) / 2;
    return { minimum: centered, maximum: centered };
  }
  return { minimum: 0, maximum: mapPixels - visibleWorldPixels };
}

export function clampCamera(
  camera: CameraState,
  viewport: ViewportSize,
  mapPixels: ViewportSize,
): CameraState {
  const zoom = assertWorldZoom(camera.zoom);
  const horizontal = cameraAxisBounds(viewport.width, mapPixels.width, zoom);
  const vertical = cameraAxisBounds(viewport.height, mapPixels.height, zoom);
  return {
    zoom,
    x: Math.round(clamp(camera.x, horizontal.minimum, horizontal.maximum)),
    y: Math.round(clamp(camera.y, vertical.minimum, vertical.maximum)),
  };
}

export function resizeCameraPreservingCenter(
  camera: CameraState,
  oldViewport: ViewportSize,
  nextViewport: ViewportSize,
  nextZoom: number,
  mapPixels: ViewportSize,
): CameraState {
  const centerWorldX = camera.x + oldViewport.width / camera.zoom / 2;
  const centerWorldY = camera.y + oldViewport.height / camera.zoom / 2;
  return clampCamera({
    zoom: nextZoom,
    x: centerWorldX - nextViewport.width / nextZoom / 2,
    y: centerWorldY - nextViewport.height / nextZoom / 2,
  }, nextViewport, mapPixels);
}

export function centerCameraOnTile(
  tile: TilePoint,
  zoom: number,
  viewport: ViewportSize,
  mapPixels: ViewportSize,
  tileSize = 32,
): CameraState {
  return centerCameraOnWorld({ x: tile.x * tileSize + tileSize / 2, y: tile.y * tileSize + tileSize / 2 }, zoom, viewport, mapPixels);
}

export function centerCameraOnWorld(
  point: Readonly<{ x: number; y: number }>,
  zoom: number,
  viewport: ViewportSize,
  mapPixels: ViewportSize,
): CameraState {
  return clampCamera({
    zoom,
    x: point.x - viewport.width / zoom / 2,
    y: point.y - viewport.height / zoom / 2,
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
  const nextZoom = assertWorldZoom(nextZoomCandidate);
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

export function isScreenPointInsideMap(
  camera: CameraState,
  screen: Readonly<{ x: number; y: number }>,
  mapPixels: ViewportSize,
): boolean {
  const worldX = camera.x + screen.x / camera.zoom;
  const worldY = camera.y + screen.y / camera.zoom;
  return worldX >= 0 && worldY >= 0 && worldX < mapPixels.width && worldY < mapPixels.height;
}
