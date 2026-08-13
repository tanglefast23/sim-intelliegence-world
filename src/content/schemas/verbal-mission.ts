import { z } from 'zod';

import { VerbalMoveSchema } from '../../ai/schemas/verbal-move';
import { StableIdSchema } from '../../domain/state/ids';
import {
  VERBAL_ACTS,
  VERBAL_MISSION_OUTCOMES,
  VERBAL_REGISTERS,
} from '../../domain/verbal-missions/contracts';

export { VERBAL_MISSION_OUTCOMES };

const ConcernStatusSchema = z.enum(['hidden', 'open', 'eased', 'resolved', 'hardened']);
const RevealedConcernStatusSchema = z.enum(['open', 'eased', 'resolved', 'hardened']);

function uniqueIds(message: string) {
  return z.array(StableIdSchema).refine((ids) => new Set(ids).size === ids.length, { message });
}

const TriggerSchema = z.object({
  actIds: z.array(z.enum(VERBAL_ACTS)).max(4).optional(),
  registerIds: z.array(z.enum(VERBAL_REGISTERS)).max(4).optional(),
  forbiddenRegisterIds: z.array(z.enum(VERBAL_REGISTERS)).max(4).optional(),
  referentId: StableIdSchema.optional(),
  claimFactIds: z.array(StableIdSchema).max(3).optional(),
}).strict().refine((trigger) => (
  trigger.actIds !== undefined || trigger.registerIds !== undefined ||
  trigger.forbiddenRegisterIds !== undefined || trigger.referentId !== undefined ||
  trigger.claimFactIds !== undefined
), { message: 'A Verbal Mission trigger needs at least one condition.' });

export const NpcDispositionSchema = z.object({
  dispositionId: StableIdSchema,
  npcId: StableIdSchema,
  protectedValueIds: uniqueIds('Disposition protected values must be unique.'),
  credibilitySignalIds: uniqueIds('Disposition credibility signals must be unique.'),
  suspicionSignalIds: uniqueIds('Disposition suspicion signals must be unique.'),
  decisionStyle: z.enum(['evidence_first', 'practical', 'relational', 'procedural']),
  patience: z.number().int().min(1).max(10),
  repetitionTolerance: z.number().int().min(0).max(3),
  verificationMethodIds: uniqueIds('Disposition verification methods must be unique.'),
  hardBoundaries: z.array(z.object({
    boundaryId: StableIdSchema,
    trigger: TriggerSchema,
  }).strict()).max(8),
}).strict();

export const ConcernDefinitionSchema = z.object({
  concernId: StableIdSchema,
  summary: z.string().trim().min(1).max(120),
  required: z.boolean(),
  initialState: z.enum(['hidden', 'open']),
}).strict();

const ExactTermSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('offer'),
    minimumAmount: z.number().int().nonnegative(),
    maximumAmount: z.number().int().nonnegative().nullable(),
    requireAffordable: z.boolean(),
  }).strict().refine((term) => term.maximumAmount === null || term.maximumAmount >= term.minimumAmount, {
    message: 'Offer lever maximum must meet its minimum.',
  }),
  z.object({
    kind: z.literal('schedule'),
    requireWithinContract: z.boolean(),
  }).strict(),
]);

export const LeverDefinitionSchema = z.object({
  leverId: StableIdSchema,
  stableOrder: z.number().int().nonnegative(),
  concernId: StableIdSchema,
  honest: z.boolean(),
  credits: z.boolean(),
  trigger: TriggerSchema,
  requiredPlayerFactIds: uniqueIds('Lever player facts must be unique.'),
  requiredNpcFactIds: uniqueIds('Lever NPC facts must be unique.'),
  fromStates: z.array(ConcernStatusSchema).min(1).max(4),
  toState: RevealedConcernStatusSchema,
  exactTerm: ExactTermSchema.optional(),
  newlySpeakableFactIds: uniqueIds('Lever speakable facts must be unique.'),
  reactionId: StableIdSchema,
}).strict();

export const RecoveryDefinitionSchema = z.object({
  recoveryId: StableIdSchema,
  stableOrder: z.number().int().nonnegative(),
  concernId: StableIdSchema,
  trigger: TriggerSchema,
  requiredPlayerFactIds: uniqueIds('Recovery player facts must be unique.'),
  toState: z.enum(['open', 'eased']),
  sameConversation: z.boolean(),
  reactionId: StableIdSchema,
}).strict();

export const AllergyDefinitionSchema = z.object({
  allergyId: StableIdSchema,
  stableOrder: z.number().int().nonnegative(),
  trigger: TriggerSchema,
  severity: z.enum(['mild', 'severe']),
  concernId: StableIdSchema.optional(),
  recoveryIds: uniqueIds('Allergy recovery IDs must be unique.'),
  patienceDelta: z.number().int().min(-10).max(0),
  reactionId: StableIdSchema,
}).strict().superRefine((allergy, context) => {
  if (allergy.severity === 'mild' && (!allergy.concernId || allergy.recoveryIds.length === 0)) {
    context.addIssue({ code: 'custom', message: 'A mild allergy needs a hardened concern and recovery.' });
  }
});

const GoalContractCommonSchema = z.object({
  missionId: StableIdSchema,
  npcId: StableIdSchema,
  requiredConcernIds: z.array(StableIdSchema).min(1).max(4),
  availableWhenId: StableIdSchema,
  confirmRuleId: StableIdSchema,
  successRuleId: StableIdSchema,
  closerActionId: StableIdSchema,
}).strict();

export const GoalContractSchema = z.discriminatedUnion('kind', [
  GoalContractCommonSchema.extend({
    kind: z.literal('disclose_fact'),
    factId: StableIdSchema,
    recipientId: StableIdSchema,
    commandType: z.literal('record_fact_disclosure'),
  }).strict(),
  GoalContractCommonSchema.extend({
    kind: z.literal('buy_object'),
    objectId: StableIdSchema,
    successPriceExclusive: z.number().int().positive(),
    hardMinimumPrice: z.number().int().nonnegative(),
    commandType: z.literal('purchase_unique_object'),
  }).strict().refine((contract) => contract.successPriceExclusive > contract.hardMinimumPrice, {
    message: 'Commerce success price must exceed its hard minimum.',
  }),
  GoalContractCommonSchema.extend({
    kind: z.literal('schedule_cooperation'),
    actionId: StableIdSchema,
    subjectNpcId: StableIdSchema,
    locationId: StableIdSchema,
    earliestMinute: z.number().int().nonnegative(),
    latestMinute: z.number().int().nonnegative(),
    commandType: z.literal('create_scheduled_commitment'),
  }).strict().refine((contract) => contract.latestMinute >= contract.earliestMinute, {
    message: 'Scheduled goal window must be ordered.',
  }),
]);

export const ReactionDefinitionSchema = z.object({
  reactionId: StableIdSchema,
  outcome: z.enum(VERBAL_MISSION_OUTCOMES),
  readTheRoomId: StableIdSchema,
  portraitId: z.enum(['neutral', 'warm', 'considering', 'guarded', 'hurt']),
  cueId: z.enum(['greeting', 'laugh', 'sigh', 'consequence']).nullable(),
  actorFallback: z.string().trim().min(1).max(500),
}).strict();

export const RouteContextSchema = z.object({
  playerFactIds: uniqueIds('Route player facts must be unique.'),
  npcFactIds: uniqueIds('Route NPC facts must be unique.'),
  contradictedFactIds: uniqueIds('Route contradicted facts must be unique.'),
  playerMoney: z.number().int().nonnegative(),
  objectOwners: z.record(StableIdSchema, StableIdSchema),
  absoluteMinute: z.number().int().nonnegative(),
}).strict();

export const RouteStepSchema = z.object({
  playerMessage: z.string().trim().min(1).max(500),
  move: VerbalMoveSchema,
  exactOfferAmount: z.number().int().nonnegative().nullable(),
  exactProposedMinute: z.number().int().nonnegative().nullable(),
  grantPlayerFactIds: uniqueIds('Route granted facts must be unique.'),
}).strict();

export const RouteProofSchema = z.object({
  proofId: StableIdSchema,
  context: RouteContextSchema,
  steps: z.array(RouteStepSchema).min(1).max(16),
}).strict();

export const RecoveryProofSchema = z.object({
  proofId: StableIdSchema,
  allergyId: StableIdSchema,
  recoveryId: StableIdSchema,
  context: RouteContextSchema,
  allergyStep: RouteStepSchema,
  recoveryStep: RouteStepSchema,
}).strict();

const DefaultReactionIdsSchema = z.object(Object.fromEntries(
  VERBAL_MISSION_OUTCOMES.map((outcome) => [outcome, StableIdSchema]),
) as Record<(typeof VERBAL_MISSION_OUTCOMES)[number], typeof StableIdSchema>).strict();

export const VerbalMissionDefinitionSchema = z.object({
  schemaVersion: z.literal(1),
  missionId: StableIdSchema,
  npcId: StableIdSchema,
  dispositionId: StableIdSchema,
  concerns: z.array(ConcernDefinitionSchema).min(1).max(5),
  levers: z.array(LeverDefinitionSchema).min(1).max(32),
  allergies: z.array(AllergyDefinitionSchema).max(16),
  recoveries: z.array(RecoveryDefinitionSchema).max(16),
  reactions: z.array(ReactionDefinitionSchema).min(VERBAL_MISSION_OUTCOMES.length).max(64),
  defaultReactionIds: DefaultReactionIdsSchema,
  goalContract: GoalContractSchema,
  honestRoute: RouteProofSchema,
  recoveryProofs: z.array(RecoveryProofSchema).max(16),
}).strict();

export type NpcDisposition = z.infer<typeof NpcDispositionSchema>;
export type VerbalMissionDefinition = z.infer<typeof VerbalMissionDefinitionSchema>;
export type GoalContract = z.infer<typeof GoalContractSchema>;
export type ReactionDefinition = z.infer<typeof ReactionDefinitionSchema>;
export type RouteContext = z.infer<typeof RouteContextSchema>;
export type RouteStep = z.infer<typeof RouteStepSchema>;
