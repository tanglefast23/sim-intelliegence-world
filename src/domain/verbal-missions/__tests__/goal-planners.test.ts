import { createInitialState } from '../../state/initial-state';
import { parseWorldState } from '../../state/schema';
import {
  LINDA_PURSE_MISSION_ID,
  PRIYA_ASSESSMENT_MISSION_ID,
  TOMAS_FERRY_MISSION_ID,
  openingMissionFor,
  planOfferVerbalMission,
  planRecordPlayerKnowledge,
  verbalMissionAuthority,
} from '../goal-planners';

describe('Verbal Mission goal planners', () => {
  test('opens each authored family with fixed authority and idempotent offers', () => {
    expect(openingMissionFor(TOMAS_FERRY_MISSION_ID)).toEqual(expect.objectContaining({
      npcId: 'tomas_reed', goalKind: 'disclose_fact', status: 'available',
    }));
    expect(openingMissionFor(LINDA_PURSE_MISSION_ID)).toEqual(expect.objectContaining({
      npcId: 'linda', goalKind: 'buy_object', status: 'available',
    }));
    expect(openingMissionFor(PRIYA_ASSESSMENT_MISSION_ID)).toEqual(expect.objectContaining({
      npcId: 'priya_nair', goalKind: 'schedule_cooperation', status: 'available',
    }));
    expect(verbalMissionAuthority(LINDA_PURSE_MISSION_ID).contract).toEqual(expect.objectContaining({
      objectId: 'linda_marchetti_purse', hardMinimumPrice: 80, successPriceExclusive: 100,
    }));

    const offered = planOfferVerbalMission(createInitialState(), TOMAS_FERRY_MISSION_ID);
    const repeated = planOfferVerbalMission(offered.state, TOMAS_FERRY_MISSION_ID);
    expect(repeated.changed).toBe(false);
    expect(repeated.state).toBe(offered.state);
  });

  test('enforces Linda and Priya availability from authoritative quest state', () => {
    const initial = createInitialState();
    expect(() => planOfferVerbalMission(initial, LINDA_PURSE_MISSION_ID)).toThrow('not available');
    expect(() => planOfferVerbalMission(initial, PRIYA_ASSESSMENT_MISSION_ID)).toThrow('not available');

    const resolved = parseWorldState({
      ...initial,
      quests: {
        ...initial.quests,
        linda_boyfriend_check: { id: 'linda_boyfriend_check', status: 'resolved', flagIds: [] },
      },
    });
    expect(planOfferVerbalMission(resolved, LINDA_PURSE_MISSION_ID).changed).toBe(true);

    const betrayed = parseWorldState({
      ...resolved,
      quests: {
        ...resolved.quests,
        linda_boyfriend_check: {
          id: 'linda_boyfriend_check', status: 'resolved', flagIds: ['linda_betrayed'],
        },
      },
    });
    expect(() => planOfferVerbalMission(betrayed, LINDA_PURSE_MISSION_ID)).toThrow('not available');

    const protectFailed = parseWorldState({
      ...resolved,
      quests: {
        ...resolved.quests,
        linda_boyfriend_check: {
          id: 'linda_boyfriend_check', status: 'failed', flagIds: ['linda_protect_failed'],
        },
      },
    });
    expect(planOfferVerbalMission(protectFailed, PRIYA_ASSESSMENT_MISSION_ID).changed).toBe(true);
  });

  test('keeps the first authoritative player knowledge provenance', () => {
    const first = planRecordPlayerKnowledge(createInitialState(), {
      factId: 'linda_purse_independence_story',
      assertedValue: true,
      epistemicState: 'observed_fact',
      truthStatus: 'verified',
      source: { type: 'authored_event', sourceId: 'linda_purse_story' },
    });
    const repeated = planRecordPlayerKnowledge(first.state, {
      factId: 'linda_purse_independence_story',
      assertedValue: false,
      epistemicState: 'held_belief',
      truthStatus: 'contradicted',
      source: { type: 'player_message', sourceId: 'forged_source' },
    });

    expect(repeated.changed).toBe(false);
    expect(repeated.state).toBe(first.state);
    expect(repeated.record).toEqual(first.record);
    expect(() => planRecordPlayerKnowledge(createInitialState(), {
      factId: 'unknown_fact', assertedValue: true, epistemicState: 'observed_fact',
      truthStatus: 'verified', source: { type: 'authored_event', sourceId: 'unknown_source' },
    })).toThrow('Unregistered player knowledge fact');
  });
});
