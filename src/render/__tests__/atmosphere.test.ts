import { worldAtmosphere } from '../atmosphere';

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
});
