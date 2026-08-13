import { buildVerbalMissionCatalog } from '../registries/catalog';
import {
  TEST_DEAL_DEFINITION,
  TEST_DEAL_DISPOSITION,
  TEST_DEAL_REFERENCES,
} from '../../../tests/fixtures/verbal-missions/test-deal';

function missionCopy(): Record<string, any> {
  return structuredClone(TEST_DEAL_DEFINITION) as Record<string, any>;
}

describe('Verbal Mission content validation', () => {
  test('accepts a closed mission with an honest route and every recovery proof', () => {
    const catalog = buildVerbalMissionCatalog(
      [TEST_DEAL_DISPOSITION], [TEST_DEAL_DEFINITION], TEST_DEAL_REFERENCES,
    );
    expect(catalog.missions).toEqual([TEST_DEAL_DEFINITION]);
  });

  test('rejects unknown fields and invalid stable IDs', () => {
    expect(() => buildVerbalMissionCatalog(
      [TEST_DEAL_DISPOSITION], [{ ...TEST_DEAL_DEFINITION, magicScore: 10 }], TEST_DEAL_REFERENCES,
    )).toThrow();
    expect(() => buildVerbalMissionCatalog(
      [TEST_DEAL_DISPOSITION], [{ ...TEST_DEAL_DEFINITION, missionId: 'Bad ID' }], TEST_DEAL_REFERENCES,
    )).toThrow();
  });

  test('rejects illegal concern transitions', () => {
    const mission = missionCopy();
    mission.levers[0].fromStates = ['resolved'];
    expect(() => buildVerbalMissionCatalog(
      [TEST_DEAL_DISPOSITION], [mission], TEST_DEAL_REFERENCES,
    )).toThrow('illegal resolved -> eased');
  });

  test('rejects unknown and unreachable source facts', () => {
    const unknown = missionCopy();
    unknown.levers[0].requiredPlayerFactIds = ['missing_fact'];
    expect(() => buildVerbalMissionCatalog(
      [TEST_DEAL_DISPOSITION], [unknown], TEST_DEAL_REFERENCES,
    )).toThrow('Unknown test_purse_deal fact reference: missing_fact');

    const unreachable = { ...TEST_DEAL_REFERENCES, reachableFactIds: new Set<string>() };
    expect(() => buildVerbalMissionCatalog(
      [TEST_DEAL_DISPOSITION], [TEST_DEAL_DEFINITION], unreachable,
    )).toThrow('Unknown test_purse_deal honest route fact reference');
  });

  test('keeps commerce fields out of other goal families', () => {
    const mission = missionCopy();
    mission.goalContract = {
      kind: 'disclose_fact', missionId: mission.missionId, npcId: mission.npcId,
      requiredConcernIds: ['value', 'payment'], availableWhenId: 'available',
      confirmRuleId: 'confirm', successRuleId: 'success', closerActionId: 'buy_test_purse',
      factId: 'fact_appraisal', recipientId: 'protagonist', commandType: 'record_fact_disclosure',
    };
    expect(() => buildVerbalMissionCatalog(
      [TEST_DEAL_DISPOSITION], [mission], TEST_DEAL_REFERENCES,
    )).toThrow('non-commerce mission cannot use offer terms');
  });

  test('requires two distinct credited levers for each required concern', () => {
    const mission = missionCopy();
    mission.levers = mission.levers.filter(({ leverId }: { leverId: string }) => leverId !== 'cash_proof');
    expect(() => buildVerbalMissionCatalog(
      [TEST_DEAL_DISPOSITION], [mission], TEST_DEAL_REFERENCES,
    )).toThrow('required concern payment needs two credited levers');
  });

  test('requires exact terms to remain reachable through a required concern', () => {
    const mission = missionCopy();
    mission.levers.find(({ leverId }: { leverId: string }) => leverId === 'cash_proof').toState = 'resolved';
    expect(() => buildVerbalMissionCatalog(
      [TEST_DEAL_DISPOSITION], [mission], TEST_DEAL_REFERENCES,
    )).toThrow('exact terms must guard a required concern');
  });

  test('requires a matching authored fallback for every outcome', () => {
    const mission = missionCopy();
    mission.defaultReactionIds.ready = 'reaction_progress';
    expect(() => buildVerbalMissionCatalog(
      [TEST_DEAL_DISPOSITION], [mission], TEST_DEAL_REFERENCES,
    )).toThrow('lacks a valid default ready reaction');
  });

  test('requires every claimed mild-allergy recovery proof', () => {
    const mission = missionCopy();
    mission.recoveryProofs = [];
    expect(() => buildVerbalMissionCatalog(
      [TEST_DEAL_DISPOSITION], [mission], TEST_DEAL_REFERENCES,
    )).toThrow('lacks recovery proof');
  });

  test('rejects an honest route that never reaches separate confirmation', () => {
    const mission = missionCopy();
    mission.honestRoute.steps = mission.honestRoute.steps.slice(0, 1);
    expect(() => buildVerbalMissionCatalog(
      [TEST_DEAL_DISPOSITION], [mission], TEST_DEAL_REFERENCES,
    )).toThrow('honest route does not reach successful confirmation');
  });

  test('validates route evidence against the exact authored player message', () => {
    const mission = missionCopy();
    mission.honestRoute.steps[0].move.claims[0].evidenceText = 'not in the message';
    expect(() => buildVerbalMissionCatalog(
      [TEST_DEAL_DISPOSITION], [mission], TEST_DEAL_REFERENCES,
    )).toThrow('exact player-message substring');
  });
});
