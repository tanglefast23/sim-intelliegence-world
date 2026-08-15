import { threeCameraBounds, threeDrawingBufferSize, threeQuadIndices } from '../three/coordinate-contract';

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

  test('rounds fractional-DPR drawing buffers outward like the host canvas', () => {
    expect(threeDrawingBufferSize({ width: 1_411, height: 871 }, 1.25)).toEqual({ width: 1_764, height: 1_089 });
    expect(threeDrawingBufferSize({ width: 1_571, height: 691 }, 1.5)).toEqual({ width: 2_357, height: 1_037 });
  });
});
