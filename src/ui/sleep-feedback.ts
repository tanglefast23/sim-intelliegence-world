export type SleepCompletion = Readonly<{
  mode: 'nap' | 'overnight';
  energyDelta: number;
}>;

export function sleepCompletionFeedback(event: SleepCompletion): string {
  const label = event.mode === 'nap' ? 'NAP COMPLETE' : 'RESTED UNTIL 08:00';
  const delta = `${event.energyDelta >= 0 ? '+' : ''}${event.energyDelta}`;
  return `${label} · ${delta} ENERGY`;
}
