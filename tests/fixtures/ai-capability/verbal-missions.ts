import type { VerbalMove } from '../../../src/ai/schemas/verbal-move';

export type VerbalMissionSpikeFixture = Readonly<{
  id: string;
  playerMessage: string;
  expected: Readonly<{
    acts: readonly VerbalMove['acts'][number]['act'][];
    referentId: string | null;
    register: VerbalMove['register'];
    claimFactId?: string;
    confidence: VerbalMove['referenceConfidence'];
  }>;
}>;

export const VERBAL_MISSION_SPIKE_REFERENTS = Object.freeze([
  { id: 'linda_marchetti_purse', label: "Linda's black designer purse", aliases: ['purse', 'bag', 'Marchetti'] },
  { id: 'linda_bakery_deposit', label: "Linda's bakery deposit", aliases: ['deposit', 'bakery money'] },
]);

export const VERBAL_MISSION_SPIKE_FACTS = Object.freeze([
  { id: 'linda_quick_consignment_net', description: 'a quick consignment would net about $85 after fees' },
  { id: 'linda_purse_worn_clasp', description: 'the purse clasp is worn' },
]);

export const VERBAL_MISSION_SPIKE_CASES: readonly VerbalMissionSpikeFixture[] = Object.freeze([
  { id: 'ask_purse', playerMessage: 'Would you ever sell the purse?', expected: { acts: ['ask'], referentId: 'linda_marchetti_purse', register: 'plain', confidence: 'clear' } },
  { id: 'ask_bag', playerMessage: 'Is the bag for sale?', expected: { acts: ['ask'], referentId: 'linda_marchetti_purse', register: 'plain', confidence: 'clear' } },
  { id: 'observe_clasp', playerMessage: 'I noticed the clasp is worn.', expected: { acts: ['observe', 'assert'], referentId: 'linda_marchetti_purse', register: 'plain', claimFactId: 'linda_purse_worn_clasp', confidence: 'clear' } },
  { id: 'assert_appraisal', playerMessage: 'The consignment shop said you would net about $85 after fees.', expected: { acts: ['assert'], referentId: 'linda_marchetti_purse', register: 'plain', claimFactId: 'linda_quick_consignment_net', confidence: 'clear' } },
  { id: 'warm_empathy', playerMessage: 'I understand why that purse means something to you.', expected: { acts: ['empathize'], referentId: 'linda_marchetti_purse', register: 'warm', confidence: 'clear' } },
  { id: 'compliment', playerMessage: 'That bag has excellent taste written all over it.', expected: { acts: ['compliment'], referentId: 'linda_marchetti_purse', register: 'flattering', confidence: 'clear' } },
  { id: 'offer_95', playerMessage: 'I can offer $95 for the purse.', expected: { acts: ['offer'], referentId: 'linda_marchetti_purse', register: 'plain', confidence: 'clear' } },
  { id: 'offer_blunt', playerMessage: '$90. Cash. For the bag.', expected: { acts: ['offer'], referentId: 'linda_marchetti_purse', register: 'blunt', confidence: 'clear' } },
  { id: 'trade', playerMessage: 'Could I trade my watch for the purse?', expected: { acts: ['trade'], referentId: 'linda_marchetti_purse', register: 'plain', confidence: 'clear' } },
  { id: 'apology', playerMessage: 'I am sorry I mocked your bag.', expected: { acts: ['apologize'], referentId: 'linda_marchetti_purse', register: 'plain', confidence: 'clear' } },
  { id: 'joke', playerMessage: 'Would the purse accept shared custody?', expected: { acts: ['joke'], referentId: 'linda_marchetti_purse', register: 'playful', confidence: 'clear' } },
  { id: 'threat', playerMessage: 'Sell me the purse or I will make you regret it.', expected: { acts: ['threaten'], referentId: 'linda_marchetti_purse', register: 'threatening', confidence: 'clear' } },
  { id: 'withdraw', playerMessage: 'Forget it. I am walking away from the deal.', expected: { acts: ['withdraw'], referentId: null, register: 'blunt', confidence: 'clear' } },
  { id: 'ask_deposit', playerMessage: 'When is the bakery deposit due?', expected: { acts: ['ask'], referentId: 'linda_bakery_deposit', register: 'plain', confidence: 'clear' } },
  { id: 'ambiguous_it', playerMessage: 'What about it?', expected: { acts: ['ask'], referentId: null, register: 'plain', confidence: 'ambiguous' } },
  { id: 'other_greeting', playerMessage: 'Hello Linda.', expected: { acts: ['other'], referentId: null, register: 'plain', confidence: 'clear' } },
]);

export function verbalMissionSpikeFixtureMatches(move: VerbalMove, fixture: VerbalMissionSpikeFixture): boolean {
  const actualActs = new Set(move.acts.map(({ act }) => act));
  const expectedReferent = fixture.expected.referentId;
  return fixture.expected.acts.some((act) => actualActs.has(act))
    && move.acts.some(({ referentId }) => referentId === expectedReferent)
    && move.register === fixture.expected.register
    && move.referenceConfidence === fixture.expected.confidence
    && (fixture.expected.claimFactId === undefined
      || move.claims.some(({ factId }) => factId === fixture.expected.claimFactId));
}
