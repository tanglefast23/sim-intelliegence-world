import type { z } from 'zod';

import { LeverCreditSchema } from './state';

export type LeverCredit = z.infer<typeof LeverCreditSchema>;

export function leverCreditKey(credit: LeverCredit): string {
  const parsed = LeverCreditSchema.parse(credit);
  return JSON.stringify({
    leverId: parsed.leverId,
    concernId: parsed.concernId,
    supportFactIds: [...parsed.supportFactIds].sort(),
    offerAmount: parsed.offerAmount,
  });
}

export function hasLeverCredit(credits: readonly LeverCredit[], candidate: LeverCredit): boolean {
  const key = leverCreditKey(candidate);
  return credits.some((credit) => leverCreditKey(credit) === key);
}

export function repeatRoomState(
  repeatCount: number,
  tolerance: number,
): 'open' | 'cooling' | 'guarded' {
  if (repeatCount <= tolerance) return 'open';
  if (repeatCount === tolerance + 1) return 'cooling';
  return 'guarded';
}
