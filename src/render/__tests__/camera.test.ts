import {
  centerCameraOnTile,
  panCamera,
  screenToTile,
  worldToScreen,
  zoomCameraAt,
} from '../camera';

const VIEWPORT = { width: 1120, height: 620 } as const;
const MAP_PIXELS = { width: 2048, height: 1536 } as const;

describe('integer world camera', () => {
  test.each([1, 2, 3] as const)('keeps the centered tile under the center pointer at %ix', (zoom) => {
    const tile = { x: 18, y: 18 };
    const camera = centerCameraOnTile(tile, zoom, VIEWPORT, MAP_PIXELS);
    expect(screenToTile(camera, { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 })).toEqual(tile);
    expect(Number.isInteger(camera.x)).toBe(true);
    expect(Number.isInteger(camera.y)).toBe(true);
    const screen = worldToScreen(camera, { x: tile.x * 32 + 16, y: tile.y * 32 + 16 });
    expect(Math.abs(screen.x - VIEWPORT.width / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(screen.y - VIEWPORT.height / 2)).toBeLessThanOrEqual(1);
  });

  test('anchored zoom preserves the world point and rejects non-discrete zoom', () => {
    const camera = centerCameraOnTile({ x: 30, y: 25 }, 1, VIEWPORT, MAP_PIXELS);
    const anchor = { x: 300, y: 200 };
    const before = { x: camera.x + anchor.x / camera.zoom, y: camera.y + anchor.y / camera.zoom };
    const zoomed = zoomCameraAt(camera, 2, anchor, VIEWPORT, MAP_PIXELS);
    expect({ x: zoomed.x + anchor.x / zoomed.zoom, y: zoomed.y + anchor.y / zoomed.zoom }).toEqual(before);
    expect(() => zoomCameraAt(camera, 1.5, anchor, VIEWPORT, MAP_PIXELS)).toThrow('exactly 1x, 2x, or 3x');
  });

  test('middle-drag math and bounds cannot expose outside the map', () => {
    const camera = { x: 0, y: 0, zoom: 2 as const };
    expect(panCamera(camera, { x: 400, y: 300 }, VIEWPORT, MAP_PIXELS)).toEqual(camera);
    const far = panCamera(camera, { x: -100_000, y: -100_000 }, VIEWPORT, MAP_PIXELS);
    expect(far).toEqual({ x: 1488, y: 1226, zoom: 2 });
  });
});
