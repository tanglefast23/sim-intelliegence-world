import {
  clampCamera,
  centerCameraOnTile,
  centerCameraOnWorld,
  followWindowTarget,
  frameCameraOn,
  isScreenPointInsideMap,
  panCamera,
  resizeCameraPreservingCenter,
  screenToTile,
  worldToScreen,
  zoomCameraAt,
} from '../camera';

const VIEWPORT = { width: 1120, height: 620 } as const;
const MAP_PIXELS = { width: 2048, height: 1536 } as const;

describe('world camera', () => {
  test.each([1, 1.5, 2, 3] as const)('keeps the centered tile under the center pointer at %ix', (zoom) => {
    const tile = { x: 18, y: 18 };
    const camera = centerCameraOnTile(tile, zoom, VIEWPORT, MAP_PIXELS);
    expect(screenToTile(camera, { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 })).toEqual(tile);
    // The camera sits on a whole screen pixel, which is the lattice worldToScreen and the three.js
    // renderer both round to. Written as an epsilon on purpose: at wheel zooms such as 2.1 the
    // exact product is not representable, so Number.isInteger would be a flaky assertion.
    expect(Math.abs(camera.x * zoom - Math.round(camera.x * zoom))).toBeLessThan(1e-6);
    expect(Math.abs(camera.y * zoom - Math.round(camera.y * zoom))).toBeLessThan(1e-6);
    const screen = worldToScreen(camera, { x: tile.x * 32 + 16, y: tile.y * 32 + 16 });
    expect(Math.abs(screen.x - VIEWPORT.width / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(screen.y - VIEWPORT.height / 2)).toBeLessThanOrEqual(1);
  });

  test('anchored gradual zoom preserves the world point and rejects off-step zoom', () => {
    const camera = centerCameraOnTile({ x: 30, y: 25 }, 1, VIEWPORT, MAP_PIXELS);
    const anchor = { x: 300, y: 300 };
    const before = { x: camera.x + anchor.x / camera.zoom, y: camera.y + anchor.y / camera.zoom };
    const zoomed = zoomCameraAt(camera, 1.5, anchor, VIEWPORT, MAP_PIXELS);
    expect({ x: zoomed.x + anchor.x / zoomed.zoom, y: zoomed.y + anchor.y / zoomed.zoom }).toEqual(before);
    expect(() => zoomCameraAt(camera, 1.53, anchor, VIEWPORT, MAP_PIXELS)).toThrow('5% increments');
  });

  test('middle-drag math and bounds cannot expose outside the map', () => {
    const camera = { x: 0, y: 0, zoom: 2 as const };
    expect(panCamera(camera, { x: 400, y: 300 }, VIEWPORT, MAP_PIXELS)).toEqual(camera);
    const far = panCamera(camera, { x: -100_000, y: -100_000 }, VIEWPORT, MAP_PIXELS);
    expect(far).toEqual({ x: 1488, y: 1226, zoom: 2 });
  });

  test('centers an oversized viewport and rejects backdrop pointers', () => {
    const viewport = { width: 2_560, height: 1_800 };
    const camera = clampCamera({ x: 0, y: 0, zoom: 1 }, viewport, MAP_PIXELS);
    expect(camera).toEqual({ x: -256, y: -132, zoom: 1 });
    expect(isScreenPointInsideMap(camera, { x: 0, y: 100 }, MAP_PIXELS)).toBe(false);
    expect(isScreenPointInsideMap(camera, { x: 256, y: 132 }, MAP_PIXELS)).toBe(true);
  });

  test('keeps whole-world-pixel results at zoom 1, where the two lattices agree', () => {
    expect(centerCameraOnTile({ x: 18, y: 18 }, 1, VIEWPORT, MAP_PIXELS)).toEqual({ x: 32, y: 282, zoom: 1 });
  });

  test('frames one point like centering, and several by their bounding box', () => {
    const point = { x: 900, y: 700 };
    expect(frameCameraOn([point], 2, VIEWPORT, MAP_PIXELS))
      .toEqual(centerCameraOnWorld(point, 2, VIEWPORT, MAP_PIXELS));
    const pair = frameCameraOn([{ x: 800, y: 700 }, { x: 1_000, y: 700 }], 2, VIEWPORT, MAP_PIXELS);
    expect(pair).toEqual(centerCameraOnWorld(point, 2, VIEWPORT, MAP_PIXELS));
    expect(() => frameCameraOn([], 2, VIEWPORT, MAP_PIXELS)).toThrow('at least one world point');
  });

  test('a bottom inset lifts the framed point above the interface', () => {
    const point = { x: 900, y: 700 };
    const plain = frameCameraOn([point], 2, VIEWPORT, MAP_PIXELS);
    const inset = frameCameraOn([point], 2, VIEWPORT, MAP_PIXELS, { left: 0, right: 0, top: 0, bottom: 200 });
    expect(worldToScreen(inset, point).y).toBe(worldToScreen(plain, point).y - 100);
  });

  test('the follow window holds still inside the dead zone and pushes from its edge', () => {
    const camera = centerCameraOnWorld({ x: 900, y: 700 }, 2, VIEWPORT, MAP_PIXELS);
    const halfWidth = VIEWPORT.width * 0.12;
    const inside = { x: 900 + (halfWidth - 8) / 2, y: 700 };
    expect(followWindowTarget(camera, inside, VIEWPORT, MAP_PIXELS)).toBe(camera);
    const outside = { x: 900 + (halfWidth + 40) / 2, y: 700 };
    const pushed = followWindowTarget(camera, outside, VIEWPORT, MAP_PIXELS);
    expect((pushed.x - camera.x) * 2).toBeCloseTo(40, 6);
  });

  test('preserves the old center world point across viewport and zoom changes', () => {
    const oldViewport = { width: 1_256, height: 696 };
    const nextViewport = { width: 1_896, height: 1_056 };
    const camera = centerCameraOnTile({ x: 30, y: 24 }, 1, oldViewport, MAP_PIXELS);
    const oldCenter = {
      x: camera.x + oldViewport.width / camera.zoom / 2,
      y: camera.y + oldViewport.height / camera.zoom / 2,
    };
    const resized = resizeCameraPreservingCenter(camera, oldViewport, nextViewport, 2, MAP_PIXELS);
    expect({
      x: resized.x + nextViewport.width / resized.zoom / 2,
      y: resized.y + nextViewport.height / resized.zoom / 2,
    }).toEqual(oldCenter);
  });
});
