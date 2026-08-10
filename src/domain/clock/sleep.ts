import { PROTOTYPE_ECONOMY_POLICY } from '../economy/economy';

export type SleepMode = 'nap' | 'overnight';

export function canSleepOvernight(absoluteMinute: number): boolean {
  if (!Number.isSafeInteger(absoluteMinute) || absoluteMinute < 0) throw new RangeError('Sleep clock must be a safe minute.');
  return absoluteMinute % 1_440 >= 20 * 60;
}

export function sleepTargetMinute(absoluteMinute: number, mode: SleepMode): number {
  if (!Number.isSafeInteger(absoluteMinute) || absoluteMinute < 0) throw new RangeError('Sleep clock must be a safe minute.');
  if (mode === 'nap') return absoluteMinute + PROTOTYPE_ECONOMY_POLICY.napMinutes;
  if (!canSleepOvernight(absoluteMinute)) throw new Error('Overnight sleep is available only after 8:00 PM.');
  const target = (Math.floor(absoluteMinute / 1_440) + 1) * 1_440 + 8 * 60;
  if (!Number.isSafeInteger(target)) throw new RangeError('Sleep target exceeds the safe clock range.');
  return target;
}

export function sleepEnergyRestore(mode: SleepMode): number {
  return mode === 'nap'
    ? PROTOTYPE_ECONOMY_POLICY.napEnergyRestore
    : PROTOTYPE_ECONOMY_POLICY.overnightEnergyRestore;
}
