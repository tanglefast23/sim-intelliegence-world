import type { SceneRegistry } from './scene-registry';

export type TurnCandidateRegistry = Readonly<{
  factIds: readonly string[];
  interestIds: readonly string[];
  memorySubjectIds: readonly string[];
  unlockIds: readonly string[];
}>;

const CAT_WORD = /\b(?:cat|kitten)\b/iu;
const NEGATION = /\b(?:do not|don't|dont|never|no longer|not|no)\b/iu;
const FIRST_PERSON_OWNERSHIP = /\bi\s+(?:(?:also|actually|really)\s+)?(?:have|own)\s+(?:an?\s+)?[^.!?]{0,48}\b(?:cat|kitten)\b/iu;
const POSSESSIVE_CAT = /\bmy\s+(?:(?:little|old|new|pet|black|white|orange|named)\s+){0,2}(?:cat|kitten)\b/iu;

export function isPositiveFirstPersonCatClaim(source: string): boolean {
  return CAT_WORD.test(source) &&
    !NEGATION.test(source) &&
    !source.includes('?') &&
    (FIRST_PERSON_OWNERSHIP.test(source) || POSSESSIVE_CAT.test(source));
}

export function buildTurnCandidateRegistry(
  scene: SceneRegistry,
  playerMessage: string,
): TurnCandidateRegistry {
  const directCatClaim = isPositiveFirstPersonCatClaim(playerMessage);
  return Object.freeze({
    factIds: directCatClaim && scene.factIds.includes('protagonist_has_cat') ? ['protagonist_has_cat'] : [],
    interestIds: directCatClaim && scene.interestIds.includes('cats') ? ['cats'] : [],
    memorySubjectIds: directCatClaim && scene.memorySubjectIds.includes('protagonist_cat') ? ['protagonist_cat'] : [],
    unlockIds: directCatClaim && scene.unlockIds.includes('cats_common_interest') ? ['cats_common_interest'] : [],
  });
}
