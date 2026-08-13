import { z } from 'zod';

import { StableIdSchema } from '../state/ids';

function uniqueIds(message: string) {
  return z.array(StableIdSchema).refine((ids) => new Set(ids).size === ids.length, { message });
}

export const ConcernStateSchema = z.object({
  concernId: StableIdSchema,
  state: z.enum(['hidden', 'open', 'eased', 'resolved', 'hardened']),
  activeRecoveryId: StableIdSchema.optional(),
}).strict();

export const LeverCreditSchema = z.object({
  leverId: StableIdSchema,
  concernId: StableIdSchema,
  supportFactIds: z.array(StableIdSchema).max(3),
  offerAmount: z.number().int().nonnegative().nullable(),
}).strict().refine((credit) => new Set(credit.supportFactIds).size === credit.supportFactIds.length, {
  message: 'Lever support fact IDs must be unique.',
});

const VerbalMissionCommonStateSchema = z.object({
  missionId: StableIdSchema,
  npcId: StableIdSchema,
  status: z.enum(['available', 'active', 'resolved', 'failed', 'withdrawn']),
  terminalResultId: StableIdSchema.nullable(),
  concerns: z.array(ConcernStateSchema).min(1).max(5),
  creditedMoves: z.array(LeverCreditSchema).max(32),
  firedAllergyIds: uniqueIds('Fired allergy IDs must be unique.'),
  liabilityIds: uniqueIds('Liability IDs must be unique.'),
  patience: z.number().int().min(0).max(10),
  consecutiveRepeatCount: z.number().int().min(0).max(10),
  cooldownUntilMinute: z.number().int().nonnegative().nullable(),
  roomState: z.enum(['open', 'cooling', 'guarded', 'done']),
}).strict();

export const VerbalMissionStateSchema = z.discriminatedUnion('goalKind', [
  VerbalMissionCommonStateSchema.extend({
    goalKind: z.literal('disclose_fact'),
    terms: z.object({ factId: StableIdSchema, recipientId: StableIdSchema }).strict(),
  }).strict(),
  VerbalMissionCommonStateSchema.extend({
    goalKind: z.literal('buy_object'),
    terms: z.object({
      objectId: StableIdSchema,
      currentOffer: z.number().int().nonnegative().nullable(),
    }).strict(),
  }).strict(),
  VerbalMissionCommonStateSchema.extend({
    goalKind: z.literal('schedule_cooperation'),
    terms: z.object({
      actionId: StableIdSchema,
      subjectNpcId: StableIdSchema,
      locationId: StableIdSchema,
      proposedMinute: z.number().int().nonnegative().nullable(),
      commitmentId: StableIdSchema.nullable(),
    }).strict(),
  }).strict(),
]).superRefine((mission, context) => {
  const concernIds = mission.concerns.map(({ concernId }) => concernId);
  if (new Set(concernIds).size !== concernIds.length) {
    context.addIssue({ code: 'custom', path: ['concerns'], message: 'Mission concern IDs must be unique.' });
  }
  const creditedMoves = mission.creditedMoves.map((credit) => JSON.stringify({
    ...credit,
    supportFactIds: [...credit.supportFactIds].sort(),
  }));
  if (new Set(creditedMoves).size !== creditedMoves.length) {
    context.addIssue({ code: 'custom', path: ['creditedMoves'], message: 'Credited moves must be unique.' });
  }
  mission.creditedMoves.forEach((credit, index) => {
    if (!concernIds.includes(credit.concernId)) {
      context.addIssue({
        code: 'custom', path: ['creditedMoves', index, 'concernId'],
        message: 'A credited move must reference a mission concern.',
      });
    }
  });
  const terminal = ['resolved', 'failed', 'withdrawn'].includes(mission.status);
  if (terminal !== (mission.terminalResultId !== null) || (terminal && mission.roomState !== 'done')) {
    context.addIssue({ code: 'custom', message: 'Mission terminal status, result, and room state must agree.' });
  }
});

export const WorldObjectStateSchema = z.object({
  objectId: StableIdSchema,
  ownerId: StableIdSchema,
}).strict();

export const JournalSubjectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('quest'), questId: StableIdSchema }).strict(),
  z.object({ kind: z.literal('verbal_mission'), missionId: StableIdSchema }).strict(),
]);

const CommitmentCommonSchema = z.object({
  commitmentId: StableIdSchema,
  missionId: StableIdSchema,
  npcId: StableIdSchema,
  actionId: StableIdSchema,
  targetId: StableIdSchema,
  locationId: StableIdSchema,
  agreedMinute: z.number().int().nonnegative(),
  deadlineMinute: z.number().int().nonnegative().optional(),
}).strict();

export const CommitmentStateSchema = z.discriminatedUnion('status', [
  CommitmentCommonSchema.extend({
    status: z.literal('agreed'),
    scheduledMinute: z.number().int().nonnegative(),
  }).strict(),
  CommitmentCommonSchema.extend({
    status: z.literal('delayed'),
    reasonId: StableIdSchema,
    scheduledMinute: z.number().int().nonnegative(),
  }).strict(),
  CommitmentCommonSchema.extend({
    status: z.literal('honoured'),
    resolvedMinute: z.number().int().nonnegative(),
  }).strict(),
  CommitmentCommonSchema.extend({
    status: z.literal('reneged'),
    reasonId: StableIdSchema,
    resolvedMinute: z.number().int().nonnegative(),
  }).strict(),
]).superRefine((commitment, context) => {
  if (commitment.deadlineMinute !== undefined && commitment.deadlineMinute < commitment.agreedMinute) {
    context.addIssue({ code: 'custom', path: ['deadlineMinute'], message: 'Commitment deadline cannot predate agreement.' });
  }
  const actionMinute = 'scheduledMinute' in commitment ? commitment.scheduledMinute : commitment.resolvedMinute;
  if (actionMinute < commitment.agreedMinute) {
    context.addIssue({ code: 'custom', message: 'Commitment action cannot predate agreement.' });
  }
});

export type VerbalMissionState = z.infer<typeof VerbalMissionStateSchema>;
export type WorldObjectState = z.infer<typeof WorldObjectStateSchema>;
export type CommitmentState = z.infer<typeof CommitmentStateSchema>;
