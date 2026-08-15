import { threeCameraBounds, threeDrawingBufferSize, threeQuadIndices, threeRasterViewport } from '../three/coordinate-contract';

describe('Three.js 2D coordinate contract', () => {
  test('maps the y-down world into the orthographic camera exactly', () => {
    expect(threeCameraBounds(
      { x: 480, y: 736, zoom: 2 },
      { width: 1_120, height: 620 },
    )).toEqual({ left: 480, right: 1_040, top: -736, bottom: -1_046 });
  });

  test('keeps y-flipped quads front-facing', () => {
    expect(threeQuadIndices(8)).toEqual([8, 10, 9, 8, 11, 10]);
  });

  test('truncates fractional-DPR drawing buffers like the Skia baseline', () => {
    expect(threeDrawingBufferSize({ width: 1_411, height: 871 }, 1.25)).toEqual({ width: 1_763, height: 1_088 });
    expect(threeDrawingBufferSize({ width: 1_571, height: 691 }, 1.5)).toEqual({ width: 2_356, height: 1_036 });
    expect(threeRasterViewport({ width: 1_411, height: 871 }, 1.25)).toEqual({ width: 1_410.4, height: 870.4 });
  });
});
