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

export function threeCameraBounds(camera: CameraState, viewport: ViewportSize) {
  return {
    left: camera.x,
    right: camera.x + viewport.width / camera.zoom,
    top: -camera.y,
    bottom: -(camera.y + viewport.height / camera.zoom),
  } as const;
}
