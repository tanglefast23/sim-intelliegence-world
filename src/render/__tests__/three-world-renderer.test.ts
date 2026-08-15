import { threeCameraBounds, threeQuadIndices } from '../three/world-renderer';

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
});
