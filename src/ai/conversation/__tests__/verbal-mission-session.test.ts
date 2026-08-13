import { RecordedInferencePort } from '../../../application/effects/InferencePort';
import { createInitialState } from '../../../domain/state/initial-state';
import { parseWorldState, type WorldState } from '../../../domain/state/schema';
import type { VerbalMissionDefinition } from '../../../domain/verbal-missions/contracts';
import { planOfferVerbalMission } from '../../../domain/verbal-missions/goal-planners';
import {
  openingMissionFor,
  PRIYA_ASSESSMENT_COMMITMENT_ID,
  PRIYA_ASSESSMENT_MISSION_ID,
} from '../../../domain/verbal-missions/goal-planners';
import type { VerbalMissionState } from '../../../domain/verbal-missions/state';
import { TEST_DEAL_DEFINITION, TEST_DEAL_DISPOSITION } from '../../../../tests/fixtures/verbal-missions/test-deal';
import { FileCharacterWritingStore } from '../../registry/file-writing-store';
import { buildVerbalMissionActorProjection } from '../../projection/prompt-projection';
import { ConversationService } from '../service';
import {
  confirmationFor,
  parseVerbalMissionExactTerms,
  type VerbalMissionContentStore,
  type VerbalMissionSessionContent,
} from '../verbal-mission-session';

const policyAllow = JSON.stringify({ decision: 'allow', category: 'allowed_fictional_adult' });

function productionDefinition(): VerbalMissionDefinition {
  if (TEST_DEAL_DEFINITION.goalContract.kind !== 'buy_object') throw new Error('Expected test deal contract.');
  const offerLevers = TEST_DEAL_DEFINITION.levers.filter(({ exactTerm }) => exactTerm?.kind === 'offer');
  return {
    ...TEST_DEAL_DEFINITION,
    missionId: 'linda_marchetti_purse_sale',
    concerns: [
      { concernId: 'purpose', summary: 'Linda needs a respectful purpose.', required: true, initialState: 'open' },
      { concernId: 'value', summary: 'The offer must be fair.', required: true, initialState: 'open' },
      { concernId: 'dignity', summary: 'The sale must respect Linda.', required: true, initialState: 'open' },
      { concernId: 'payment', summary: 'The payment must be exact.', required: true, initialState: 'open' },
    ],
    goalContract: {
      ...TEST_DEAL_DEFINITION.goalContract,
      missionId: 'linda_marchetti_purse_sale',
      objectId: 'linda_marchetti_purse',
      requiredConcernIds: ['purpose', 'value', 'dignity', 'payment'],
    },
    levers: [
      {
        ...TEST_DEAL_DEFINITION.levers[0]!, leverId: 'specific_purpose', concernId: 'purpose',
        fromStates: ['open'], toState: 'resolved',
        trigger: { ...TEST_DEAL_DEFINITION.levers[0]!.trigger, referentId: 'linda_marchetti_purse' },
      },
      {
        ...TEST_DEAL_DEFINITION.levers[0]!, leverId: 'respectful_context', concernId: 'dignity',
        fromStates: ['open'], toState: 'resolved', stableOrder: 2,
        trigger: { ...TEST_DEAL_DEFINITION.levers[0]!.trigger, referentId: 'linda_marchetti_purse' },
      },
      ...offerLevers.map((lever, index) => ({
        ...lever,
        stableOrder: index + 3,
        trigger: { ...lever.trigger, referentId: 'linda_marchetti_purse' },
      })),
    ],
  };
}

const definition = productionDefinition();
const content: VerbalMissionSessionContent = {
  definition,
  disposition: { ...TEST_DEAL_DISPOSITION, dispositionId: definition.dispositionId },
  referents: [{ id: 'linda_marchetti_purse', label: 'Linda purse', aliases: ['purse', 'bag'] }],
  facts: [
    { id: 'fact_appraisal', description: 'written appraisal', aliases: ['quote'] },
    { id: 'fact_cash_ready', description: 'cash ready' },
    { id: 'fact_market_comparison', description: 'market comparison' },
  ],
  readTheRoomLines: Object.fromEntries(definition.reactions.map(({ readTheRoomId, outcome }) => [
    readTheRoomId, `Linda shows ${outcome.replaceAll('_', ' ')}.`,
  ])),
  speakableFactTexts: {},
};

const contentStore: VerbalMissionContentStore = { get: async () => content };
const writing = new FileCharacterWritingStore(process.cwd() + '/content');

function missionState(): WorldState {
  const initial = createInitialState();
  const questReady = parseWorldState({
    ...initial,
    quests: {
      ...initial.quests,
      linda_boyfriend_check: { id: 'linda_boyfriend_check', status: 'resolved', flagIds: [] },
    },
  });
  const offered = planOfferVerbalMission(questReady, 'linda_marchetti_purse_sale').state;
  const mission = offered.verbalMissions.linda_marchetti_purse_sale!;
  const compatible: VerbalMissionState = {
    ...mission,
    concerns: definition.concerns.map(({ concernId, initialState }) => ({ concernId, state: initialState })),
    patience: content.disposition.patience,
  };
  return parseWorldState({
    ...offered,
    playerKnowledge: {
      fact_appraisal: {
        factId: 'fact_appraisal', assertedValue: true, epistemicState: 'observed_fact',
        truthStatus: 'verified', source: { type: 'scene_observation', sourceId: 'test_appraisal' },
      },
    },
    verbalMissions: { ...offered.verbalMissions, linda_marchetti_purse_sale: compatible },
  });
}

function move(source: Record<string, unknown>): string {
  return JSON.stringify(source);
}

const offer95 = move({
  acts: [{ act: 'offer', referentId: 'linda_marchetti_purse', evidenceText: '$95' }],
  register: 'blunt', claims: [], referenceConfidence: 'clear',
});
const appraisal = move({
  acts: [{ act: 'assert', referentId: 'linda_marchetti_purse', evidenceText: 'quote' }],
  register: 'plain',
  claims: [{ factId: 'fact_appraisal', polarity: 'assert', evidenceText: 'quote' }],
  referenceConfidence: 'clear',
});

async function begin(responses: readonly string[]) {
  const inference = new RecordedInferencePort(responses);
  const service = new ConversationService(inference, writing, undefined, contentStore);
  const started = await service.begin({
    conversationId: 'mission-conversation', npcId: 'linda', state: missionState(),
    sources: { sceneObservationIds: [], npcReportIds: [], authoredEventIds: [] },
  });
  return { inference, service, started };
}

describe('split Verbal Mission conversation session', () => {
  test('parses exact money and natural schedule terms before model interpretation', () => {
    expect(parseVerbalMissionExactTerms(
      'I can pay $95 now.',
      planOfferVerbalMission(missionState(), 'linda_marchetti_purse_sale').mission,
      480,
    )).toEqual(expect.objectContaining({
      exactOfferAmount: 95,
      action: expect.objectContaining({ act: 'offer', referentId: 'linda_marchetti_purse' }),
    }));
    expect(parseVerbalMissionExactTerms(
      'I heard the shop would only pay $85 for it.',
      planOfferVerbalMission(missionState(), 'linda_marchetti_purse_sale').mission,
      480,
    )).toEqual({ exactOfferAmount: 85, exactProposedMinute: null });
    const schedule = openingMissionFor(PRIYA_ASSESSMENT_MISSION_ID);
    expect(parseVerbalMissionExactTerms('Can you assess them at 10:00?', schedule, 480)).toEqual(
      expect.objectContaining({ exactProposedMinute: 600 }),
    );
    expect(parseVerbalMissionExactTerms('Can you assess them at 9am tomorrow?', schedule, 480)).toEqual(
      expect.objectContaining({ exactProposedMinute: 1_980 }),
    );
    expect(parseVerbalMissionExactTerms('Either 9am or 10am.', schedule, 480).exactProposedMinute).toBeNull();
    expect(parseVerbalMissionExactTerms('The appointment is at 9am.', schedule, 480)).toEqual({
      exactOfferAmount: null, exactProposedMinute: 540,
    });
  });

  test('does not offer Priya confirmation again after creating her commitment', () => {
    const mission = openingMissionFor(PRIYA_ASSESSMENT_MISSION_ID);
    if (mission.goalKind !== 'schedule_cooperation') throw new Error('Expected schedule mission.');
    expect(confirmationFor(content, {
      ...mission,
      terms: { ...mission.terms, proposedMinute: 600, commitmentId: PRIYA_ASSESSMENT_COMMITMENT_ID },
    }, true)).toBeNull();
  });

  test('Actor projection excludes private NPC state and biography', async () => {
    const character = await writing.get('linda');
    const state = missionState();
    const privateState = parseWorldState({
      ...state,
      npcs: {
        ...state.npcs,
        linda: {
          ...state.npcs.linda!,
          knowledge: [{
            factId: 'private_floor', assertedValue: 80, epistemicState: 'observed_fact',
            truthStatus: 'verified', source: { type: 'authored_event', sourceId: 'private_source' },
          }],
        },
      },
    });
    const prompt = buildVerbalMissionActorProjection({
      state: privateState,
      character: { ...character, biography: 'PRIVATE BIOGRAPHY DETAIL' },
      mission: privateState.verbalMissions.linda_marchetti_purse_sale!,
      playerMessage: 'Hello.',
      recentTurns: [],
      outcome: {
        outcome: 'small_talk', reactionId: 'reaction_small_talk',
        readTheRoomId: 'read_small_talk', concernTransitions: [], newlySpeakableFactIds: [],
      },
      speakableFactTexts: [],
    });
    expect(prompt).not.toContain('private_floor');
    expect(prompt).not.toContain('PRIVATE BIOGRAPHY DETAIL');
    expect(prompt).not.toContain('hardMinimumPrice');
  });

  test('Reader failure returns authored clarification with no mission change', async () => {
    const { service, started } = await begin(['{}', '{}']);
    expect(started).toEqual(expect.objectContaining({
      kind: 'active', verbalMission: expect.objectContaining({ status: 'available' }),
    }));
    const result = await service.readVerbalMissionTurn({
      conversationId: 'mission-conversation', turnId: 'reader-failure', message: 'Maybe the purse.',
    });
    expect(result.kind).toBe('clarify');
    const closed = service.abort('mission-conversation');
    expect(closed.verbalMissions.linda_marchetti_purse_sale?.status).toBe('available');
    expect(closed.revision).toBe(missionState().revision);
  });

  test('a decided turn stages once, rejects second input while pending, and Actor fallback preserves it', async () => {
    const wrongTerms = JSON.stringify({
      dialogue: 'I heard your $80 offer.', emotion: 'neutral', reactionId: 'reaction_progress',
    });
    const { service } = await begin([offer95, wrongTerms, wrongTerms]);
    const read = await service.readVerbalMissionTurn({
      conversationId: 'mission-conversation', turnId: 'offer-turn', message: 'I offer $95 for the purse.',
    });
    expect(read).toEqual(expect.objectContaining({ kind: 'decided', outcome: 'progress' }));
    await expect(service.readVerbalMissionTurn({
      conversationId: 'mission-conversation', turnId: 'second-turn', message: 'Another offer.',
    })).rejects.toThrow('Complete the pending');
    const complete = await service.completeVerbalMissionTurn({
      conversationId: 'mission-conversation', turnId: 'offer-turn',
    });
    expect(complete.source).toBe('authored-fallback');
    const repeatedComplete = await service.completeVerbalMissionTurn({
      conversationId: 'mission-conversation', turnId: 'offer-turn',
    });
    expect(repeatedComplete).toBe(complete);

    const committed = service.abort('mission-conversation');
    expect(committed.verbalMissions.linda_marchetti_purse_sale).toEqual(expect.objectContaining({
      status: 'active', terms: expect.objectContaining({ currentOffer: 95 }),
    }));
    expect(committed.relationships.linda?.values).toEqual(expect.objectContaining({ familiarity: 5 }));
    expect(committed.eventLedger.filter(({ type }) => type === 'relationship-stage-requested')).toHaveLength(0);
  });

  test('exact player terms override a Reader that misses the explicit offer', async () => {
    const missedOffer = move({
      acts: [{ act: 'other', referentId: null, evidenceText: 'I offer $95 for the purse.' }],
      register: 'plain', claims: [], referenceConfidence: 'clear',
    });
    const { service } = await begin([missedOffer]);
    const read = await service.readVerbalMissionTurn({
      conversationId: 'mission-conversation', turnId: 'exact-offer-turn',
      message: 'I offer $95 for the purse.',
    });
    expect(read).toEqual(expect.objectContaining({ kind: 'decided', outcome: 'progress' }));
    expect(service.abort('mission-conversation').verbalMissions.linda_marchetti_purse_sale).toEqual(
      expect.objectContaining({ status: 'active', terms: expect.objectContaining({ currentOffer: 95 }) }),
    );
  });

  test('later turns use preview state and duplicate read returns the same staged outcome', async () => {
    const actorProgress = JSON.stringify({
      dialogue: 'That quote is specific enough to consider.', emotion: 'neutral', reactionId: 'reaction_progress',
    });
    const actorReady = JSON.stringify({
      dialogue: 'I am ready for you to confirm that exact price.', emotion: 'warm', reactionId: 'reaction_ready',
    });
    const { service } = await begin([appraisal, actorProgress, policyAllow, offer95, actorReady, policyAllow]);
    const first = await service.readVerbalMissionTurn({
      conversationId: 'mission-conversation', turnId: 'appraisal-turn', message: 'The written quote values it fairly.',
    });
    const repeated = await service.readVerbalMissionTurn({
      conversationId: 'mission-conversation', turnId: 'appraisal-turn', message: 'The written quote values it fairly.',
    });
    expect(repeated).toBe(first);
    await service.completeVerbalMissionTurn({ conversationId: 'mission-conversation', turnId: 'appraisal-turn' });

    const second = await service.readVerbalMissionTurn({
      conversationId: 'mission-conversation', turnId: 'offer-turn', message: 'I offer $95 for the purse.',
    });
    expect(second).toEqual(expect.objectContaining({
      kind: 'decided', confirmation: expect.objectContaining({ confirmedAmount: 95 }),
    }));
    await service.completeVerbalMissionTurn({ conversationId: 'mission-conversation', turnId: 'offer-turn' });
    const closed = service.end('mission-conversation');
    expect(closed.verbalMissions.linda_marchetti_purse_sale).toEqual(expect.objectContaining({
      status: 'active', terms: expect.objectContaining({ currentOffer: 95 }),
    }));
  });

  test('confirmation commits staged progress before the atomic closer and later close returns settled state', async () => {
    const actorProgress = JSON.stringify({
      dialogue: 'That quote is specific enough to consider.', emotion: 'neutral', reactionId: 'reaction_progress',
    });
    const actorReady = JSON.stringify({
      dialogue: 'I am ready for you to confirm that exact price.', emotion: 'warm', reactionId: 'reaction_ready',
    });
    const { service } = await begin([appraisal, actorProgress, policyAllow, offer95, actorReady, policyAllow]);
    await service.readVerbalMissionTurn({
      conversationId: 'mission-conversation', turnId: 'appraisal-turn', message: 'The written quote values it fairly.',
    });
    await service.completeVerbalMissionTurn({ conversationId: 'mission-conversation', turnId: 'appraisal-turn' });
    await service.readVerbalMissionTurn({
      conversationId: 'mission-conversation', turnId: 'offer-turn', message: 'I offer $95 for the purse.',
    });
    await service.completeVerbalMissionTurn({ conversationId: 'mission-conversation', turnId: 'offer-turn' });

    const confirmed = service.confirmVerbalMissionGoal({
      conversationId: 'mission-conversation', goalKind: 'buy_object', confirmedAmount: 95,
    });
    expect(confirmed).toEqual(expect.objectContaining({
      kind: 'confirmed', resultId: 'linda_purse_sold', journalReceiptId: 'receipt_linda_purse_sold',
    }));
    if (confirmed.kind !== 'confirmed') throw new Error('Expected confirmed Linda purchase.');
    expect(confirmed.state.worldObjects.linda_marchetti_purse?.ownerId).toBe('protagonist');
    expect(confirmed.state.inventory.money).toBe(705);

    const duplicate = service.confirmVerbalMissionGoal({
      conversationId: 'mission-conversation', goalKind: 'buy_object', confirmedAmount: 95,
    });
    expect(duplicate).toBe(confirmed);
    expect(service.abort('mission-conversation')).toBe(confirmed.state);
  });

  test('closer failure keeps the already committed turn progress', async () => {
    const actor = JSON.stringify({
      dialogue: 'I heard your price.', emotion: 'neutral', reactionId: 'reaction_progress',
    });
    const { service } = await begin([offer95, actor, policyAllow]);
    await service.readVerbalMissionTurn({
      conversationId: 'mission-conversation', turnId: 'offer-turn', message: 'I offer $95 for the purse.',
    });
    await service.completeVerbalMissionTurn({ conversationId: 'mission-conversation', turnId: 'offer-turn' });
    const rejected = service.confirmVerbalMissionGoal({
      conversationId: 'mission-conversation', goalKind: 'buy_object', confirmedAmount: 95,
    });
    expect(rejected).toEqual(expect.objectContaining({ kind: 'rejected', reasonId: 'goal_confirmation_invalid' }));
    if (rejected.kind !== 'rejected') throw new Error('Expected rejected incomplete purchase.');
    expect(rejected.state.verbalMissions.linda_marchetti_purse_sale).toEqual(expect.objectContaining({
      status: 'active', terms: expect.objectContaining({ currentOffer: 95 }),
    }));
    expect(rejected.state.worldObjects.linda_marchetti_purse?.ownerId).toBe('linda');
    expect(service.end('mission-conversation')).toBe(rejected.state);
  });
});
