import { z } from 'zod';

export const EconomyPolicySchema = z.object({
  weeklyAllowance: z.number().int().positive(),
  basicDailyCost: z.number().int().positive(),
  ordinaryQuestMaximum: z.number().int().nonnegative(),
  dangerousQuestMinimum: z.number().int().nonnegative(),
  dangerousQuestMaximum: z.number().int().nonnegative(),
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
});
