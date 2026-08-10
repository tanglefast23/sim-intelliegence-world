import { z } from 'zod';

import { StableIdSchema } from '../state/ids';

export type FactionOutcomeScale = 'ordinary' | 'major';
export type FactionTier = 'hostile' | 'unfriendly' | 'neutral' | 'favorable' | 'trusted' | 'allied';

export const FactionAccessGateSchema = z.object({
  id: StableIdSchema,
  factionId: StableIdSchema,
  minimumStanding: z.number().int().min(-100).max(100),
  requiredQuestFlagIds: z.array(StableIdSchema),
}).strict();
export type FactionAccessGate = z.infer<typeof FactionAccessGateSchema>;

export function applyFactionDelta(
  standing: number,
  delta: number,
  scale: FactionOutcomeScale,
): Readonly<{ standing: number; appliedDelta: number }> {
  if (!Number.isInteger(standing) || standing < -100 || standing > 100) {
    throw new RangeError('Faction standing must be an integer from -100 to 100.');
  }
  const limit = scale === 'ordinary' ? 10 : 25;
  if (!Number.isInteger(delta) || delta < -limit || delta > limit) {
    throw new RangeError(`${scale} faction deltas must be between -${limit} and ${limit}.`);
  }
  const next = Math.min(100, Math.max(-100, standing + delta));
  return { standing: next, appliedDelta: next - standing };
}

export function factionTier(standing: number): FactionTier {
  if (standing < -49) return 'hostile';
  if (standing < -9) return 'unfriendly';
  if (standing < 10) return 'neutral';
  if (standing < 50) return 'favorable';
  if (standing < 80) return 'trusted';
  return 'allied';
}

export function evaluateFactionAccess(
  faction: Readonly<{ id: string; standing: number; revealed: boolean }> | undefined,
  gateCandidate: FactionAccessGate,
  questFlagIds: ReadonlySet<string>,
): Readonly<{ allowed: boolean; reason: 'allowed' | 'hidden' | 'standing' | 'quest_flag' }> {
  const gate = FactionAccessGateSchema.parse(gateCandidate);
  if (!faction || faction.id !== gate.factionId || !faction.revealed) return { allowed: false, reason: 'hidden' };
  if (faction.standing < gate.minimumStanding) return { allowed: false, reason: 'standing' };
  if (!gate.requiredQuestFlagIds.every((flagId) => questFlagIds.has(flagId))) {
    return { allowed: false, reason: 'quest_flag' };
  }
  return { allowed: true, reason: 'allowed' };
}
