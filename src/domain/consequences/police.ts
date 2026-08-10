import { z } from 'zod';

import { PoliceAttentionSchema } from '../state/models';

export const PoliceHookSchema = z.enum(['officer_contact', 'ignored_summons', 'wanted_encounter']);
export type PoliceHook = z.infer<typeof PoliceHookSchema>;
export type PoliceAttention = z.infer<typeof PoliceAttentionSchema>;

const REQUIRED_HOOK: Readonly<Partial<Record<PoliceAttention, PoliceHook>>> = {
  noticed: 'officer_contact',
  questioned: 'ignored_summons',
  wanted: 'wanted_encounter',
};

const NEXT_ATTENTION: Readonly<Partial<Record<PoliceAttention, PoliceAttention>>> = {
  noticed: 'questioned',
  questioned: 'wanted',
  wanted: 'arrest-on-sight',
};

export function noticeWitnessedCrime(current: PoliceAttention, witnessCount: number): PoliceAttention {
  if (witnessCount <= 0 || current !== 'none') return current;
  return 'noticed';
}

export function advancePoliceAttention(
  current: PoliceAttention,
  hookCandidate: PoliceHook,
): Exclude<PoliceAttention, 'none' | 'noticed'> {
  const hook = PoliceHookSchema.parse(hookCandidate);
  const required = REQUIRED_HOOK[current];
  const next = NEXT_ATTENTION[current];
  if (!required || !next) throw new Error(`Police attention ${current} has no matching escalation hook.`);
  if (hook !== required) throw new Error(`Police attention ${current} requires ${required}.`);
  return next as Exclude<PoliceAttention, 'none' | 'noticed'>;
}
