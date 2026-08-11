import { validateVfxModePerformance } from '../vfx-mode-performance';

describe('VFX-mode performance acceptance', () => {
  test('accepts both modes at the FPS floor and the exact median limit', () => {
    expect(validateVfxModePerformance(
      { roundedFps: 60, medianFrameTimeMilliseconds: 10 },
      { roundedFps: 60, medianFrameTimeMilliseconds: 11 },
    )).toEqual({
      proceduralToCircleMedianRatio: 1.1,
      maximumMedianRatio: 1.1,
      minimumRoundedFps: 60,
      passed: true,
    });
  });

  test('rejects a low frame rate, invalid median, or regression above ten percent', () => {
    expect(() => validateVfxModePerformance(
      { roundedFps: 59, medianFrameTimeMilliseconds: 10 },
      { roundedFps: 60, medianFrameTimeMilliseconds: 10 },
    )).toThrow('circle 59, procedural 60');
    expect(() => validateVfxModePerformance(
      { roundedFps: 60, medianFrameTimeMilliseconds: 10 },
      { roundedFps: 60, medianFrameTimeMilliseconds: 0 },
    )).toThrow('positive');
    expect(() => validateVfxModePerformance(
      { roundedFps: 60, medianFrameTimeMilliseconds: 10 },
      { roundedFps: 60, medianFrameTimeMilliseconds: 11.01 },
    )).toThrow('more than 10 percent');
  });
});
