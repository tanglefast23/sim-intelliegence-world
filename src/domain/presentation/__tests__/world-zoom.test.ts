import {
  MAX_WORLD_ZOOM,
  MIN_WORLD_ZOOM,
  assertWorldZoom,
  isWorldZoom,
  stepWorldZoom,
  worldZoomPercentage,
} from '../world-zoom';

describe('world zoom', () => {
  test('accepts only five-percent choices inside the supported range', () => {
    expect([1, 1.05, 1.55, 2, 2.95, 3].every(isWorldZoom)).toBe(true);
    expect([0.95, 1.53, 3.05, Number.NaN, Number.POSITIVE_INFINITY].some(isWorldZoom)).toBe(false);
    expect(assertWorldZoom(1.55)).toBe(1.55);
    expect(() => assertWorldZoom(1.53)).toThrow('5% increments');
  });

  test('steps predictably without floating-point drift or leaving the range', () => {
    expect(stepWorldZoom(1, -1)).toBe(MIN_WORLD_ZOOM);
    expect(stepWorldZoom(1, 1)).toBe(1.05);
    expect(stepWorldZoom(1.1, 1)).toBe(1.15);
    expect(stepWorldZoom(3, 1)).toBe(MAX_WORLD_ZOOM);
    expect(worldZoomPercentage(stepWorldZoom(1.5, 1))).toBe(155);
  });
});
