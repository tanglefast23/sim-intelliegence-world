export type ArtModePerformance = Readonly<{
  roundedFps: number;
  medianFrameTimeMilliseconds: number;
  staticBatchCount: number;
}>;

export type ArtModePerformanceComparison = Readonly<{
  enhancedToLegacyMedianRatio: number;
  maximumMedianRatio: 1.1;
  minimumRoundedFps: number;
  addedStaticBatches: number;
  maximumAddedStaticBatches: 1;
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
  if (legacy.roundedFps < minimumRoundedFps || enhanced.roundedFps < minimumRoundedFps) {
    throw new Error(
      `Art mode is below ${minimumRoundedFps} FPS: legacy ${legacy.roundedFps}, enhanced ${enhanced.roundedFps}.`,
    );
  }
  const addedStaticBatches = enhanced.staticBatchCount - legacy.staticBatchCount;
  if (addedStaticBatches < 0 || addedStaticBatches > 1) {
    throw new Error(`Enhanced art mode added more than one static batch: ${addedStaticBatches}.`);
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
    addedStaticBatches,
    maximumAddedStaticBatches: 1,
    passed: true,
  });
}
