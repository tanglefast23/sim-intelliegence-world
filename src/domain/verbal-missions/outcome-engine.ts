import { z } from 'zod';

import {
  type GoalContract,
  type NpcDisposition,
  type ReactionDefinition,
  type VerbalMissionDefinition,
  type VerbalMove,
  type VerbalTrigger,
} from './contracts';
import { StableIdSchema } from '../state/ids';
import { VerbalMissionStateSchema, type VerbalMissionState } from './state';
import { hasLeverCredit, repeatRoomState, type LeverCredit } from './repetition';

const EngineContextSchema = z.object({
  playerFactIds: z.array(StableIdSchema),
  npcFactIds: z.array(StableIdSchema),
  contradictedFactIds: z.array(StableIdSchema),
  playerMoney: z.number().int().nonnegative(),
  objectOwners: z.record(StableIdSchema, StableIdSchema),
  absoluteMinute: z.number().int().nonnegative(),
  exactOfferAmount: z.number().int().nonnegative().nullable(),
  exactProposedMinute: z.number().int().nonnegative().nullable(),
}).strict();

export type OutcomeEngineContext = z.infer<typeof EngineContextSchema>;

export type ConcernTransition = Readonly<{
  concernId: string;
  from: VerbalMissionState['concerns'][number]['state'];
  to: VerbalMissionState['concerns'][number]['state'];
  reasonId: string;
}>;

export type VerbalMissionOutcome = Readonly<{
  outcome: ReactionDefinition['outcome'];
  mission: VerbalMissionState;
  concernTransitions: readonly ConcernTransition[];
  creditedMoves: readonly LeverCredit[];
  newlySpeakableFactIds: readonly string[];
  blockedLeverIds: readonly string[];
  canConfirm: boolean;
  wouldSucceed: boolean;
  reactionId: string;
  readTheRoomId: string;
  portraitId: ReactionDefinition['portraitId'];
  cueId: ReactionDefinition['cueId'];
  actorFallback: string;
}>;

type ConcernState = VerbalMissionState['concerns'][number]['state'];

const LEGAL_TRANSITIONS: Readonly<Record<ConcernState, readonly ConcernState[]>> = {
  hidden: ['open'],
  open: ['eased', 'resolved', 'hardened'],
  eased: ['resolved', 'hardened'],
  resolved: [],
  hardened: ['open', 'eased'],
};

export function isLegalConcernTransition(from: ConcernState, to: ConcernState, recovery = false): boolean {
  if (!LEGAL_TRANSITIONS[from].includes(to)) return false;
  return from !== 'hardened' || recovery;
}

export function createOpeningMission(
  definitionCandidate: VerbalMissionDefinition,
  dispositionCandidate: NpcDisposition,
): VerbalMissionState {
  const definition = definitionCandidate;
  const disposition = dispositionCandidate;
  if (disposition.dispositionId !== definition.dispositionId || disposition.npcId !== definition.npcId) {
    throw new Error('Opening mission and disposition IDs must agree.');
  }
  const common = {
    missionId: definition.missionId,
    npcId: definition.npcId,
    status: 'available' as const,
    terminalResultId: null,
    concerns: definition.concerns.map(({ concernId, initialState }) => ({ concernId, state: initialState })),
    creditedMoves: [],
    firedAllergyIds: [],
    liabilityIds: [],
    patience: disposition.patience,
    consecutiveRepeatCount: 0,
    cooldownUntilMinute: null,
    roomState: 'open' as const,
  };
  const contract = definition.goalContract;
  if (contract.kind === 'disclose_fact') {
    return VerbalMissionStateSchema.parse({
      ...common,
      goalKind: contract.kind,
      terms: { factId: contract.factId, recipientId: contract.recipientId },
    });
  }
  if (contract.kind === 'buy_object') {
    return VerbalMissionStateSchema.parse({
      ...common,
      goalKind: contract.kind,
      terms: { objectId: contract.objectId, currentOffer: null },
    });
  }
  return VerbalMissionStateSchema.parse({
    ...common,
    goalKind: contract.kind,
    terms: {
      actionId: contract.actionId,
      subjectNpcId: contract.subjectNpcId,
      locationId: contract.locationId,
      proposedMinute: null,
      commitmentId: null,
    },
  });
}

function requiredConcernsResolved(mission: VerbalMissionState, contract: GoalContract): boolean {
  return contract.requiredConcernIds.every((concernId) => (
    mission.concerns.find((concern) => concern.concernId === concernId)?.state === 'resolved'
  ));
}

export function goalReadiness(
  missionCandidate: VerbalMissionState,
  contract: GoalContract,
  context: Pick<OutcomeEngineContext, 'playerMoney' | 'objectOwners'>,
): Readonly<{ canConfirm: boolean; wouldSucceed: boolean }> {
  const mission = VerbalMissionStateSchema.parse(missionCandidate);
  if (mission.missionId !== contract.missionId || mission.npcId !== contract.npcId || !requiredConcernsResolved(mission, contract)) {
    return { canConfirm: false, wouldSucceed: false };
  }
  if (contract.kind === 'disclose_fact') {
    const canConfirm = mission.goalKind === 'disclose_fact' &&
      mission.terms.factId === contract.factId && mission.terms.recipientId === contract.recipientId;
    return { canConfirm, wouldSucceed: canConfirm };
  }
  if (contract.kind === 'buy_object') {
    const offer = mission.goalKind === 'buy_object' && mission.terms.objectId === contract.objectId
      ? mission.terms.currentOffer
      : null;
    const canConfirm = offer !== null && offer >= contract.hardMinimumPrice &&
      context.playerMoney >= offer && context.objectOwners[contract.objectId] === contract.npcId;
    return { canConfirm, wouldSucceed: canConfirm && offer < contract.successPriceExclusive };
  }
  const proposedMinute = mission.goalKind === 'schedule_cooperation' &&
    mission.terms.actionId === contract.actionId &&
    mission.terms.subjectNpcId === contract.subjectNpcId &&
    mission.terms.locationId === contract.locationId
    ? mission.terms.proposedMinute
    : null;
  const canConfirm = proposedMinute !== null &&
    proposedMinute >= contract.earliestMinute && proposedMinute <= contract.latestMinute;
  return { canConfirm, wouldSucceed: canConfirm };
}

function matchesTrigger(
  trigger: VerbalTrigger,
  move: VerbalMove,
): boolean {
  if (trigger.actIds && !move.acts.some(({ act }) => trigger.actIds!.includes(act))) return false;
  if (trigger.registerIds && !trigger.registerIds.includes(move.register)) return false;
  if (trigger.forbiddenRegisterIds?.includes(move.register)) return false;
  if (trigger.referentId && !move.acts.some(({ referentId }) => referentId === trigger.referentId)) return false;
  if (trigger.claimFactIds && !trigger.claimFactIds.every((factId) => (
    move.claims.some((claim) => claim.factId === factId && claim.polarity !== 'ask')
  ))) return false;
  return true;
}

function setConcern(
  mission: VerbalMissionState,
  concernId: string,
  to: ConcernState,
  reasonId: string,
  transitions: ConcernTransition[],
  activeRecoveryId?: string,
): VerbalMissionState {
  const current = mission.concerns.find((concern) => concern.concernId === concernId);
  if (!current || current.state === to) return mission;
  transitions.push({ concernId, from: current.state, to, reasonId });
  return VerbalMissionStateSchema.parse({
    ...mission,
    concerns: mission.concerns.map((concern) => concern.concernId === concernId
      ? { concernId, state: to, ...(activeRecoveryId ? { activeRecoveryId } : {}) }
      : concern),
  });
}

function reactionFor(
  definition: VerbalMissionDefinition,
  outcome: ReactionDefinition['outcome'],
  preferredId?: string,
): ReactionDefinition {
  const reactionId = preferredId ?? definition.defaultReactionIds[outcome];
  const reaction = definition.reactions.find((candidate) => candidate.reactionId === reactionId);
  if (!reaction || reaction.outcome !== outcome) {
    throw new Error(`Missing ${outcome} reaction ${reactionId}.`);
  }
  return reaction;
}

function finish(
  definition: VerbalMissionDefinition,
  context: OutcomeEngineContext,
  mission: VerbalMissionState,
  outcome: ReactionDefinition['outcome'],
  transitions: readonly ConcernTransition[],
  creditedMoves: readonly LeverCredit[],
  speakable: ReadonlySet<string>,
  blockedLeverIds: ReadonlySet<string>,
  preferredReactionId?: string,
): VerbalMissionOutcome {
  const readiness = goalReadiness(mission, definition.goalContract, context);
  const finalOutcome = readiness.canConfirm && ![
    'refused', 'walkout', 'backfire', 'lie_detected', 'offer_too_low', 'cannot_pay',
  ].includes(outcome)
    ? 'ready' as const
    : outcome;
  const reaction = reactionFor(definition, finalOutcome, finalOutcome === outcome ? preferredReactionId : undefined);
  return {
    outcome: finalOutcome,
    mission,
    concernTransitions: transitions,
    creditedMoves,
    newlySpeakableFactIds: [...speakable].sort(),
    blockedLeverIds: [...blockedLeverIds].sort(),
    ...readiness,
    reactionId: reaction.reactionId,
    readTheRoomId: reaction.readTheRoomId,
    portraitId: reaction.portraitId,
    cueId: reaction.cueId,
    actorFallback: reaction.actorFallback,
  };
}

function factsAvailable(required: readonly string[], available: ReadonlySet<string>): boolean {
  return required.every((factId) => available.has(factId));
}

function termMatches(
  lever: VerbalMissionDefinition['levers'][number],
  context: OutcomeEngineContext,
  contract: GoalContract,
): boolean {
  if (!lever.exactTerm) return true;
  if (lever.exactTerm.kind === 'offer') {
    const amount = context.exactOfferAmount;
    return contract.kind === 'buy_object' && amount !== null &&
      amount >= lever.exactTerm.minimumAmount &&
      (lever.exactTerm.maximumAmount === null || amount <= lever.exactTerm.maximumAmount) &&
      (!lever.exactTerm.requireAffordable || context.playerMoney >= amount);
  }
  const minute = context.exactProposedMinute;
  return contract.kind === 'schedule_cooperation' && minute !== null &&
    (!lever.exactTerm.requireWithinContract || (
      minute >= contract.earliestMinute && minute <= contract.latestMinute
    ));
}

function creditFor(
  lever: VerbalMissionDefinition['levers'][number],
  context: OutcomeEngineContext,
): LeverCredit {
  return {
    leverId: lever.leverId,
    concernId: lever.concernId,
    supportFactIds: [...lever.requiredPlayerFactIds].sort(),
    offerAmount: lever.exactTerm?.kind === 'offer' ? context.exactOfferAmount : null,
  };
}

export function runOutcomeEngine(input: Readonly<{
  mission: VerbalMissionState;
  definition: VerbalMissionDefinition;
  disposition: NpcDisposition;
  move: VerbalMove;
  context: OutcomeEngineContext;
}>): VerbalMissionOutcome {
  const definition = input.definition;
  const disposition = input.disposition;
  const move = input.move;
  const context = EngineContextSchema.parse(input.context);
  let mission = VerbalMissionStateSchema.parse(input.mission);
  if (
    mission.missionId !== definition.missionId || mission.npcId !== definition.npcId ||
    disposition.dispositionId !== definition.dispositionId || disposition.npcId !== definition.npcId
  ) {
    throw new Error('Outcome Engine mission, definition, and disposition IDs must agree.');
  }

  const transitions: ConcernTransition[] = [];
  const newCredits: LeverCredit[] = [];
  const speakable = new Set<string>();
  const blockedLeverIds = new Set<string>();
  const playerFacts = new Set(context.playerFactIds);
  const npcFacts = new Set(context.npcFactIds);

  if (['resolved', 'failed', 'withdrawn'].includes(mission.status)) {
    return finish(definition, context, mission, 'refused', transitions, newCredits, speakable, blockedLeverIds);
  }
  if (mission.cooldownUntilMinute !== null) {
    if (context.absoluteMinute < mission.cooldownUntilMinute) {
      return finish(definition, context, mission, 'refused', transitions, newCredits, speakable, blockedLeverIds);
    }
    mission = VerbalMissionStateSchema.parse({
      ...mission,
      cooldownUntilMinute: null,
      roomState: 'open',
    });
  }

  const boundary = disposition.hardBoundaries.find(({ trigger }) => matchesTrigger(trigger, move));
  if (boundary) {
    mission = VerbalMissionStateSchema.parse({
      ...mission,
      patience: 0,
      roomState: 'done',
      cooldownUntilMinute: context.absoluteMinute + 1_440,
    });
    return finish(definition, context, mission, 'walkout', transitions, newCredits, speakable, blockedLeverIds);
  }

  const contradiction = move.claims.find((claim) => (
    claim.polarity !== 'ask' && context.contradictedFactIds.includes(claim.factId)
  ));
  if (contradiction) {
    return finish(definition, context, mission, 'lie_detected', transitions, newCredits, speakable, blockedLeverIds);
  }
  if (move.acts.some(({ act }) => act === 'threaten')) {
    return finish(definition, context, mission, 'backfire', transitions, newCredits, speakable, blockedLeverIds);
  }

  const allergy = [...definition.allergies]
    .sort((left, right) => left.stableOrder - right.stableOrder || left.allergyId.localeCompare(right.allergyId, 'en'))
    .find((candidate) => matchesTrigger(candidate.trigger, move));
  if (allergy) {
    if (allergy.concernId) {
      const concern = mission.concerns.find(({ concernId }) => concernId === allergy.concernId);
      if (concern && isLegalConcernTransition(concern.state, 'hardened')) {
        mission = setConcern(
          mission, allergy.concernId, 'hardened', allergy.allergyId, transitions, allergy.recoveryIds[0],
        );
      }
    }
    mission = VerbalMissionStateSchema.parse({
      ...mission,
      firedAllergyIds: mission.firedAllergyIds.includes(allergy.allergyId)
        ? mission.firedAllergyIds
        : [...mission.firedAllergyIds, allergy.allergyId],
      patience: Math.max(0, mission.patience + allergy.patienceDelta),
      roomState: allergy.severity === 'severe' ? 'done' : 'guarded',
      cooldownUntilMinute: allergy.severity === 'severe' ? context.absoluteMinute + 1_440 : mission.cooldownUntilMinute,
    });
    return finish(
      definition, context, mission, allergy.severity === 'severe' ? 'walkout' : 'backfire',
      transitions, newCredits, speakable, blockedLeverIds, allergy.reactionId,
    );
  }

  let precedenceOutcome: ReactionDefinition['outcome'] | undefined;
  if (definition.goalContract.kind === 'buy_object' && context.exactOfferAmount !== null) {
    if (context.objectOwners[definition.goalContract.objectId] !== definition.npcId) {
      precedenceOutcome = 'refused';
    } else if (context.exactOfferAmount < definition.goalContract.hardMinimumPrice) {
      precedenceOutcome = 'offer_too_low';
    } else if (context.exactOfferAmount > context.playerMoney) {
      precedenceOutcome = 'cannot_pay';
    }
    if (precedenceOutcome) {
      definition.levers.filter(({ exactTerm }) => exactTerm?.kind === 'offer')
        .forEach(({ leverId }) => blockedLeverIds.add(leverId));
    }
  }
  if (definition.goalContract.kind === 'schedule_cooperation' && context.exactProposedMinute !== null && (
    context.exactProposedMinute < definition.goalContract.earliestMinute ||
    context.exactProposedMinute > definition.goalContract.latestMinute
  )) {
    precedenceOutcome = 'refused';
    definition.levers.filter(({ exactTerm }) => exactTerm?.kind === 'schedule')
      .forEach(({ leverId }) => blockedLeverIds.add(leverId));
  }

  const recovery = [...definition.recoveries]
    .sort((left, right) => left.stableOrder - right.stableOrder || left.recoveryId.localeCompare(right.recoveryId, 'en'))
    .find((candidate) => {
      const concern = mission.concerns.find(({ concernId }) => concernId === candidate.concernId);
      return concern?.state === 'hardened' && concern.activeRecoveryId === candidate.recoveryId &&
        matchesTrigger(candidate.trigger, move) && factsAvailable(candidate.requiredPlayerFactIds, playerFacts);
    });
  let preferredReactionId: string | undefined;
  if (recovery) {
    mission = setConcern(mission, recovery.concernId, recovery.toState, recovery.recoveryId, transitions);
    preferredReactionId = recovery.reactionId;
  }

  const orderedLevers = [...definition.levers]
    .sort((left, right) => left.stableOrder - right.stableOrder || left.leverId.localeCompare(right.leverId, 'en'));
  const lowerOffer = mission.goalKind === 'buy_object' && mission.terms.currentOffer !== null &&
    context.exactOfferAmount !== null && context.exactOfferAmount < mission.terms.currentOffer &&
    !precedenceOutcome && orderedLevers.some((lever) => (
      lever.exactTerm?.kind === 'offer' && matchesTrigger(lever.trigger, move) &&
      factsAvailable(lever.requiredPlayerFactIds, playerFacts) && factsAvailable(lever.requiredNpcFactIds, npcFacts) &&
      !hasLeverCredit(mission.creditedMoves, creditFor(lever, context))
    ));
  if (lowerOffer) {
    for (const concernId of ['payment', 'value']) {
      const concern = mission.concerns.find((candidate) => candidate.concernId === concernId);
      if (concern && ['resolved', 'eased'].includes(concern.state)) {
        mission = setConcern(mission, concernId, 'open', 'lower_offer_reopened', transitions);
      }
    }
  }

  let repeated = false;
  for (const lever of orderedLevers) {
    if (newCredits.length >= 2 || blockedLeverIds.has(lever.leverId)) continue;
    const concern = mission.concerns.find(({ concernId }) => concernId === lever.concernId);
    if (
      !concern || !matchesTrigger(lever.trigger, move) ||
      !factsAvailable(lever.requiredPlayerFactIds, playerFacts) ||
      !factsAvailable(lever.requiredNpcFactIds, npcFacts) ||
      !termMatches(lever, context, definition.goalContract)
    ) continue;
    const credit = creditFor(lever, context);
    if (lever.credits && hasLeverCredit(mission.creditedMoves, credit)) {
      repeated = true;
      continue;
    }
    if (!lever.fromStates.includes(concern.state) || !isLegalConcernTransition(concern.state, lever.toState)) continue;
    mission = setConcern(mission, lever.concernId, lever.toState, lever.leverId, transitions);
    lever.newlySpeakableFactIds.forEach((factId) => speakable.add(factId));
    if (lever.credits) {
      newCredits.push(credit);
      mission = VerbalMissionStateSchema.parse({
        ...mission,
        creditedMoves: [...mission.creditedMoves, credit],
      });
      if (lever.exactTerm?.kind === 'offer' && mission.goalKind === 'buy_object') {
        mission = VerbalMissionStateSchema.parse({
          ...mission,
          terms: { ...mission.terms, currentOffer: context.exactOfferAmount },
        });
      }
      if (lever.exactTerm?.kind === 'schedule' && mission.goalKind === 'schedule_cooperation') {
        mission = VerbalMissionStateSchema.parse({
          ...mission,
          terms: { ...mission.terms, proposedMinute: context.exactProposedMinute },
        });
      }
    }
    preferredReactionId ??= lever.reactionId;
  }

  if (transitions.length > 0 || newCredits.length > 0) {
    mission = VerbalMissionStateSchema.parse({ ...mission, consecutiveRepeatCount: 0 });
    return finish(
      definition, context, mission, precedenceOutcome ?? 'progress', transitions, newCredits,
      speakable, blockedLeverIds, precedenceOutcome ? undefined : preferredReactionId,
    );
  }
  if (precedenceOutcome) {
    return finish(definition, context, mission, precedenceOutcome, transitions, newCredits, speakable, blockedLeverIds);
  }
  if (repeated) {
    const repeatCount = Math.min(10, mission.consecutiveRepeatCount + 1);
    mission = VerbalMissionStateSchema.parse({
      ...mission,
      consecutiveRepeatCount: repeatCount,
      roomState: repeatRoomState(repeatCount, disposition.repetitionTolerance),
    });
    return finish(definition, context, mission, 'repeat', transitions, newCredits, speakable, blockedLeverIds);
  }
  const outcome = move.referenceConfidence === 'ambiguous' ? 'clarify' : 'small_talk';
  return finish(definition, context, mission, outcome, transitions, newCredits, speakable, blockedLeverIds);
}
