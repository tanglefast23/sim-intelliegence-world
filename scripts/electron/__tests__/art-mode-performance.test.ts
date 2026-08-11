import { validateArtModePerformance } from '../art-mode-performance';

describe('art-mode performance acceptance', () => {
  test('accepts the same-package result at the FPS and median limits', () => {
    expect(validateArtModePerformance(
      { roundedFps: 120, medianFrameTimeMilliseconds: 8.3, staticBatchCount: 1 },
      { roundedFps: 120, medianFrameTimeMilliseconds: 9.13, staticBatchCount: 2 },
      60,
    )).toMatchObject({ enhancedToLegacyMedianRatio: 1.1, addedStaticBatches: 1, passed: true });
  });

  test('rejects either mode below the FPS floor or a median regression above ten percent', () => {
    expect(() => validateArtModePerformance(
      { roundedFps: 59, medianFrameTimeMilliseconds: 8.3, staticBatchCount: 1 },
      { roundedFps: 120, medianFrameTimeMilliseconds: 8.3, staticBatchCount: 2 },
      60,
    )).toThrow('legacy 59, enhanced 120');
    expect(() => validateArtModePerformance(
      { roundedFps: 120, medianFrameTimeMilliseconds: 8.3, staticBatchCount: 1 },
      { roundedFps: 59, medianFrameTimeMilliseconds: 8.3, staticBatchCount: 2 },
      60,
    )).toThrow('legacy 120, enhanced 59');
    expect(() => validateArtModePerformance(
      { roundedFps: 120, medianFrameTimeMilliseconds: 8.3, staticBatchCount: 1 },
      { roundedFps: 120, medianFrameTimeMilliseconds: 9.14, staticBatchCount: 2 },
      60,
    )).toThrow('more than 10 percent');
    expect(() => validateArtModePerformance(
      { roundedFps: 120, medianFrameTimeMilliseconds: 8.3, staticBatchCount: 1 },
      { roundedFps: 120, medianFrameTimeMilliseconds: 8.3, staticBatchCount: 3 },
      60,
    )).toThrow('more than one static batch');
  });
});
