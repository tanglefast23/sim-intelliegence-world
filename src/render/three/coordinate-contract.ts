import type { CameraState, ViewportSize } from '../camera';

/**
 * Handoff technique 1: render on an INTEGER lattice, then let the display scale it once.
 *
 * The drawing buffer used to be `viewport x devicePixelRatio`. At a fractional ratio that puts the
 * whole frame on a fractional lattice, and each thing on it lands differently: an atlas sprite, a
 * rotated sprite, a primitive stroke and a glow quad all rasterise at their own sub-pixel phase, so
 * one frame mixes several effective resolutions. The art reads as pixel art that has been through
 * a photo editor.
 *
 * The spike rendered a fixed low-resolution buffer at `setPixelRatio(1)` and let CSS upscale it
 * with `image-rendering: pixelated`. This is that, generalised: an integer multiple of the logical
 * viewport, chosen so a 2x display still gets its full resolution.
 *
 * WHAT THIS DOES NOT CLAIM. It does not put every art texel on a whole number of device pixels. It
 * cannot: with the visible extent pinned, a 1x buffer upscaled by 1.25 gives a 1,1,1,2 device-pixel
 * cadence, which is the same cadence the old buffer produced. What changes is that the whole frame
 * now rasterises on ONE lattice and is resampled once, uniformly, by the display — instead of every
 * layer landing on a fractional grid independently.
 */
export function threeRenderScale(devicePixelRatio: number): number {
  return Math.max(1, Math.floor(devicePixelRatio));
}

export function threeDrawingBufferSize(viewport: ViewportSize, devicePixelRatio: number): ViewportSize {
  const scale = threeRenderScale(devicePixelRatio);
  return {
    width: Math.trunc(viewport.width * scale),
    height: Math.trunc(viewport.height * scale),
  };
}

/**
 * Divides by the RENDER SCALE, not by the device pixel ratio.
 *
 * Both functions change together or neither does. Sizing the buffer to an integer while leaving
 * this divisor at the device pixel ratio would shrink a 2560x1440 camera at DPR 1.25 to 2048x1152:
 * every mask would move and the player would see less of the map.
 */
export function threeRasterViewport(viewport: ViewportSize, devicePixelRatio: number): ViewportSize {
  const drawingBuffer = threeDrawingBufferSize(viewport, devicePixelRatio);
  const scale = threeRenderScale(devicePixelRatio);
  return {
    width: drawingBuffer.width / scale,
    height: drawingBuffer.height / scale,
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
