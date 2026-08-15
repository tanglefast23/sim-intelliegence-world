import type { CameraState, ViewportSize } from '../camera';

export const threeQuadIndices = (base: number): readonly number[] => [base, base + 2, base + 1, base, base + 3, base + 2];

export function threeCameraBounds(camera: CameraState, viewport: ViewportSize) {
  return {
    left: camera.x,
    right: camera.x + viewport.width / camera.zoom,
    top: -camera.y,
    bottom: -(camera.y + viewport.height / camera.zoom),
  } as const;
}
