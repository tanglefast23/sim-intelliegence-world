import { upsertJournalEntry } from '../quests/journal';
import { applyRelationshipDelta } from '../relationships/relationship';
import { parseWorldState, type WorldState } from '../state/schema';

export type CommitmentResolution = 'honoured' | 'delayed' | 'reneged';

export function dueCommitmentIds(state: WorldState): string[] {
  return Object.values(state.commitments)
    .filter((commitment) => (
      (commitment.status === 'agreed' || commitment.status === 'delayed') &&
      commitment.scheduledMinute <= state.clock.absoluteMinute
    ))
    .map(({ commitmentId }) => commitmentId)
    .sort();
}

function journalForMission(state: WorldState, missionId: string) {
  const entry = Object.values(state.journal).find((candidate) => (
    candidate.subject.kind === 'verbal_mission' && candidate.subject.missionId === missionId
  ));
  if (!entry) throw new Error(`Commitment mission ${missionId} is missing its journal entry.`);
  return entry;
}

function resolutionFor(state: WorldState, commitmentId: string): Readonly<{
  status: CommitmentResolution;
  reasonId?: string;
  scheduledMinute?: number;
}> {
  const commitment = state.commitments[commitmentId];
  if (!commitment || (commitment.status !== 'agreed' && commitment.status !== 'delayed')) {
    throw new Error(`Commitment ${commitmentId} is not pending resolution.`);
  }
  if (state.clock.absoluteMinute < commitment.scheduledMinute) {
    throw new Error(`Commitment ${commitmentId} is not due.`);
  }
  const npc = state.npcs[commitment.npcId];
  const target = state.npcs[commitment.targetId];
  if (!npc || npc.condition === 'dead' || !target || target.condition === 'dead') {
    return { status: 'reneged', reasonId: 'participant_unavailable' };
  }
  if (npc.condition === 'injured' || npc.presence.kind === 'in_transit') {
    const deadline = commitment.deadlineMinute ?? state.clock.absoluteMinute;
    if (state.clock.absoluteMinute >= deadline) {
      return { status: 'reneged', reasonId: 'assessment_deadline_missed' };
    }
    return {
      status: 'delayed',
      reasonId: 'medical_delay',
      scheduledMinute: Math.min(deadline, state.clock.absoluteMinute + 60),
    };
  }
  return { status: 'honoured' };
}

export function planCommitmentResolution(state: WorldState, commitmentId: string) {
  const current = state.commitments[commitmentId];
  if (!current) throw new Error(`Unknown commitment: ${commitmentId}`);
  if (current.status === 'honoured' || current.status === 'reneged') {
    return { state, changed: false, commitment: current, result: current.status } as const;
  }
  const resolution = resolutionFor(state, commitmentId);
  const mission = state.verbalMissions[current.missionId];
  if (!mission || mission.goalKind !== 'schedule_cooperation' || mission.terms.commitmentId !== commitmentId) {
    throw new Error('Scheduled commitment lost its owning mission.');
  }
  const entry = journalForMission(state, mission.missionId);
  if (resolution.status === 'delayed') {
    const commitment = {
      ...current,
      status: 'delayed' as const,
      reasonId: resolution.reasonId!,
      scheduledMinute: resolution.scheduledMinute!,
    };
    const journal = upsertJournalEntry(entry, {
      ...entry,
      summary: `Priya delayed the assessment until minute ${commitment.scheduledMinute}.`,
      source: { type: 'authored_event', sourceId: resolution.reasonId! },
      outcomeReceipts: [{
        id: `receipt_priya_delayed_${commitment.scheduledMinute}`,
        summary: 'The assessment was delayed with a new exact time.', outcome: 'information',
      }],
    });
    return {
      state: parseWorldState({
        ...state,
        commitments: { ...state.commitments, [commitmentId]: commitment },
        verbalMissions: {
          ...state.verbalMissions,
          [mission.missionId]: {
            ...mission,
            terms: { ...mission.terms, proposedMinute: commitment.scheduledMinute },
            roomState: 'open',
          },
        },
        journal: { ...state.journal, [journal.id]: journal },
      }),
      changed: true,
      commitment,
      result: resolution.status,
      reasonId: resolution.reasonId,
      journalReceiptId: `receipt_priya_delayed_${commitment.scheduledMinute}`,
      relationshipDelta: { familiarity: 0, trust: 0, attraction: 0 },
    } as const;
  }

  const commitmentBase = {
    commitmentId: current.commitmentId,
    missionId: current.missionId,
    npcId: current.npcId,
    actionId: current.actionId,
    targetId: current.targetId,
    locationId: current.locationId,
    agreedMinute: current.agreedMinute,
    ...(current.deadlineMinute === undefined ? {} : { deadlineMinute: current.deadlineMinute }),
  };
  const commitment = resolution.status === 'honoured'
    ? { ...commitmentBase, status: 'honoured' as const, resolvedMinute: state.clock.absoluteMinute }
    : {
      ...commitmentBase,
      status: 'reneged' as const,
      reasonId: resolution.reasonId!,
      resolvedMinute: state.clock.absoluteMinute,
    };
  const resultId = resolution.status === 'honoured' ? 'priya_assessment_honoured' : 'priya_assessment_reneged';
  const journalReceiptId = `receipt_${resultId}`;
  const journal = upsertJournalEntry(entry, {
    ...entry,
    summary: resolution.status === 'honoured'
      ? 'Priya completed the off-island transport assessment.'
      : 'Priya could not complete the assessment.',
    source: { type: 'authored_event', sourceId: resultId },
    resolutionState: 'resolved',
    outcomeReceipts: [{
      id: journalReceiptId,
      summary: resolution.status === 'honoured'
        ? 'The scheduled assessment was honoured.'
        : 'The scheduled assessment was not honoured.',
      outcome: resolution.status === 'honoured' ? 'success' : 'failure',
    }],
  });
  const relationship = state.relationships[mission.npcId];
  if (!relationship) throw new Error(`Missing commitment relationship for ${mission.npcId}.`);
  const relationshipResult = applyRelationshipDelta(
    relationship.values,
    resolution.status === 'honoured'
      ? { familiarity: 1, trust: 3, attraction: 0 }
      : { familiarity: 0, trust: -3, attraction: 0 },
    'quest',
  );
  return {
    state: parseWorldState({
      ...state,
      commitments: { ...state.commitments, [commitmentId]: commitment },
      verbalMissions: {
        ...state.verbalMissions,
        [mission.missionId]: {
          ...mission,
          status: resolution.status === 'honoured' ? 'resolved' : 'failed',
          terminalResultId: resultId,
          roomState: 'done',
        },
      },
      journal: { ...state.journal, [journal.id]: journal },
      relationships: {
        ...state.relationships,
        [mission.npcId]: { ...relationship, values: relationshipResult.values },
      },
    }),
    changed: true,
    commitment,
    result: resolution.status,
    reasonId: resolution.reasonId,
    journalReceiptId,
    relationshipDelta: relationshipResult.appliedDelta,
  } as const;
}

export function automaticCommitmentCommand(commitmentId: string, scheduledMinute: number) {
  const suffix = commitmentId.replaceAll('_', '-');
  return {
    type: 'resolve-scheduled-commitment' as const,
    commandId: `command-auto-resolve-${suffix}-${scheduledMinute}`,
    eventId: `event-auto-resolve-${suffix}-${scheduledMinute}`,
    scheduledMinute,
    priority: 90,
    commitmentId,
  };
}
