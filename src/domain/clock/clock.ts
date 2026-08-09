import { z } from 'zod';

import { PauseTokenSchema } from '../state/ids';

export const SimulationSpeedSchema = z.union([z.literal(0), z.literal(1), z.literal(2)]);
export type SimulationSpeed = z.infer<typeof SimulationSpeedSchema>;

export const ClockStateSchema = z.object({
  absoluteMinute: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  subMinuteMilliseconds: z.number().int().min(0).max(999),
  selectedSpeed: SimulationSpeedSchema,
  pauseTokens: z.array(PauseTokenSchema).refine((tokens) => new Set(tokens).size === tokens.length, {
    message: 'Pause tokens must be unique.',
  }),
}).strict();
export type ClockState = z.infer<typeof ClockStateSchema>;

export function effectiveSpeed(clock: ClockState): SimulationSpeed {
  return clock.pauseTokens.length > 0 ? 0 : clock.selectedSpeed;
}

export function advanceClock(
  clock: ClockState,
  realMilliseconds: number,
): Readonly<{ clock: ClockState; advancedMinutes: number }> {
  if (!Number.isSafeInteger(realMilliseconds) || realMilliseconds < 0) {
    throw new RangeError('Real milliseconds must be a non-negative safe integer.');
  }
  const scaledMilliseconds = realMilliseconds * effectiveSpeed(clock);
  if (!Number.isSafeInteger(scaledMilliseconds)) {
    throw new RangeError('Scaled clock input exceeds the safe integer range.');
  }
  const accumulated = clock.subMinuteMilliseconds + scaledMilliseconds;
  if (!Number.isSafeInteger(accumulated)) {
    throw new RangeError('Accumulated clock input exceeds the safe integer range.');
  }
  const advancedMinutes = Math.floor(accumulated / 1_000);
  const nextAbsoluteMinute = clock.absoluteMinute + advancedMinutes;
  if (!Number.isSafeInteger(nextAbsoluteMinute)) {
    throw new RangeError('Absolute clock minute exceeds the safe integer range.');
  }
  return {
    clock: {
      ...clock,
      absoluteMinute: nextAbsoluteMinute,
      subMinuteMilliseconds: accumulated % 1_000,
      pauseTokens: [...clock.pauseTokens],
    },
    advancedMinutes,
  };
}

export function clockParts(absoluteMinute: number): Readonly<{
  day: number;
  hour: number;
  minute: number;
}> {
  if (!Number.isSafeInteger(absoluteMinute) || absoluteMinute < 0) {
    throw new RangeError('Absolute minute must be a non-negative safe integer.');
  }
  return {
    day: Math.floor(absoluteMinute / 1_440) + 1,
    hour: Math.floor((absoluteMinute % 1_440) / 60),
    minute: absoluteMinute % 60,
  };
}
