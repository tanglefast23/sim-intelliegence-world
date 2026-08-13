import { mapEffectVisible, worldAtmosphere } from '../atmosphere';

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
