import {
  bottomPivotTransform,
  PROTAGONIST_WOBBLE_PIVOT,
  protagonistWobbleDegrees,
} from '../protagonist-wobble';

function angle(
  direction: 'up' | 'down' | 'left' | 'right',
  horizontalRunDistance: number,
  overrides: Partial<Parameters<typeof protagonistWobbleDegrees>[0]> = {},
) {
  return protagonistWobbleDegrees({
    direction,
    status: 'moving',
    horizontalRunDistance,
    reducedMotion: false,
    ...overrides,
  });
}

describe('protagonist weighted wobble', () => {
  test('leans forward with mirrored left and right signs', () => {
    expect(angle('right', 16)).toBeCloseTo(10.416666, 5);
    expect(angle('left', 16)).toBeCloseTo(-10.416666, 5);
    expect(angle('left', 16)).toBeCloseTo(-angle('right', 16), 12);
  });

  test('uses a strong first lean, smaller counter-wobble, and tiny final settle', () => {
    const firstLean = angle('right', 16);
    const counterWobble = angle('right', 48);
    const finalSettle = angle('right', 80);
    expect(counterWobble).toBeCloseTo(-3.75, 12);
    expect(finalSettle).toBeCloseTo(0.416666, 5);
    expect(Math.abs(firstLean)).toBeGreaterThan(Math.abs(counterWobble));
    expect(Math.abs(counterWobble)).toBeGreaterThan(Math.abs(finalSettle));
  });

  test('returns literal zero at tile boundaries and after settling', () => {
    for (const distance of [-1, 0, 32, 64, 96, 128]) {
      expect(angle('right', distance)).toBe(0);
      expect(angle('left', distance)).toBe(0);
    }
  });

  test('stays upright outside active horizontal presentation', () => {
    expect(angle('up', 16)).toBe(0);
    expect(angle('down', 16)).toBe(0);
    expect(angle('right', 16, { status: 'idle' })).toBe(0);
    expect(angle('right', 16, { status: 'waiting' })).toBe(0);
    expect(angle('right', 16, { status: 'unreachable' })).toBe(0);
    expect(angle('right', 16, { reducedMotion: true })).toBe(0);
  });

  test('keeps the legacy translation byte-identical at zero angle', () => {
    expect(bottomPivotTransform({ worldX: 17.5, worldY: 23.25, zoom: 3, angleDegrees: 0 })).toEqual({
      scos: 3,
      ssin: 0,
      tx: 52.5,
      ty: 69.75,
    });
  });

  test.each([1, 2, 3] as const)('keeps the bottom pivot planted at %sx zoom', (zoom) => {
    for (const angleDegrees of [10.416666, -3.75]) {
      const transform = bottomPivotTransform({ worldX: 101.25, worldY: 79.5, zoom, angleDegrees });
      const transformedX = transform.scos * PROTAGONIST_WOBBLE_PIVOT.x -
        transform.ssin * PROTAGONIST_WOBBLE_PIVOT.y + transform.tx;
      const transformedY = transform.ssin * PROTAGONIST_WOBBLE_PIVOT.x +
        transform.scos * PROTAGONIST_WOBBLE_PIVOT.y + transform.ty;
      expect(transformedX).toBeCloseTo((101.25 + PROTAGONIST_WOBBLE_PIVOT.x) * zoom, 12);
      expect(transformedY).toBeCloseTo((79.5 + PROTAGONIST_WOBBLE_PIVOT.y) * zoom, 12);
    }
  });
});
