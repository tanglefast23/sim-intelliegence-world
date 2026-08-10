import { z } from 'zod';

export const EconomyPolicySchema = z.object({
  weeklyAllowance: z.number().int().positive(),
  basicDailyCost: z.number().int().positive(),
  ordinaryQuestMaximum: z.number().int().nonnegative(),
  dangerousQuestMinimum: z.number().int().nonnegative(),
  dangerousQuestMaximum: z.number().int().nonnegative(),
  energyDrainMinutesPerPoint: z.number().int().positive(),
  napMinutes: z.literal(120),
  napEnergyRestore: z.number().int().positive().max(100),
  overnightEnergyRestore: z.number().int().positive().max(100),
  npcTravelMinutes: z.number().int().positive(),
}).strict().superRefine((policy, context) => {
  if (policy.weeklyAllowance <= policy.basicDailyCost * 7) {
    context.addIssue({ code: 'custom', message: 'Weekly allowance must include a buffer above seven basic days.' });
  }
  if (policy.ordinaryQuestMaximum > policy.weeklyAllowance) {
    context.addIssue({ code: 'custom', message: 'An ordinary quest cannot pay more than one allowance.' });
  }
  if (
    policy.dangerousQuestMinimum < policy.weeklyAllowance ||
    policy.dangerousQuestMaximum > policy.weeklyAllowance * 3 ||
    policy.dangerousQuestMaximum < policy.dangerousQuestMinimum
  ) {
    context.addIssue({ code: 'custom', message: 'Dangerous quest rewards must stay within one to three allowances.' });
  }
});
export type EconomyPolicy = z.infer<typeof EconomyPolicySchema>;

export const PROTOTYPE_ECONOMY_POLICY: EconomyPolicy = EconomyPolicySchema.parse({
  weeklyAllowance: 800,
  basicDailyCost: 100,
  ordinaryQuestMaximum: 800,
  dangerousQuestMinimum: 800,
  dangerousQuestMaximum: 2_400,
  energyDrainMinutesPerPoint: 60,
  napMinutes: 120,
  napEnergyRestore: 25,
  overnightEnergyRestore: 80,
  npcTravelMinutes: 30,
});

export type QuestRewardKind = 'ordinary' | 'dangerous';

export function validateQuestReward(kind: QuestRewardKind, amount: number): number {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new RangeError('Quest reward must be a non-negative safe integer.');
  if (kind === 'ordinary' && amount > PROTOTYPE_ECONOMY_POLICY.ordinaryQuestMaximum) {
    throw new Error('Ordinary quest reward exceeds one weekly allowance.');
  }
  if (
    kind === 'dangerous' &&
    (amount < PROTOTYPE_ECONOMY_POLICY.dangerousQuestMinimum || amount > PROTOTYPE_ECONOMY_POLICY.dangerousQuestMaximum)
  ) {
    throw new Error('Dangerous quest reward must be one to three weekly allowances.');
  }
  return amount;
}
