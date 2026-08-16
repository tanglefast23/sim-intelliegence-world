import { threeCameraBounds, threeRasterViewport } from '../three/coordinate-contract';

const viewport = { width: 1280, height: 720 };

/**
 * Visual polish 5.1. The camera origin is snapped to a whole drawing-buffer pixel so a texel's
 * sampled neighbour cannot flip while the player pans. The logical camera is untouched.
 */
describe('camera snapping to the device-pixel lattice', () => {
  test('is a no-op at device pixel ratio 1 with an integer camera', () => {
    const camera = { x: 240, y: 407, zoom: 1 };
    const raster = threeRasterViewport(viewport, 1);
    expect(threeCameraBounds(camera, raster, 1)).toEqual(threeCameraBounds(camera, raster));
    expect(threeCameraBounds(camera, raster, 1).left).toBe(240);
  });

  test('snaps a fractional origin onto the lattice at fractional device pixel ratio', () => {
    const raster = threeRasterViewport(viewport, 1.25);
    // 255.3 world units at zoom 1 and DPR 1.25 is 319.125 device pixels, which snaps to 319.
    const bounds = threeCameraBounds({ x: 255.3, y: 100, zoom: 1 }, raster, 1.25);
    expect(bounds.left).toBeCloseTo(319 / 1.25, 10);
    expect(Number.isInteger(bounds.left * 1.25)).toBe(true);
  });

  test('is idempotent', () => {
    const raster = threeRasterViewport(viewport, 1.5);
    const camera = { x: 255.3, y: 100.7, zoom: 2 };
    const once = threeCameraBounds(camera, raster, 1.5);
    const twice = threeCameraBounds({ ...camera, x: once.left, y: -once.top }, raster, 1.5);
    expect(twice.left).toBeCloseTo(once.left, 10);
    expect(twice.top).toBeCloseTo(once.top, 10);
  });

  test('collapses cameras that differ by less than one device pixel', () => {
    const raster = threeRasterViewport(viewport, 2);
    // At zoom 1 and DPR 2 a device pixel is 0.5 world units, so these land on the same lattice cell.
    const a = threeCameraBounds({ x: 100.02, y: 50, zoom: 1 }, raster, 2);
    const b = threeCameraBounds({ x: 100.04, y: 50, zoom: 1 }, raster, 2);
    expect(a.left).toBeCloseTo(b.left, 10);
  });

  test('keeps the visible extent unchanged', () => {
    const raster = threeRasterViewport(viewport, 1.25);
    const bounds = threeCameraBounds({ x: 255.3, y: 100.9, zoom: 2 }, raster, 1.25);
    expect(bounds.right - bounds.left).toBeCloseTo(raster.width / 2, 10);
    expect(bounds.top - bounds.bottom).toBeCloseTo(raster.height / 2, 10);
  });
});
