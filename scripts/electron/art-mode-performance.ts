export type ArtModePerformance = Readonly<{
  roundedFps: number;
  medianFrameTimeMilliseconds: number;
}>;

export type ArtModePerformanceComparison = Readonly<{
  enhancedToLegacyMedianRatio: number;
  maximumMedianRatio: 1.1;
  minimumRoundedFps: number;
  passed: true;
}>;

export function validateArtModePerformance(
  legacy: ArtModePerformance,
  enhanced: ArtModePerformance,
  minimumRoundedFps: number,
): ArtModePerformanceComparison {
  if (legacy.medianFrameTimeMilliseconds <= 0 || enhanced.medianFrameTimeMilliseconds <= 0) {
    throw new Error('Art-mode median frame times must be positive.');
  }
  if (enhanced.roundedFps < minimumRoundedFps) {
    throw new Error(`Enhanced art mode is below ${minimumRoundedFps} FPS: ${enhanced.roundedFps}.`);
  }
  const enhancedToLegacyMedianRatio = enhanced.medianFrameTimeMilliseconds / legacy.medianFrameTimeMilliseconds;
  if (enhancedToLegacyMedianRatio > 1.1) {
    throw new Error(
      `Enhanced median frame time regressed by more than 10 percent: ${enhancedToLegacyMedianRatio.toFixed(4)}x.`,
    );
  }
  return Object.freeze({
    enhancedToLegacyMedianRatio: Math.round(enhancedToLegacyMedianRatio * 10_000) / 10_000,
    maximumMedianRatio: 1.1,
    minimumRoundedFps,
    passed: true,
  });
}
