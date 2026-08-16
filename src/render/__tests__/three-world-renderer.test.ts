import { threeCameraBounds, threeDrawingBufferSize, threeQuadIndices, threeRasterViewport, threeRenderScale } from '../three/coordinate-contract';

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

  test('renders on an integer lattice at every supported device pixel ratio', () => {
    // Handoff technique 1 replaced the fractional buffer. These three assertions previously locked
    // the Skia-era behaviour: 1411x871 at DPR 1.25 became a 1763x1088 buffer and a 1410.4x870.4
    // raster viewport. Both were faithful to Skia and both are what this technique removes.
    expect(threeRenderScale(1)).toBe(1);
    expect(threeRenderScale(1.25)).toBe(1);
    expect(threeRenderScale(1.5)).toBe(1);
    expect(threeRenderScale(2)).toBe(2);

    expect(threeDrawingBufferSize({ width: 1_411, height: 871 }, 1.25)).toEqual({ width: 1_411, height: 871 });
    expect(threeDrawingBufferSize({ width: 1_571, height: 691 }, 1.5)).toEqual({ width: 1_571, height: 691 });
    expect(threeDrawingBufferSize({ width: 1_280, height: 720 }, 2)).toEqual({ width: 2_560, height: 1_440 });

    // The raster viewport is now exact rather than losing a fraction of a pixel to truncation.
    // That is an improvement, but it IS a change, and story 5's "unchanged extent" holds at the
    // locked window sizes rather than at every window size.
    expect(threeRasterViewport({ width: 1_411, height: 871 }, 1.25)).toEqual({ width: 1_411, height: 871 });
    expect(threeRasterViewport({ width: 2_560, height: 1_440 }, 2)).toEqual({ width: 2_560, height: 1_440 });
  });

  test('keeps the visible world extent at every locked window size', () => {
    // The locked cases all have integer viewport x DPR, so the extent must be byte-identical.
    for (const [width, height] of [[1_280, 720], [1_440, 900], [1_600, 720], [1_920, 1_080], [2_560, 1_440]] as const) {
      for (const dpr of [1, 1.25, 1.5, 2] as const) {
        expect(threeRasterViewport({ width, height }, dpr)).toEqual({ width, height });
      }
    }
  });
});
