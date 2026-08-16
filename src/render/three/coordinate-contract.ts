import type { CameraState, ViewportSize } from '../camera';

export function threeDrawingBufferSize(viewport: ViewportSize, devicePixelRatio: number): ViewportSize {
  return {
    width: Math.trunc(viewport.width * devicePixelRatio),
    height: Math.trunc(viewport.height * devicePixelRatio),
  };
}

export function threeRasterViewport(viewport: ViewportSize, devicePixelRatio: number): ViewportSize {
  const drawingBuffer = threeDrawingBufferSize(viewport, devicePixelRatio);
  return {
    width: drawingBuffer.width / devicePixelRatio,
    height: drawingBuffer.height / devicePixelRatio,
  };
}

export const threeQuadIndices = (base: number): readonly number[] => [base, base + 2, base + 1, base, base + 3, base + 2];

/**
 * Visual polish 5.1: snap the camera origin to a whole drawing-buffer pixel.
 *
 * At fractional zoom or DPR the camera can land between device pixels, so a texel's sampled
 * neighbour flips as the player pans. Snapping the origin, and only the origin, keeps the world
 * on the device-pixel lattice. The extent is left alone so the visible area is unchanged, and the
 * logical camera in the frame is untouched, so input, hit testing and saves see the same values.
 *
 * With devicePixelRatio 1 and integer camera coordinates this is a no-op, which is why the
 * committed DPR 1 fixtures cannot demonstrate it.
 */
export function threeCameraBounds(camera: CameraState, viewport: ViewportSize, devicePixelRatio = 1) {
  const devicePixelsPerWorldUnit = camera.zoom * devicePixelRatio;
  const snap = (value: number): number => (
    devicePixelsPerWorldUnit > 0
      ? Math.round(value * devicePixelsPerWorldUnit) / devicePixelsPerWorldUnit
      : value
  );
  const originX = snap(camera.x);
  const originY = snap(camera.y);
  return {
    left: originX,
    right: originX + viewport.width / camera.zoom,
    top: -originY,
    bottom: -(originY + viewport.height / camera.zoom),
  } as const;
}
