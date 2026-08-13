export const VERBAL_ACTS = [
  'ask', 'observe', 'assert', 'empathize', 'compliment', 'offer', 'trade',
  'apologize', 'joke', 'threaten', 'withdraw', 'other',
] as const;

export const VERBAL_REGISTERS = [
  'plain', 'blunt', 'warm', 'playful', 'flattering', 'pleading', 'formal', 'threatening',
] as const;

export const VERBAL_MISSION_OUTCOMES = [
  'clarify', 'small_talk', 'progress', 'repeat', 'backfire', 'lie_detected',
  'offer_too_low', 'cannot_pay', 'ready', 'refused', 'walkout',
] as const;

export type VerbalAct = (typeof VERBAL_ACTS)[number];
export type VerbalRegister = (typeof VERBAL_REGISTERS)[number];
export type VerbalMissionOutcomeId = (typeof VERBAL_MISSION_OUTCOMES)[number];

export type VerbalMove = Readonly<{
  acts: readonly Readonly<{
    act: VerbalAct;
    referentId: string | null;
    evidenceText: string;
  }>[];
  register: VerbalRegister;
  claims: readonly Readonly<{
    factId: string;
    polarity: 'assert' | 'deny' | 'ask';
    evidenceText: string;
  }>[];
  referenceConfidence: 'clear' | 'probable' | 'ambiguous';
}>;

export type VerbalTrigger = Readonly<{
  actIds?: readonly VerbalAct[];
  registerIds?: readonly VerbalRegister[];
  forbiddenRegisterIds?: readonly VerbalRegister[];
  referentId?: string;
  claimFactIds?: readonly string[];
}>;

export type NpcDisposition = Readonly<{
  dispositionId: string;
  npcId: string;
  protectedValueIds: readonly string[];
  credibilitySignalIds: readonly string[];
  suspicionSignalIds: readonly string[];
  decisionStyle: 'evidence_first' | 'practical' | 'relational' | 'procedural';
  patience: number;
  repetitionTolerance: number;
  verificationMethodIds: readonly string[];
  hardBoundaries: readonly Readonly<{ boundaryId: string; trigger: VerbalTrigger }>[];
}>;

export type ReactionDefinition = Readonly<{
  reactionId: string;
  outcome: VerbalMissionOutcomeId;
  readTheRoomId: string;
  portraitId: 'neutral' | 'warm' | 'considering' | 'guarded' | 'hurt';
  cueId: 'greeting' | 'laugh' | 'sigh' | 'consequence' | null;
  actorFallback: string;
}>;

type GoalContractCommon = Readonly<{
  missionId: string;
  npcId: string;
  requiredConcernIds: readonly string[];
  availableWhenId: string;
  confirmRuleId: string;
  successRuleId: string;
  closerActionId: string;
}>;

export type GoalContract =
  | GoalContractCommon & Readonly<{
    kind: 'disclose_fact';
    factId: string;
    recipientId: string;
    commandType: 'record_fact_disclosure';
  }>
  | GoalContractCommon & Readonly<{
    kind: 'buy_object';
    objectId: string;
    successPriceExclusive: number;
    hardMinimumPrice: number;
    commandType: 'purchase_unique_object';
  }>
  | GoalContractCommon & Readonly<{
    kind: 'schedule_cooperation';
    actionId: string;
    subjectNpcId: string;
    locationId: string;
    earliestMinute: number;
    latestMinute: number;
    commandType: 'create_scheduled_commitment';
  }>;

export type LeverDefinition = Readonly<{
  leverId: string;
  stableOrder: number;
  concernId: string;
  honest: boolean;
  credits: boolean;
  trigger: VerbalTrigger;
  requiredPlayerFactIds: readonly string[];
  requiredNpcFactIds: readonly string[];
  fromStates: readonly ('hidden' | 'open' | 'eased' | 'resolved' | 'hardened')[];
  toState: 'open' | 'eased' | 'resolved' | 'hardened';
  exactTerm?:
    | Readonly<{ kind: 'offer'; minimumAmount: number; maximumAmount: number | null; requireAffordable: boolean }>
    | Readonly<{ kind: 'schedule'; requireWithinContract: boolean }>;
  newlySpeakableFactIds: readonly string[];
  reactionId: string;
}>;

export type VerbalMissionDefinition = Readonly<{
  schemaVersion: 1;
  missionId: string;
  npcId: string;
  dispositionId: string;
  concerns: readonly Readonly<{
    concernId: string;
    summary: string;
    required: boolean;
    initialState: 'hidden' | 'open';
  }>[];
  levers: readonly LeverDefinition[];
  allergies: readonly Readonly<{
    allergyId: string;
    stableOrder: number;
    trigger: VerbalTrigger;
    severity: 'mild' | 'severe';
    concernId?: string;
    recoveryIds: readonly string[];
    patienceDelta: number;
    reactionId: string;
  }>[];
  recoveries: readonly Readonly<{
    recoveryId: string;
    stableOrder: number;
    concernId: string;
    trigger: VerbalTrigger;
    requiredPlayerFactIds: readonly string[];
    toState: 'open' | 'eased';
    sameConversation: boolean;
    reactionId: string;
  }>[];
  reactions: readonly ReactionDefinition[];
  defaultReactionIds: Readonly<Record<VerbalMissionOutcomeId, string>>;
  goalContract: GoalContract;
}>;
