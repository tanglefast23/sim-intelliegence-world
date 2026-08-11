import type { TilePoint } from '../maps/schema';
import type { VisualBounds } from './recipes';

export type TileWindow = Readonly<{
  minimumX: number;
  minimumY: number;
  maximumX: number;
  maximumY: number;
}>;

export const TILE_VISUAL_BOUNDS: VisualBounds = Object.freeze({
  left: 0,
  top: 0,
  right: 32,
  bottom: 32,
});

export function visualBoundsIntersectTileWindow(
  tile: TilePoint,
  visualBounds: VisualBounds,
  window: TileWindow,
  tileSize = 32,
): boolean {
  const minimumWorldX = window.minimumX * tileSize;
  const minimumWorldY = window.minimumY * tileSize;
  const maximumWorldX = (window.maximumX + 1) * tileSize;
  const maximumWorldY = (window.maximumY + 1) * tileSize;
  const anchorX = tile.x * tileSize;
  const anchorY = tile.y * tileSize;
  return anchorX + visualBounds.right > minimumWorldX &&
    anchorX + visualBounds.left < maximumWorldX &&
    anchorY + visualBounds.bottom > minimumWorldY &&
    anchorY + visualBounds.top < maximumWorldY;
}
