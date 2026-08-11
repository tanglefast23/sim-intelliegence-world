export type VfxModePerformance = Readonly<{
  roundedFps: number;
  medianFrameTimeMilliseconds: number;
}>;

export type VfxModePerformanceComparison = Readonly<{
  proceduralToCircleMedianRatio: number;
  maximumMedianRatio: 1.1;
  minimumRoundedFps: number;
  passed: true;
}>;

export function validateVfxModePerformance(
  circle: VfxModePerformance,
  procedural: VfxModePerformance,
  minimumRoundedFps = 60,
): VfxModePerformanceComparison {
  if (circle.medianFrameTimeMilliseconds <= 0 || procedural.medianFrameTimeMilliseconds <= 0) {
    throw new Error('VFX-mode median frame times must be positive.');
  }
  if (circle.roundedFps < minimumRoundedFps || procedural.roundedFps < minimumRoundedFps) {
    throw new Error(
      `VFX mode is below ${minimumRoundedFps} FPS: circle ${circle.roundedFps}, procedural ${procedural.roundedFps}.`,
    );
  }
  const ratio = procedural.medianFrameTimeMilliseconds / circle.medianFrameTimeMilliseconds;
  if (ratio > 1.1) {
    throw new Error(`Procedural VFX median frame time regressed by more than 10 percent: ${ratio.toFixed(4)}x.`);
  }
  return Object.freeze({
    proceduralToCircleMedianRatio: Math.round(ratio * 10_000) / 10_000,
    maximumMedianRatio: 1.1,
    minimumRoundedFps,
    passed: true,
  });
}
