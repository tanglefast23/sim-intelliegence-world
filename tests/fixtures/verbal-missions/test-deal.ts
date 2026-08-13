import type { VerbalMissionReferences } from '../../../src/content/registries/catalog';
import type { NpcDisposition, VerbalMissionDefinition } from '../../../src/content/schemas/verbal-mission';

const outcomes = [
  'clarify', 'small_talk', 'progress', 'repeat', 'backfire', 'lie_detected',
  'offer_too_low', 'cannot_pay', 'ready', 'refused', 'walkout',
] as const;

export const TEST_DEAL_DISPOSITION: NpcDisposition = {
  dispositionId: 'linda_deal_disposition',
  npcId: 'linda',
  protectedValueIds: ['dignity'],
  credibilitySignalIds: ['specific_evidence'],
  suspicionSignalIds: ['generic_flattery'],
  decisionStyle: 'practical',
  patience: 5,
  repetitionTolerance: 1,
  verificationMethodIds: ['written_quote'],
  hardBoundaries: [{
    boundaryId: 'no_threats',
    trigger: { actIds: ['threaten'] },
  }],
};

const reactions = outcomes.map((outcome) => ({
  reactionId: `reaction_${outcome}`,
  outcome,
  readTheRoomId: `read_${outcome}`,
  portraitId: outcome === 'ready' ? 'warm' as const
    : ['backfire', 'lie_detected', 'refused', 'walkout'].includes(outcome) ? 'guarded' as const
      : outcome === 'progress' ? 'considering' as const : 'neutral' as const,
  cueId: outcome === 'ready' ? 'consequence' as const
    : ['backfire', 'walkout'].includes(outcome) ? 'sigh' as const : null,
  actorFallback: `Authored ${outcome.replaceAll('_', ' ')} response.`,
}));

const defaultReactionIds = Object.fromEntries(outcomes.map((outcome) => [outcome, `reaction_${outcome}`])) as
  Record<(typeof outcomes)[number], string>;

const baseContext = {
  playerFactIds: [],
  npcFactIds: [],
  contradictedFactIds: [],
  playerMoney: 200,
  objectOwners: { test_purse: 'linda' },
  absoluteMinute: 500,
};

export const TEST_DEAL_DEFINITION: VerbalMissionDefinition = {
  schemaVersion: 1,
  missionId: 'test_purse_deal',
  npcId: 'linda',
  dispositionId: TEST_DEAL_DISPOSITION.dispositionId,
  concerns: [
    { concernId: 'value', summary: 'The offer must be fair.', required: true, initialState: 'open' },
    { concernId: 'payment', summary: 'The payment must be exact and available.', required: true, initialState: 'open' },
    { concernId: 'dignity', summary: 'The sale must respect Linda.', required: false, initialState: 'open' },
  ],
  levers: [
    {
      leverId: 'verified_appraisal', stableOrder: 1, concernId: 'value', honest: true, credits: true,
      trigger: { actIds: ['assert'], referentId: 'test_purse', claimFactIds: ['fact_appraisal'] },
      requiredPlayerFactIds: ['fact_appraisal'], requiredNpcFactIds: [], fromStates: ['open'], toState: 'eased',
      newlySpeakableFactIds: [], reactionId: 'reaction_progress',
    },
    {
      leverId: 'fair_immediate_value', stableOrder: 2, concernId: 'value', honest: true, credits: true,
      trigger: { actIds: ['offer'], referentId: 'test_purse', forbiddenRegisterIds: ['threatening'] },
      requiredPlayerFactIds: [], requiredNpcFactIds: [], fromStates: ['open', 'eased'], toState: 'resolved',
      exactTerm: { kind: 'offer', minimumAmount: 80, maximumAmount: null, requireAffordable: true },
      newlySpeakableFactIds: [], reactionId: 'reaction_progress',
    },
    {
      leverId: 'exact_payment', stableOrder: 3, concernId: 'payment', honest: true, credits: true,
      trigger: { actIds: ['offer'], referentId: 'test_purse' },
      requiredPlayerFactIds: [], requiredNpcFactIds: [], fromStates: ['open'], toState: 'resolved',
      exactTerm: { kind: 'offer', minimumAmount: 80, maximumAmount: null, requireAffordable: true },
      newlySpeakableFactIds: [], reactionId: 'reaction_progress',
    },
    {
      leverId: 'cash_proof', stableOrder: 4, concernId: 'payment', honest: true, credits: true,
      trigger: { actIds: ['trade'], referentId: 'test_purse', claimFactIds: ['fact_cash_ready'] },
      requiredPlayerFactIds: ['fact_cash_ready'], requiredNpcFactIds: [], fromStates: ['open'], toState: 'resolved',
      newlySpeakableFactIds: [], reactionId: 'reaction_progress',
    },
    {
      leverId: 'market_comparison', stableOrder: 5, concernId: 'value', honest: true, credits: true,
      trigger: { actIds: ['observe'], referentId: 'test_purse', claimFactIds: ['fact_market_comparison'] },
      requiredPlayerFactIds: ['fact_market_comparison'], requiredNpcFactIds: [], fromStates: ['open'], toState: 'resolved',
      newlySpeakableFactIds: [], reactionId: 'reaction_progress',
    },
  ],
  allergies: [{
    allergyId: 'generic_flattery', stableOrder: 1,
    trigger: { registerIds: ['flattering'] },
    severity: 'mild', concernId: 'dignity', recoveryIds: ['plain_apology'], patienceDelta: -1,
    reactionId: 'reaction_backfire',
  }],
  recoveries: [{
    recoveryId: 'plain_apology', stableOrder: 1, concernId: 'dignity',
    trigger: { actIds: ['apologize'], forbiddenRegisterIds: ['flattering'] },
    requiredPlayerFactIds: [], toState: 'open', sameConversation: true,
    reactionId: 'reaction_progress',
  }],
  reactions,
  defaultReactionIds,
  goalContract: {
    kind: 'buy_object', missionId: 'test_purse_deal', npcId: 'linda',
    requiredConcernIds: ['value', 'payment'], availableWhenId: 'test_available',
    confirmRuleId: 'test_confirm', successRuleId: 'test_success', closerActionId: 'buy_test_purse',
    objectId: 'test_purse', successPriceExclusive: 100, hardMinimumPrice: 80,
    commandType: 'purchase_unique_object',
  },
  honestRoute: {
    proofId: 'honest_appraisal_route',
    context: baseContext,
    steps: [
      {
        playerMessage: 'The written quote values it fairly.',
        move: {
          acts: [{ act: 'assert', referentId: 'test_purse', evidenceText: 'written quote' }],
          register: 'plain',
          claims: [{ factId: 'fact_appraisal', polarity: 'assert', evidenceText: 'quote' }],
          referenceConfidence: 'clear',
        },
        exactOfferAmount: null,
        exactProposedMinute: null,
        grantPlayerFactIds: ['fact_appraisal'],
      },
      {
        playerMessage: 'I can pay $95 now.',
        move: {
          acts: [{ act: 'offer', referentId: 'test_purse', evidenceText: '$95' }],
          register: 'blunt',
          claims: [],
          referenceConfidence: 'clear',
        },
        exactOfferAmount: 95,
        exactProposedMinute: null,
        grantPlayerFactIds: [],
      },
    ],
  },
  recoveryProofs: [{
    proofId: 'generic_flattery_recovery',
    allergyId: 'generic_flattery',
    recoveryId: 'plain_apology',
    context: baseContext,
    allergyStep: {
      playerMessage: 'You are perfect and amazing.',
      move: {
        acts: [{ act: 'compliment', referentId: 'test_purse', evidenceText: 'perfect' }],
        register: 'flattering', claims: [], referenceConfidence: 'clear',
      },
      exactOfferAmount: null, exactProposedMinute: null, grantPlayerFactIds: [],
    },
    recoveryStep: {
      playerMessage: 'Sorry. That sounded fake.',
      move: {
        acts: [{ act: 'apologize', referentId: 'test_purse', evidenceText: 'Sorry' }],
        register: 'plain', claims: [], referenceConfidence: 'clear',
      },
      exactOfferAmount: null, exactProposedMinute: null, grantPlayerFactIds: [],
    },
  }],
};

export const TEST_DEAL_REFERENCES: VerbalMissionReferences = {
  npcIds: new Set(['linda']),
  factIds: new Set(['fact_appraisal', 'fact_cash_ready', 'fact_market_comparison']),
  reachableFactIds: new Set(['fact_appraisal', 'fact_cash_ready', 'fact_market_comparison']),
  actionIds: new Set(['buy_test_purse']),
  locationIds: new Set(),
  objectIds: new Set(['test_purse']),
  referentIds: new Set(['test_purse']),
};

export { baseContext as TEST_DEAL_CONTEXT };
