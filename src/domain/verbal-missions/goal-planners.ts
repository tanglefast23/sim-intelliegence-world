import type { GoalContract } from './contracts';
import { goalReadiness } from './outcome-engine';
import { VerbalMissionStateSchema, type VerbalMissionState } from './state';
import { upsertJournalEntry, type JournalEntry } from '../quests/journal';
import { applyRelationshipDelta } from '../relationships/relationship';
import type { KnowledgeRecord } from '../state/models';
import { parseWorldState, type WorldState } from '../state/schema';

export const TOMAS_FERRY_MISSION_ID = 'tomas_after_dark_ferry' as const;
export const LINDA_PURSE_MISSION_ID = 'linda_marchetti_purse_sale' as const;
export const PRIYA_ASSESSMENT_MISSION_ID = 'priya_off_island_assessment' as const;
export const PRIYA_ASSESSMENT_COMMITMENT_ID = 'commitment_priya_assessment' as const;

type MissionAuthority = Readonly<{
  contract: GoalContract;
  journalEntryId: string;
  journalSummary: string;
  concernStates: readonly Readonly<{
    concernId: string;
    state: 'hidden' | 'open';
  }>[];
  patience: number;
}>;

export const VERBAL_MISSION_AUTHORITIES: Readonly<Record<string, MissionAuthority>> = {
  [TOMAS_FERRY_MISSION_ID]: {
    contract: {
      kind: 'disclose_fact', missionId: TOMAS_FERRY_MISSION_ID, npcId: 'tomas_reed',
      requiredConcernIds: ['procedure'], availableWhenId: 'tomas_ferry_available',
      confirmRuleId: 'tomas_ferry_ready', successRuleId: 'tomas_ferry_disclosed',
      closerActionId: 'record_tomas_ferry_disclosure', factId: 'ferry_after_dark_route',
      recipientId: 'protagonist', commandType: 'record_fact_disclosure',
    },
    journalEntryId: 'journal_tomas_after_dark_ferry',
    journalSummary: 'Find out which ferry still runs after dark.',
    concernStates: [{ concernId: 'procedure', state: 'open' }],
    patience: 6,
  },
  [LINDA_PURSE_MISSION_ID]: {
    contract: {
      kind: 'buy_object', missionId: LINDA_PURSE_MISSION_ID, npcId: 'linda',
      requiredConcernIds: ['purpose', 'value', 'dignity', 'payment'],
      availableWhenId: 'linda_purse_available', confirmRuleId: 'linda_purse_sale_legal',
      successRuleId: 'linda_purse_under_100', closerActionId: 'buy_linda_marchetti_purse',
      objectId: 'linda_marchetti_purse', successPriceExclusive: 100, hardMinimumPrice: 80,
      commandType: 'purchase_unique_object',
    },
    journalEntryId: 'journal_linda_marchetti_purse',
    journalSummary: 'Convince Linda to sell her black Marchetti purse for less than $100.',
    concernStates: [
      { concernId: 'purpose', state: 'open' },
      { concernId: 'value', state: 'open' },
      { concernId: 'dignity', state: 'hidden' },
      { concernId: 'payment', state: 'open' },
    ],
    patience: 6,
  },
  [PRIYA_ASSESSMENT_MISSION_ID]: {
    contract: {
      kind: 'schedule_cooperation', missionId: PRIYA_ASSESSMENT_MISSION_ID, npcId: 'priya_nair',
      requiredConcernIds: ['evidence', 'consent', 'capacity'],
      availableWhenId: 'priya_assessment_available', confirmRuleId: 'priya_assessment_ready',
      successRuleId: 'priya_assessment_agreed', closerActionId: 'schedule_priya_assessment',
      actionId: 'assess_off_island_transport', subjectNpcId: 'linda_boyfriend',
      locationId: 'linda_villa', earliestMinute: 600, latestMinute: 10_080,
      commandType: 'create_scheduled_commitment',
    },
    journalEntryId: 'journal_priya_off_island_assessment',
    journalSummary: 'Ask Priya to assess the injured resident for off-island transport.',
    concernStates: [
      { concernId: 'evidence', state: 'open' },
      { concernId: 'consent', state: 'open' },
      { concernId: 'capacity', state: 'open' },
    ],
    patience: 7,
  },
};

type KnowledgeAuthority = Readonly<{
  assertedValue: string | number | boolean | null;
  epistemicState: 'observed_fact' | 'held_belief';
  truthStatus: 'verified' | 'contradicted' | 'unknown';
  sources: readonly Readonly<{ type: KnowledgeRecord['source']['type']; sourceId: string }>[];
}>;

export const PLAYER_KNOWLEDGE_AUTHORITIES: Readonly<Record<string, KnowledgeAuthority>> = {
  ferry_after_dark_route: {
    assertedValue: 'southeast_night_ferry', epistemicState: 'observed_fact', truthStatus: 'verified',
    sources: [{ type: 'authored_event', sourceId: 'tomas_ferry_disclosure' }],
  },
  linda_purse_independence_story: {
    assertedValue: true, epistemicState: 'observed_fact', truthStatus: 'verified',
    sources: [{ type: 'authored_event', sourceId: 'linda_purse_story' }],
  },
  linda_quick_consignment_net: {
    assertedValue: 85, epistemicState: 'observed_fact', truthStatus: 'verified',
    sources: [{ type: 'scene_observation', sourceId: 'consignment_appraisal' }],
  },
  linda_bakery_deposit_deadline: {
    assertedValue: 'friday', epistemicState: 'observed_fact', truthStatus: 'verified',
    sources: [{ type: 'authored_event', sourceId: 'linda_bakery_deadline' }],
  },
  priya_patient_consent: {
    assertedValue: true, epistemicState: 'observed_fact', truthStatus: 'verified',
    sources: [{ type: 'authored_event', sourceId: 'patient_consent_record' }],
  },
};

export function verbalMissionAuthority(missionId: string): MissionAuthority {
  const authority = VERBAL_MISSION_AUTHORITIES[missionId];
  if (!authority) throw new Error(`Unsupported Verbal Mission: ${missionId}`);
  return authority;
}

export function openingMissionFor(missionId: string): VerbalMissionState {
  const authority = verbalMissionAuthority(missionId);
  const common = {
    missionId,
    npcId: authority.contract.npcId,
    status: 'available' as const,
    terminalResultId: null,
    concerns: authority.concernStates,
    creditedMoves: [], firedAllergyIds: [], liabilityIds: [], patience: authority.patience,
    consecutiveRepeatCount: 0, cooldownUntilMinute: null, roomState: 'open' as const,
  };
  const contract = authority.contract;
  if (contract.kind === 'disclose_fact') {
    return VerbalMissionStateSchema.parse({
      ...common, goalKind: contract.kind, terms: { factId: contract.factId, recipientId: contract.recipientId },
    });
  }
  if (contract.kind === 'buy_object') {
    return VerbalMissionStateSchema.parse({
      ...common, goalKind: contract.kind, terms: { objectId: contract.objectId, currentOffer: null },
    });
  }
  return VerbalMissionStateSchema.parse({
    ...common,
    goalKind: contract.kind,
    terms: {
      actionId: contract.actionId, subjectNpcId: contract.subjectNpcId, locationId: contract.locationId,
      proposedMinute: null, commitmentId: null,
    },
  });
}

function missionAvailable(state: WorldState, missionId: string): boolean {
  if (missionId === TOMAS_FERRY_MISSION_ID) return true;
  const lindaQuest = state.quests.linda_boyfriend_check;
  if (missionId === LINDA_PURSE_MISSION_ID) {
    return Boolean(lindaQuest && ['resolved', 'failed', 'withdrawn'].includes(lindaQuest.status) &&
      !lindaQuest.flagIds.includes('linda_betrayed'));
  }
  if (missionId === PRIYA_ASSESSMENT_MISSION_ID) {
    return Boolean(lindaQuest?.flagIds.includes('linda_protect_failed'));
  }
  return false;
}

function missionJournal(authority: MissionAuthority, missionId: string): JournalEntry {
  return {
    id: authority.journalEntryId,
    subject: { kind: 'verbal_mission', missionId },
    summary: authority.journalSummary,
    locationPrecision: 'none', markerVisible: false,
    source: { type: 'authored_event', sourceId: `offer_${missionId}` },
    resolutionState: 'open', outcomeReceipts: [],
  };
}

export function planOfferVerbalMission(state: WorldState, missionId: string) {
  const authority = verbalMissionAuthority(missionId);
  const existing = state.verbalMissions[missionId];
  if (existing) return { state, mission: existing, journalEntryId: authority.journalEntryId, changed: false } as const;
  const conflicting = Object.values(state.verbalMissions).find((mission) => (
    mission.npcId === authority.contract.npcId && ['available', 'active'].includes(mission.status)
  ));
  if (conflicting) throw new Error(`${authority.contract.npcId} already has unresolved Verbal Mission ${conflicting.missionId}.`);
  if (!missionAvailable(state, missionId)) throw new Error(`Verbal Mission ${missionId} is not available.`);
  const mission = openingMissionFor(missionId);
  const entry = missionJournal(authority, missionId);
  return {
    state: parseWorldState({
      ...state,
      verbalMissions: { ...state.verbalMissions, [missionId]: mission },
      journal: { ...state.journal, [entry.id]: entry },
    }),
    mission,
    journalEntryId: entry.id,
    changed: true,
  } as const;
}

function journalForMission(state: WorldState, missionId: string): JournalEntry {
  const entry = Object.values(state.journal).find((candidate) => (
    candidate.subject.kind === 'verbal_mission' && candidate.subject.missionId === missionId
  ));
  if (!entry) throw new Error(`Verbal Mission ${missionId} is missing its journal entry.`);
  return entry;
}

function relationshipState(
  state: WorldState,
  npcId: string,
  delta: Readonly<{ familiarity: number; trust: number; attraction: number }>,
) {
  const relationship = state.relationships[npcId];
  if (!relationship) throw new Error(`Missing Verbal Mission relationship for ${npcId}.`);
  const applied = applyRelationshipDelta(relationship.values, delta, 'quest');
  return {
    relationships: { ...state.relationships, [npcId]: { ...relationship, values: applied.values } },
    appliedDelta: applied.appliedDelta,
  };
}

export function validatePlayerKnowledge(record: KnowledgeRecord): KnowledgeRecord {
  const authority = PLAYER_KNOWLEDGE_AUTHORITIES[record.factId];
  if (!authority) throw new Error(`Unregistered player knowledge fact: ${record.factId}`);
  const sourceAllowed = authority.sources.some((source) => (
    source.type === record.source.type && source.sourceId === record.source.sourceId
  ));
  if (
    JSON.stringify(record.assertedValue) !== JSON.stringify(authority.assertedValue) ||
    record.epistemicState !== authority.epistemicState ||
    record.truthStatus !== authority.truthStatus || !sourceAllowed
  ) throw new Error(`Player knowledge ${record.factId} does not match its authored atom and source.`);
  return record;
}

export function authoredPlayerKnowledgeRecord(factId: string): KnowledgeRecord {
  const authority = PLAYER_KNOWLEDGE_AUTHORITIES[factId];
  const source = authority?.sources[0];
  if (!authority || !source) throw new Error(`Unregistered player knowledge fact: ${factId}`);
  return {
    factId,
    assertedValue: authority.assertedValue,
    epistemicState: authority.epistemicState,
    truthStatus: authority.truthStatus,
    source,
  };
}

export function planRecordPlayerKnowledge(state: WorldState, record: KnowledgeRecord) {
  const existing = state.playerKnowledge[record.factId];
  if (existing) return { state, record: existing, changed: false } as const;
  const validated = validatePlayerKnowledge(record);
  return {
    state: parseWorldState({
      ...state,
      playerKnowledge: { ...state.playerKnowledge, [validated.factId]: validated },
    }),
    record: validated,
    changed: true,
  } as const;
}

function assertActiveReadyMission(state: WorldState, missionId: string, kind: GoalContract['kind']) {
  const mission = state.verbalMissions[missionId];
  const authority = verbalMissionAuthority(missionId);
  if (!mission || mission.status !== 'active') throw new Error(`Closer requires active Verbal Mission ${missionId}.`);
  if (mission.goalKind !== kind || authority.contract.kind !== kind) {
    throw new Error(`${missionId} cannot use the ${kind} goal-family closer.`);
  }
  const readiness = goalReadiness(mission, authority.contract, {
    playerMoney: state.inventory.money,
    objectOwners: Object.fromEntries(Object.entries(state.worldObjects).map(([id, object]) => [id, object.ownerId])),
  });
  if (!readiness.canConfirm) throw new Error(`Verbal Mission ${missionId} is not ready to confirm.`);
  return { mission, authority, readiness } as const;
}

export function planFactDisclosure(state: WorldState, missionId: string) {
  const existing = state.verbalMissions[missionId];
  if (existing?.terminalResultId === 'tomas_ferry_disclosed') return { state, changed: false, resultId: existing.terminalResultId } as const;
  const { mission, authority } = assertActiveReadyMission(state, missionId, 'disclose_fact');
  if (authority.contract.kind !== 'disclose_fact' || mission.goalKind !== 'disclose_fact') throw new Error('Fact disclosure family mismatch.');
  const record: KnowledgeRecord = {
    factId: authority.contract.factId,
    assertedValue: 'southeast_night_ferry',
    epistemicState: 'observed_fact', truthStatus: 'verified',
    source: { type: 'authored_event', sourceId: 'tomas_ferry_disclosure' },
  };
  const knowledge = state.playerKnowledge[record.factId] ? state.playerKnowledge : {
    ...state.playerKnowledge,
    [record.factId]: validatePlayerKnowledge(record),
  };
  const resultId = 'tomas_ferry_disclosed';
  const journal = upsertJournalEntry(journalForMission(state, missionId), {
    ...journalForMission(state, missionId),
    summary: 'Tomas disclosed which ferry still runs after dark.',
    source: { type: 'authored_event', sourceId: resultId },
    resolutionState: 'resolved',
    outcomeReceipts: [{
      id: 'receipt_tomas_ferry_disclosed', summary: 'Learned the after-dark ferry route.', outcome: 'success',
    }],
  });
  const relationship = relationshipState(state, mission.npcId, { familiarity: 2, trust: 2, attraction: 0 });
  return {
    state: parseWorldState({
      ...state,
      playerKnowledge: knowledge,
      verbalMissions: {
        ...state.verbalMissions,
        [missionId]: { ...mission, status: 'resolved', terminalResultId: resultId, roomState: 'done' },
      },
      journal: { ...state.journal, [journal.id]: journal },
      relationships: relationship.relationships,
    }),
    changed: true,
    resultId,
    factId: record.factId,
    journalReceiptId: 'receipt_tomas_ferry_disclosed',
    relationshipDelta: relationship.appliedDelta,
  } as const;
}

export function planUniqueObjectPurchase(state: WorldState, missionId: string, confirmedAmount: number) {
  const existing = state.verbalMissions[missionId];
  if (existing && ['linda_purse_sold', 'paid_too_much'].includes(existing.terminalResultId ?? '')) {
    return { state, changed: false, resultId: existing.terminalResultId! } as const;
  }
  const { mission, authority, readiness } = assertActiveReadyMission(state, missionId, 'buy_object');
  if (authority.contract.kind !== 'buy_object' || mission.goalKind !== 'buy_object') throw new Error('Unique purchase family mismatch.');
  if (mission.terms.currentOffer !== confirmedAmount) throw new Error('Confirmed amount must match the current credited offer.');
  if (!Number.isSafeInteger(confirmedAmount) || confirmedAmount < authority.contract.hardMinimumPrice) {
    throw new Error('Confirmed amount is below the authored hard minimum.');
  }
  const object = state.worldObjects[authority.contract.objectId];
  if (!object || object.ownerId !== mission.npcId) throw new Error('The NPC no longer owns the unique object.');
  if (state.inventory.money < confirmedAmount) throw new Error('The protagonist cannot afford the confirmed amount.');
  const success = readiness.wouldSucceed;
  const resultId = success ? 'linda_purse_sold' : 'paid_too_much';
  const journalReceiptId = `receipt_${resultId}`;
  const journal = upsertJournalEntry(journalForMission(state, missionId), {
    ...journalForMission(state, missionId),
    summary: success
      ? `Bought Linda's Marchetti purse for $${confirmedAmount}.`
      : `Bought Linda's purse for $${confirmedAmount}, missing the under-$100 goal.`,
    source: { type: 'authored_event', sourceId: resultId },
    resolutionState: 'resolved',
    outcomeReceipts: [{
      id: journalReceiptId,
      summary: success ? 'The private sale met the price goal.' : 'The sale was legal, but the price goal failed.',
      outcome: success ? 'success' : 'failure',
    }],
  });
  const relationship = relationshipState(
    state, mission.npcId, success
      ? { familiarity: 2, trust: 2, attraction: 0 }
      : { familiarity: 1, trust: 0, attraction: 0 },
  );
  return {
    state: parseWorldState({
      ...state,
      inventory: { ...state.inventory, money: state.inventory.money - confirmedAmount },
      worldObjects: {
        ...state.worldObjects,
        [object.objectId]: { ...object, ownerId: state.protagonist.id },
      },
      verbalMissions: {
        ...state.verbalMissions,
        [missionId]: {
          ...mission, status: success ? 'resolved' : 'failed', terminalResultId: resultId, roomState: 'done',
        },
      },
      journal: { ...state.journal, [journal.id]: journal },
      relationships: relationship.relationships,
    }),
    changed: true,
    resultId,
    journalReceiptId,
    amount: confirmedAmount,
    relationshipDelta: relationship.appliedDelta,
  } as const;
}

export function planScheduledCommitment(
  state: WorldState,
  missionId: string,
  commitmentId: string,
  scheduledMinute: number,
) {
  const existing = state.commitments[commitmentId];
  if (existing?.missionId === missionId) return { state, changed: false, commitment: existing } as const;
  if (commitmentId !== PRIYA_ASSESSMENT_COMMITMENT_ID) throw new Error('Priya assessment uses one authored commitment ID.');
  const { mission, authority } = assertActiveReadyMission(state, missionId, 'schedule_cooperation');
  if (authority.contract.kind !== 'schedule_cooperation' || mission.goalKind !== 'schedule_cooperation') {
    throw new Error('Scheduled cooperation family mismatch.');
  }
  if (mission.terms.proposedMinute !== scheduledMinute) {
    throw new Error('Scheduled commitment must match the current credited proposal.');
  }
  if (!Number.isSafeInteger(scheduledMinute + 240)) {
    throw new RangeError('Scheduled commitment deadline exceeds the safe minute range.');
  }
  const commitment = {
    commitmentId,
    missionId,
    npcId: mission.npcId,
    actionId: authority.contract.actionId,
    targetId: authority.contract.subjectNpcId,
    locationId: authority.contract.locationId,
    agreedMinute: state.clock.absoluteMinute,
    deadlineMinute: scheduledMinute + 240,
    status: 'agreed' as const,
    scheduledMinute,
  };
  const journal = upsertJournalEntry(journalForMission(state, missionId), {
    ...journalForMission(state, missionId),
    summary: `Agreement secured: Priya will assess the resident at minute ${scheduledMinute}.`,
    source: { type: 'authored_event', sourceId: 'priya_assessment_agreed' },
    outcomeReceipts: [{
      id: 'receipt_priya_agreement_secured', summary: 'Priya agreed to the scheduled assessment.', outcome: 'information',
    }],
  });
  const relationship = relationshipState(state, mission.npcId, { familiarity: 1, trust: 1, attraction: 0 });
  return {
    state: parseWorldState({
      ...state,
      verbalMissions: {
        ...state.verbalMissions,
        [missionId]: { ...mission, terms: { ...mission.terms, commitmentId }, roomState: 'done' },
      },
      commitments: { ...state.commitments, [commitmentId]: commitment },
      journal: { ...state.journal, [journal.id]: journal },
      relationships: relationship.relationships,
    }),
    changed: true,
    commitment,
    journalReceiptId: 'receipt_priya_agreement_secured',
    relationshipDelta: relationship.appliedDelta,
  } as const;
}

export function planWithdrawVerbalMission(state: WorldState, missionId: string) {
  const mission = state.verbalMissions[missionId];
  if (!mission) throw new Error(`Unknown Verbal Mission: ${missionId}`);
  if (mission.status === 'withdrawn') return { state, changed: false, resultId: mission.terminalResultId! } as const;
  if (!['available', 'active'].includes(mission.status)) throw new Error('Only an unresolved Verbal Mission can be withdrawn.');
  const resultId = 'player_withdrew';
  const journal = upsertJournalEntry(journalForMission(state, missionId), {
    ...journalForMission(state, missionId),
    summary: 'I explicitly withdrew from this Verbal Mission.',
    source: { type: 'authored_event', sourceId: resultId },
    resolutionState: 'resolved',
    outcomeReceipts: [{ id: `receipt_${missionId}_withdrawn`, summary: 'Mission withdrawn.', outcome: 'withdrawn' }],
  });
  return {
    state: parseWorldState({
      ...state,
      verbalMissions: {
        ...state.verbalMissions,
        [missionId]: { ...mission, status: 'withdrawn', terminalResultId: resultId, roomState: 'done' },
      },
      journal: { ...state.journal, [journal.id]: journal },
    }),
    changed: true,
    resultId,
    journalReceiptId: `receipt_${missionId}_withdrawn`,
  } as const;
}
