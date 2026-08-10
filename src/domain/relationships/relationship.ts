import { z } from 'zod';

import { StableIdSchema } from '../state/ids';

export const RelationshipStageSchema = z.enum([
  'stranger',
  'acquaintance',
  'friend',
  'dating',
  'partner',
  'engaged',
  'married',
]);
export type RelationshipStage = z.infer<typeof RelationshipStageSchema>;

export const RelationshipValuesSchema = z.object({
  familiarity: z.number().int().min(0).max(100),
  trust: z.number().int().min(0).max(100),
  attraction: z.number().int().min(0).max(100),
}).strict();
export type RelationshipValues = z.infer<typeof RelationshipValuesSchema>;

export const RelationshipDeltaSchema = z.object({
  familiarity: z.number().int(),
  trust: z.number().int(),
  attraction: z.number().int(),
}).strict();
export type RelationshipDelta = z.infer<typeof RelationshipDeltaSchema>;

export const RejectionRecordSchema = z.object({
  reasonId: StableIdSchema,
  kind: z.enum(['permanent_boundary', 'changeable_circumstance']),
  sourceActionId: StableIdSchema,
  circumstanceFlagId: StableIdSchema.optional(),
  resolved: z.boolean(),
}).strict().superRefine((record, context) => {
  if (record.kind === 'permanent_boundary' && record.resolved) {
    context.addIssue({ code: 'custom', message: 'A permanent boundary cannot be resolved.' });
  }
  if (record.kind === 'changeable_circumstance' && record.circumstanceFlagId === undefined) {
    context.addIssue({ code: 'custom', message: 'A changeable circumstance requires its resolving flag.' });
  }
});
export type RejectionRecord = z.infer<typeof RejectionRecordSchema>;

export const RelationshipStageRuleSchema = z.object({
  stage: RelationshipStageSchema.exclude(['stranger']),
  floor: RelationshipValuesSchema.optional(),
  unavailable: z.boolean(),
  requiredFlagIds: z.array(StableIdSchema),
}).strict();

export const RelationshipBoundarySchema = z.object({
  id: StableIdSchema,
  scope: z.enum(['social', 'romantic']),
  blockedActionIds: z.array(StableIdSchema).min(1),
}).strict();

export const RelationshipPolicySchema = z.object({
  romanticEligibleAtStart: z.boolean(),
  hardBoundaries: z.array(RelationshipBoundarySchema),
  stageRules: z.array(RelationshipStageRuleSchema),
}).strict();
export type RelationshipPolicy = z.infer<typeof RelationshipPolicySchema>;

export const RelationshipStateSchema = z.object({
  npcId: StableIdSchema,
  values: RelationshipValuesSchema,
  stage: RelationshipStageSchema,
  rejections: z.array(RejectionRecordSchema),
  compatibility: z.object({
    social: z.boolean(),
    romantic: z.boolean(),
  }).strict(),
  policy: RelationshipPolicySchema,
}).strict();
export type RelationshipState = z.infer<typeof RelationshipStateSchema>;

export const ENGINE_STAGE_FLOORS: Readonly<Record<Exclude<RelationshipStage, 'stranger'>, RelationshipValues>> = {
  acquaintance: { familiarity: 10, trust: 0, attraction: 0 },
  friend: { familiarity: 30, trust: 20, attraction: 0 },
  dating: { familiarity: 40, trust: 35, attraction: 30 },
  partner: { familiarity: 55, trust: 50, attraction: 45 },
  engaged: { familiarity: 70, trust: 65, attraction: 55 },
  married: { familiarity: 80, trust: 75, attraction: 60 },
};

export type RelationshipDeltaSource = 'conversation' | 'quest';

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function applyRelationshipDelta(
  values: RelationshipValues,
  delta: RelationshipDelta,
  source: RelationshipDeltaSource,
): Readonly<{ values: RelationshipValues; appliedDelta: RelationshipValues }> {
  const limit = source === 'conversation' ? 3 : 15;
  for (const value of Object.values(delta)) {
    if (!Number.isInteger(value) || value < -limit || value > limit) {
      throw new RangeError(`${source} relationship deltas must be between -${limit} and ${limit}.`);
    }
  }
  const next = {
    familiarity: clamp(values.familiarity + delta.familiarity, 0, 100),
    trust: clamp(values.trust + delta.trust, 0, 100),
    attraction: clamp(values.attraction + delta.attraction, 0, 100),
  };
  return {
    values: next,
    appliedDelta: {
      familiarity: next.familiarity - values.familiarity,
      trust: next.trust - values.trust,
      attraction: next.attraction - values.attraction,
    },
  };
}

export type StagePermission = Readonly<{
  sociallyCompatible: boolean;
  romanticallyCompatible: boolean;
  romanticEligible?: boolean;
  directConsent: boolean;
  authoredEvent: boolean;
  blockingCircumstance: boolean;
  unavailable: boolean;
}>;

export function canEnterStage(
  values: RelationshipValues,
  stage: Exclude<RelationshipStage, 'stranger'>,
  permission: StagePermission,
  authoredFloor?: RelationshipValues,
): boolean {
  const engineFloor = ENGINE_STAGE_FLOORS[stage];
  const floor = authoredFloor ?? engineFloor;
  if (
    floor.familiarity < engineFloor.familiarity ||
    floor.trust < engineFloor.trust ||
    floor.attraction < engineFloor.attraction
  ) {
    throw new Error('Authored relationship floors cannot weaken engine floors.');
  }
  const requiresRomanticConsent = ['dating', 'partner', 'engaged', 'married'].includes(stage);
  const requiresAuthoredEvent = ['engaged', 'married'].includes(stage);
  return (
    !permission.unavailable &&
    !permission.blockingCircumstance &&
    permission.sociallyCompatible &&
    (!requiresRomanticConsent || permission.romanticallyCompatible) &&
    (!requiresRomanticConsent || permission.romanticEligible !== false) &&
    (!requiresRomanticConsent || permission.directConsent) &&
    (!requiresAuthoredEvent || permission.authoredEvent) &&
    values.familiarity >= floor.familiarity &&
    values.trust >= floor.trust &&
    values.attraction >= floor.attraction
  );
}

const STAGE_ORDER = RelationshipStageSchema.options;

export function nextRelationshipStage(current: RelationshipStage): RelationshipStage | undefined {
  return STAGE_ORDER[STAGE_ORDER.indexOf(current) + 1];
}

export function upsertRejection(
  records: readonly RejectionRecord[],
  candidate: RejectionRecord,
): RejectionRecord[] {
  const parsed = RejectionRecordSchema.parse(candidate);
  const existing = records.find((record) => record.reasonId === parsed.reasonId);
  if (!existing) return [...records, parsed];
  if (JSON.stringify(existing) !== JSON.stringify(parsed)) {
    throw new Error(`Rejection reason ${parsed.reasonId} cannot be redefined.`);
  }
  return [...records];
}

export function resolveChangeableRejections(
  records: readonly RejectionRecord[],
  activeFlagIds: ReadonlySet<string>,
): RejectionRecord[] {
  return records.map((record) => (
    record.kind === 'changeable_circumstance' &&
    !record.resolved &&
    record.circumstanceFlagId !== undefined &&
    activeFlagIds.has(record.circumstanceFlagId)
      ? { ...record, resolved: true }
      : record
  ));
}

export type RelationshipStageDecision = Readonly<{
  accepted: boolean;
  relationship: RelationshipState;
  reasonId: string;
}>;

export function requestRelationshipStage(
  relationship: RelationshipState,
  targetStage: Exclude<RelationshipStage, 'stranger'>,
  actionId: string,
  activeFlagIds: ReadonlySet<string>,
  authoredEvent: boolean,
): RelationshipStageDecision {
  const resolvedRejections = resolveChangeableRejections(relationship.rejections, activeFlagIds);
  const base = { ...relationship, rejections: resolvedRejections };
  const boundary = base.policy.hardBoundaries.find(({ blockedActionIds }) => blockedActionIds.includes(actionId));
  if (boundary) {
    const rejection: RejectionRecord = {
      reasonId: boundary.id,
      kind: 'permanent_boundary',
      sourceActionId: actionId,
      resolved: false,
    };
    return {
      accepted: false,
      reasonId: boundary.id,
      relationship: { ...base, rejections: upsertRejection(base.rejections, rejection) },
    };
  }
  const blocking = base.rejections.find((record) => !record.resolved && record.sourceActionId === actionId);
  if (blocking) return { accepted: false, reasonId: blocking.reasonId, relationship: base };
  if (nextRelationshipStage(base.stage) !== targetStage) {
    return { accepted: false, reasonId: 'relationship_stage_order', relationship: base };
  }
  const rule = base.policy.stageRules.find(({ stage }) => stage === targetStage);
  const flagsReady = (rule?.requiredFlagIds ?? []).every((flagId) => activeFlagIds.has(flagId));
  const romanticStage = ['dating', 'partner', 'engaged', 'married'].includes(targetStage);
  const romanticEligible = base.policy.romanticEligibleAtStart || (
    base.rejections.every((record) => record.kind !== 'changeable_circumstance' || record.resolved) && flagsReady
  );
  const accepted = canEnterStage(base.values, targetStage, {
    sociallyCompatible: base.compatibility.social,
    romanticallyCompatible: base.compatibility.romantic,
    romanticEligible,
    directConsent: true,
    authoredEvent,
    blockingCircumstance: !flagsReady,
    unavailable: rule?.unavailable ?? false,
  }, rule?.floor);
  if (accepted) {
    return { accepted: true, reasonId: 'relationship_stage_accepted', relationship: { ...base, stage: targetStage } };
  }
  const reasonId = romanticStage && !base.compatibility.romantic
    ? 'romantic_incompatible'
    : rule?.unavailable ? 'relationship_stage_unavailable'
      : !flagsReady ? 'relationship_circumstance_unresolved'
        : 'relationship_requirements_unmet';
  return { accepted: false, reasonId, relationship: base };
}
