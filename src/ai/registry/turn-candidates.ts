import type { SceneRegistry } from './scene-registry';
import { canModelInferStructuredAction } from '../conversation/direct-request';

export { canModelInferStructuredAction } from '../conversation/direct-request';

export type TurnCandidateRegistry = Readonly<{
  actionIds: readonly string[];
  factIds: readonly string[];
  interestIds: readonly string[];
  memorySubjectIds: readonly string[];
  unlockIds: readonly string[];
}>;

const CAT_WORD = /\b(?:cat|kitten)\b/iu;
const NEGATION = /\b(?:do not|don't|dont|never|no longer|not|no)\b/iu;
const FIRST_PERSON_OWNERSHIP = /\bi\s+(?:(?:also|actually|really)\s+)?(?:have|own)\s+(?:an?\s+)?[^.!?]{0,48}\b(?:cat|kitten)\b/iu;
const POSSESSIVE_CAT = /\bmy\s+(?:(?:little|old|new|pet|black|white|orange|named)\s+){0,2}(?:cat|kitten)\b/iu;
const QUESTION_LEAD = /^(?:do|does|did|is|are|am|can|could|would|will|should|what|when|where|why|how|who)\b/iu;
const FOLLOW_UP_QUESTION_LEAD = /[,;](?=\s*(?:do|does|did|is|are|can|could|would|will|should|what|when|where|why|how|who)\b)/iu;

export function isPositiveFirstPersonCatClaim(source: string): boolean {
  const sentences = source.match(/[^.!?]+[.!?]?/gu) ?? [];
  return sentences.flatMap((sentence) => sentence.split(FOLLOW_UP_QUESTION_LEAD)).some((candidate) => {
    const clause = candidate.trim();
    return clause.length > 0 &&
      !clause.endsWith('?') &&
      !QUESTION_LEAD.test(clause) &&
      CAT_WORD.test(clause) &&
      !NEGATION.test(clause) &&
      (FIRST_PERSON_OWNERSHIP.test(clause) || POSSESSIVE_CAT.test(clause));
  });
}

export function buildTurnCandidateRegistry(
  scene: SceneRegistry,
  playerMessage: string,
): TurnCandidateRegistry {
  const directCatClaim = isPositiveFirstPersonCatClaim(playerMessage);
  const actionIds = ['greet', 'ask_follow_up', 'end_conversation'].filter((id) => scene.actionIds.includes(id));
  if (canModelInferStructuredAction(playerMessage, 'ask_date') && scene.actionIds.includes('ask_date')) actionIds.push('ask_date');
  if (canModelInferStructuredAction(playerMessage, 'invite_home') && scene.actionIds.includes('invite_home')) actionIds.push('invite_home');
  return Object.freeze({
    actionIds,
    factIds: directCatClaim && scene.factIds.includes('protagonist_has_cat') ? ['protagonist_has_cat'] : [],
    interestIds: directCatClaim && scene.interestIds.includes('cats') ? ['cats'] : [],
    memorySubjectIds: directCatClaim && scene.memorySubjectIds.includes('protagonist_cat') ? ['protagonist_cat'] : [],
    unlockIds: directCatClaim && scene.unlockIds.includes('cats_common_interest') ? ['cats_common_interest'] : [],
  });
}
