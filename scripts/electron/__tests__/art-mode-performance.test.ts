import { validateArtModePerformance } from '../art-mode-performance';

describe('art-mode performance acceptance', () => {
  test('accepts the same-package result at the FPS and median limits', () => {
    expect(validateArtModePerformance(
      { roundedFps: 120, medianFrameTimeMilliseconds: 8.3 },
      { roundedFps: 120, medianFrameTimeMilliseconds: 9.13 },
      60,
    )).toMatchObject({ enhancedToLegacyMedianRatio: 1.1, passed: true });
  });

  test('rejects an FPS failure or median regression above ten percent', () => {
    expect(() => validateArtModePerformance(
      { roundedFps: 120, medianFrameTimeMilliseconds: 8.3 },
      { roundedFps: 59, medianFrameTimeMilliseconds: 8.3 },
      60,
    )).toThrow('below 60 FPS');
    expect(() => validateArtModePerformance(
      { roundedFps: 120, medianFrameTimeMilliseconds: 8.3 },
      { roundedFps: 120, medianFrameTimeMilliseconds: 9.14 },
      60,
    )).toThrow('more than 10 percent');
  });
});
