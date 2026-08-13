import type { VerbalMove } from '../../../ai/schemas/verbal-move';
import {
  createOpeningMission,
  isLegalConcernTransition,
  runOutcomeEngine,
  type OutcomeEngineContext,
} from '../outcome-engine';
import {
  TEST_DEAL_CONTEXT,
  TEST_DEAL_DEFINITION,
  TEST_DEAL_DISPOSITION,
} from '../../../../tests/fixtures/verbal-missions/test-deal';

const offerMove: VerbalMove = {
  acts: [{ act: 'offer', referentId: 'test_purse', evidenceText: '$95' }],
  register: 'blunt', claims: [], referenceConfidence: 'clear',
};

const appraisalMove: VerbalMove = {
  acts: [{ act: 'assert', referentId: 'test_purse', evidenceText: 'quote' }],
  register: 'plain',
  claims: [{ factId: 'fact_appraisal', polarity: 'assert', evidenceText: 'quote' }],
  referenceConfidence: 'clear',
};

function context(patch: Partial<OutcomeEngineContext> = {}): OutcomeEngineContext {
  return {
    ...TEST_DEAL_CONTEXT,
    exactOfferAmount: null,
    exactProposedMinute: null,
    ...patch,
  };
}

function run(
  mission = createOpeningMission(TEST_DEAL_DEFINITION, TEST_DEAL_DISPOSITION),
  move = appraisalMove,
  nextContext = context({ playerFactIds: ['fact_appraisal'] }),
) {
  return runOutcomeEngine({
    mission,
    definition: TEST_DEAL_DEFINITION,
    disposition: TEST_DEAL_DISPOSITION,
    move,
    context: nextContext,
  });
}

function readyMission() {
  const appraisal = run();
  return run(appraisal.mission, offerMove, context({ exactOfferAmount: 95 })).mission;
}

describe('pure Verbal Mission Outcome Engine', () => {
  test('allows only the authored concern transition table', () => {
    expect(isLegalConcernTransition('hidden', 'open')).toBe(true);
    expect(isLegalConcernTransition('open', 'eased')).toBe(true);
    expect(isLegalConcernTransition('open', 'resolved')).toBe(true);
    expect(isLegalConcernTransition('open', 'hardened')).toBe(true);
    expect(isLegalConcernTransition('eased', 'resolved')).toBe(true);
    expect(isLegalConcernTransition('eased', 'hardened')).toBe(true);
    expect(isLegalConcernTransition('hardened', 'open')).toBe(false);
    expect(isLegalConcernTransition('hardened', 'open', true)).toBe(true);
    for (const target of ['hidden', 'open', 'eased', 'resolved', 'hardened'] as const) {
      expect(isLegalConcernTransition('resolved', target)).toBe(false);
    }
    expect(isLegalConcernTransition('hidden', 'resolved')).toBe(false);
    expect(isLegalConcernTransition('open', 'hidden')).toBe(false);
  });

  test('runs an honest route and derives readiness without saving a ready status', () => {
    const appraisal = run();
    expect(appraisal.outcome).toBe('progress');
    expect(appraisal.mission.concerns.find(({ concernId }) => concernId === 'value')?.state).toBe('eased');
    expect(appraisal.canConfirm).toBe(false);

    const offer = run(appraisal.mission, offerMove, context({ exactOfferAmount: 95 }));
    expect(offer.outcome).toBe('ready');
    expect(offer.mission.status).toBe('available');
    expect(offer.mission.goalKind === 'buy_object' && offer.mission.terms.currentOffer).toBe(95);
    expect(offer.canConfirm).toBe(true);
    expect(offer.wouldSucceed).toBe(true);
  });

  test('a hard boundary cancels otherwise valid progress', () => {
    const result = run(undefined, {
      acts: [
        { act: 'threaten', referentId: 'test_purse', evidenceText: 'or else' },
        { act: 'assert', referentId: 'test_purse', evidenceText: 'quote' },
      ],
      register: 'threatening',
      claims: [{ factId: 'fact_appraisal', polarity: 'assert', evidenceText: 'quote' }],
      referenceConfidence: 'clear',
    });
    expect(result.outcome).toBe('walkout');
    expect(result.creditedMoves).toEqual([]);
    expect(result.mission.roomState).toBe('done');
  });

  test('a walkout blocks progress until its authored cooldown expires', () => {
    const walkedOut = run(undefined, {
      acts: [{ act: 'threaten', referentId: 'test_purse', evidenceText: 'or else' }],
      register: 'threatening', claims: [], referenceConfidence: 'clear',
    });
    const cooldownUntilMinute = TEST_DEAL_CONTEXT.absoluteMinute + 1_440;
    expect(walkedOut.mission.cooldownUntilMinute).toBe(cooldownUntilMinute);

    const blocked = run(walkedOut.mission, appraisalMove, context({
      absoluteMinute: cooldownUntilMinute - 1, playerFactIds: ['fact_appraisal'],
    }));
    expect(blocked.outcome).toBe('refused');
    expect(blocked.concernTransitions).toEqual([]);
    expect(blocked.mission).toEqual(walkedOut.mission);

    const reopened = run(walkedOut.mission, appraisalMove, context({
      absoluteMinute: cooldownUntilMinute, playerFactIds: ['fact_appraisal'],
    }));
    expect(reopened.outcome).toBe('progress');
    expect(reopened.mission.cooldownUntilMinute).toBeNull();
    expect(reopened.mission.roomState).toBe('open');
  });

  test('a known contradiction cancels otherwise valid progress', () => {
    const result = run(undefined, appraisalMove, context({
      playerFactIds: ['fact_appraisal'],
      contradictedFactIds: ['fact_appraisal'],
    }));
    expect(result.outcome).toBe('lie_detected');
    expect(result.concernTransitions).toEqual([]);
    expect(result.creditedMoves).toEqual([]);
  });

  test('an allergy fires before a recovery in the same move', () => {
    const backfire = run(undefined, {
      acts: [{ act: 'compliment', referentId: 'test_purse', evidenceText: 'perfect' }],
      register: 'flattering', claims: [], referenceConfidence: 'clear',
    }, context());
    expect(backfire.outcome).toBe('backfire');
    expect(backfire.mission.concerns.find(({ concernId }) => concernId === 'dignity')).toEqual({
      concernId: 'dignity', state: 'hardened', activeRecoveryId: 'plain_apology',
    });

    const stillBackfired = run(backfire.mission, {
      acts: [{ act: 'apologize', referentId: 'test_purse', evidenceText: 'sorry' }],
      register: 'flattering', claims: [], referenceConfidence: 'clear',
    }, context());
    expect(stillBackfired.outcome).toBe('backfire');
    expect(stillBackfired.concernTransitions).toEqual([]);

    const recovered = run(backfire.mission, {
      acts: [{ act: 'apologize', referentId: 'test_purse', evidenceText: 'sorry' }],
      register: 'plain', claims: [], referenceConfidence: 'clear',
    }, context());
    expect(recovered.concernTransitions).toContainEqual({
      concernId: 'dignity', from: 'hardened', to: 'open', reasonId: 'plain_apology',
    });
  });

  test('credits at most two valid levers in authored order, including two on one concern', () => {
    const result = run(undefined, {
      acts: [
        { act: 'assert', referentId: 'test_purse', evidenceText: 'quote' },
        { act: 'offer', referentId: 'test_purse', evidenceText: '$95' },
      ],
      register: 'plain',
      claims: [{ factId: 'fact_appraisal', polarity: 'assert', evidenceText: 'quote' }],
      referenceConfidence: 'clear',
    }, context({ playerFactIds: ['fact_appraisal'], exactOfferAmount: 95 }));
    expect(result.creditedMoves.map(({ leverId }) => leverId)).toEqual([
      'verified_appraisal', 'fair_immediate_value',
    ]);
    expect(result.mission.concerns.find(({ concernId }) => concernId === 'value')?.state).toBe('resolved');
    expect(result.mission.concerns.find(({ concernId }) => concernId === 'payment')?.state).toBe('open');
    expect(result.canConfirm).toBe(false);
  });

  test('an unaffordable offer blocks only offer-dependent levers', () => {
    const result = run(undefined, {
      acts: [
        { act: 'assert', referentId: 'test_purse', evidenceText: 'quote' },
        { act: 'offer', referentId: 'test_purse', evidenceText: '$95' },
      ],
      register: 'plain',
      claims: [{ factId: 'fact_appraisal', polarity: 'assert', evidenceText: 'quote' }],
      referenceConfidence: 'clear',
    }, context({ playerFactIds: ['fact_appraisal'], playerMoney: 50, exactOfferAmount: 95 }));
    expect(result.outcome).toBe('cannot_pay');
    expect(result.creditedMoves.map(({ leverId }) => leverId)).toEqual(['verified_appraisal']);
    expect(result.blockedLeverIds).toEqual(['exact_payment', 'fair_immediate_value']);
    expect(result.mission.goalKind === 'buy_object' && result.mission.terms.currentOffer).toBeNull();
  });

  test('repeating the same semantic credit grants no progress and cools the room', () => {
    const first = run();
    const repeated = run(first.mission);
    expect(repeated.outcome).toBe('repeat');
    expect(repeated.creditedMoves).toEqual([]);
    expect(repeated.concernTransitions).toEqual([]);
    expect(repeated.mission.consecutiveRepeatCount).toBe(1);
    const repeatedAgain = run(repeated.mission);
    expect(repeatedAgain.mission.roomState).toBe('cooling');
  });

  test('a lower credited offer reopens value and payment before earning readiness again', () => {
    const result = run(readyMission(), offerMove, context({ exactOfferAmount: 80 }));
    expect(result.concernTransitions).toEqual([
      { concernId: 'payment', from: 'resolved', to: 'open', reasonId: 'lower_offer_reopened' },
      { concernId: 'value', from: 'resolved', to: 'open', reasonId: 'lower_offer_reopened' },
      { concernId: 'value', from: 'open', to: 'resolved', reasonId: 'fair_immediate_value' },
      { concernId: 'payment', from: 'open', to: 'resolved', reasonId: 'exact_payment' },
    ]);
    expect(result.mission.goalKind === 'buy_object' && result.mission.terms.currentOffer).toBe(80);
    expect(result.canConfirm).toBe(true);
    expect(result.wouldSucceed).toBe(true);
  });

  test('an offer below the private floor refuses without changing the credited offer', () => {
    const mission = readyMission();
    const result = run(mission, offerMove, context({ exactOfferAmount: 79 }));
    expect(result.outcome).toBe('offer_too_low');
    expect(result.concernTransitions).toEqual([]);
    expect(result.mission.goalKind === 'buy_object' && result.mission.terms.currentOffer).toBe(95);
  });

  test('seeded replay stays byte-identical because the engine has no random success roll', () => {
    const input = {
      mission: createOpeningMission(TEST_DEAL_DEFINITION, TEST_DEAL_DISPOSITION),
      definition: TEST_DEAL_DEFINITION,
      disposition: TEST_DEAL_DISPOSITION,
      move: appraisalMove,
      context: context({ playerFactIds: ['fact_appraisal'] }),
    };
    const expected = JSON.stringify(runOutcomeEngine(input));
    for (let seed = 0; seed < 100; seed += 1) {
      expect(JSON.stringify(runOutcomeEngine(structuredClone(input)))).toBe(expected);
    }
  });
});
