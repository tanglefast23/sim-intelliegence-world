import { hexChannels, mapEffectVisible, mixHex, worldAtmosphere, worldSun } from '../atmosphere';

const DAY_MINUTES = Array.from({ length: 1_440 }, (_unused, minute) => minute);

function channelBytes(hex: string): readonly number[] {
  const raw = hex.slice(1);
  return Array.from({ length: raw.length / 2 }, (_unused, index) => (
    Number.parseInt(raw.slice(index * 2, index * 2 + 2), 16)
  ));
}

describe('world atmosphere', () => {
  test.each([
    [240, 'night'],
    [480, 'dawn'],
    [720, 'day'],
    [1_140, 'dusk'],
    [1_500, 'night'],
  ] as const)('maps minute %i to %s', (minute, period) => {
    expect(worldAtmosphere(minute).period).toBe(period);
  });

  test.each([
    [480, false],
    [720, false],
    [1_140, true],
    [1_500, true],
  ] as const)('shows neon at minute %i only after daylight', (minute, visible) => {
    expect(mapEffectVisible('neon', minute)).toBe(visible);
    expect(mapEffectVisible('water', minute)).toBe(true);
  });
});

describe('the continuous sun', () => {
  // The point of the whole change. The four-bucket table jumped 21 pixels and 70 colour counts in
  // a single minute at each boundary; nothing here may step more than a pixel or a count and a
  // half. Covers midnight, because the wrap segment is the one a keyframe table gets wrong.
  test('never steps like a bucket, at any minute including the midnight wrap', () => {
    let widestShadowStep = 0;
    let widestColorStep = 0;
    for (const minute of DAY_MINUTES) {
      const current = worldSun(minute);
      const next = worldSun(minute + 1);
      widestShadowStep = Math.max(
        widestShadowStep,
        Math.abs(next.shadowX - current.shadowX),
        Math.abs(next.shadowY - current.shadowY),
      );
      for (const [from, to] of [
        [current.shadowColor, next.shadowColor],
        [current.light, next.light],
      ] as const) {
        channelBytes(from).forEach((value, index) => {
          widestColorStep = Math.max(widestColorStep, Math.abs((channelBytes(to)[index] ?? value) - value));
        });
      }
    }
    expect(widestShadowStep).toBeLessThan(1);
    expect(widestColorStep).toBeLessThan(1.5);
  });

  test('reproduces every authored bucket-centre shadow exactly', () => {
    expect([worldSun(60).shadowX, worldSun(60).shadowY]).toEqual([5, 4]);
    expect([worldSun(435).shadowX, worldSun(435).shadowY]).toEqual([-16, 8]);
    expect([worldSun(795).shadowX, worldSun(795).shadowY]).toEqual([5, 3]);
    expect([worldSun(1_140).shadowX, worldSun(1_140).shadowY]).toEqual([23, 10]);
  });

  test('rakes west at first light, east at last light, and flattens between', () => {
    for (let minute = 300; minute <= 600; minute += 1) {
      expect(worldSun(minute).shadowX).toBeLessThan(0);
    }
    for (let minute = 900; minute <= 1_260; minute += 1) {
      expect(worldSun(minute).shadowX).toBeGreaterThan(0);
    }
    const daylight = DAY_MINUTES.filter((minute) => minute >= 300 && minute <= 1_260);
    const flattest = daylight.reduce((best, minute) => (
      worldSun(minute).shadowLength < worldSun(best).shadowLength ? minute : best
    ), daylight[0] as number);
    expect(flattest).toBeGreaterThanOrEqual(600);
    expect(flattest).toBeLessThanOrEqual(900);
    // The sweep the brief asked for: the rakes are several times longer than the flat.
    expect(worldSun(300).shadowLength).toBeGreaterThan(worldSun(flattest).shadowLength * 4);
    expect(worldSun(1_260).shadowLength).toBeGreaterThan(worldSun(flattest).shadowLength * 4);
  });

  test('peaks at solar noon and hands the picture to the lamps at night', () => {
    expect(worldSun(780).elevation).toBeCloseTo(1, 6);
    expect(worldSun(780).lampMix).toBeCloseTo(0, 6);
    expect(worldSun(60).elevation).toBe(0);
    expect(worldSun(60).lampMix).toBe(1);
    expect(worldSun(1_500)).toEqual(worldSun(60));
  });

  test('mixes hex in place and keeps the width it was given', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex('#00000000', '#ffffffff', 1)).toBe('#ffffffff');
    expect(hexChannels('#ff8000')[0]).toBe(1);
  });
});
