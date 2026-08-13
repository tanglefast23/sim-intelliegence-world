import { z } from 'zod';

import { VERBAL_MISSION_OUTCOMES } from './contracts';
import { isLegalConcernTransition } from './outcome-engine';
import { VerbalMissionStateSchema, type VerbalMissionState } from './state';
import { KnowledgeRecordSchema } from '../state/models';
import { StableIdSchema } from '../state/ids';

export const VerbalMissionOutcomeCommandSchema = z.object({
  outcomeId: StableIdSchema,
  outcome: z.enum(VERBAL_MISSION_OUTCOMES),
  reactionId: StableIdSchema,
  expectedMission: VerbalMissionStateSchema,
  nextMission: VerbalMissionStateSchema,
}).strict();

export const RecordPlayerKnowledgeBodySchema = z.object({ record: KnowledgeRecordSchema }).strict();

function startsWithJson<T>(current: readonly T[], next: readonly T[]): boolean {
  return current.length <= next.length && current.every((value, index) => (
    JSON.stringify(value) === JSON.stringify(next[index])
  ));
}

function goalTermsCompatible(current: VerbalMissionState, next: VerbalMissionState): boolean {
  if (current.goalKind !== next.goalKind) return false;
  if (current.goalKind === 'disclose_fact' && next.goalKind === 'disclose_fact') {
    return JSON.stringify(current.terms) === JSON.stringify(next.terms);
  }
  if (current.goalKind === 'buy_object' && next.goalKind === 'buy_object') {
    return current.terms.objectId === next.terms.objectId;
  }
  return current.goalKind === 'schedule_cooperation' && next.goalKind === 'schedule_cooperation' &&
    current.terms.actionId === next.terms.actionId &&
    current.terms.subjectNpcId === next.terms.subjectNpcId &&
    current.terms.locationId === next.terms.locationId &&
    current.terms.commitmentId === next.terms.commitmentId;
}

export function validateAppliedMissionOutcome(
  currentCandidate: VerbalMissionState,
  nextCandidate: VerbalMissionState,
): VerbalMissionState {
  const current = VerbalMissionStateSchema.parse(currentCandidate);
  const next = VerbalMissionStateSchema.parse(nextCandidate);
  if (
    current.missionId !== next.missionId || current.npcId !== next.npcId ||
    !goalTermsCompatible(current, next) || current.terminalResultId !== null || next.terminalResultId !== null ||
    !['available', 'active'].includes(current.status) || next.status !== 'active'
  ) throw new Error('Applied Verbal Mission outcome changed protected mission identity or lifecycle state.');
  if (
    current.concerns.length !== next.concerns.length ||
    !startsWithJson(current.creditedMoves, next.creditedMoves) || next.creditedMoves.length - current.creditedMoves.length > 2 ||
    !startsWithJson(current.firedAllergyIds, next.firedAllergyIds) ||
    !startsWithJson(current.liabilityIds, next.liabilityIds) ||
    next.patience > current.patience
  ) throw new Error('Applied Verbal Mission outcome changed protected progress history.');

  const lowerOffer = current.goalKind === 'buy_object' && next.goalKind === 'buy_object' &&
    current.terms.currentOffer !== null && next.terms.currentOffer !== null &&
    next.terms.currentOffer < current.terms.currentOffer;
  for (const [index, concern] of current.concerns.entries()) {
    const candidate = next.concerns[index];
    if (!candidate || candidate.concernId !== concern.concernId) {
      throw new Error('Applied Verbal Mission outcome changed concern identity or order.');
    }
    if (candidate.state === concern.state) {
      if (candidate.activeRecoveryId !== concern.activeRecoveryId) {
        throw new Error('Applied Verbal Mission outcome changed recovery without a concern transition.');
      }
      continue;
    }
    const lowerOfferReopen = lowerOffer && ['payment', 'value'].includes(concern.concernId) &&
      ['eased', 'resolved'].includes(concern.state) && candidate.state === 'open';
    const recovery = concern.state === 'hardened' && concern.activeRecoveryId !== undefined &&
      ['open', 'eased'].includes(candidate.state) && candidate.activeRecoveryId === undefined;
    if (!lowerOfferReopen && !isLegalConcernTransition(concern.state, candidate.state, recovery)) {
      throw new Error(`Illegal applied concern transition ${concern.concernId}: ${concern.state} -> ${candidate.state}.`);
    }
    if (candidate.state === 'hardened' && !candidate.activeRecoveryId) {
      throw new Error('A hardened concern requires its named recovery.');
    }
  }
  if (current.goalKind === 'buy_object' && next.goalKind === 'buy_object' &&
    current.terms.currentOffer !== next.terms.currentOffer) {
    const appended = next.creditedMoves.slice(current.creditedMoves.length);
    if (!appended.some(({ offerAmount }) => offerAmount === next.terms.currentOffer)) {
      throw new Error('Current offer can change only through a credited offer lever.');
    }
  }
  if (current.goalKind === 'schedule_cooperation' && next.goalKind === 'schedule_cooperation' &&
    current.terms.proposedMinute !== next.terms.proposedMinute &&
    next.creditedMoves.length === current.creditedMoves.length) {
    throw new Error('Proposed minute can change only through a credited schedule lever.');
  }
  return next;
}
