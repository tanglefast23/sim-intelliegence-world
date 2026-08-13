import lindaCandidate from '../../../content/verbal-missions/linda-purse-deal.json';
import priyaCandidate from '../../../content/verbal-missions/priya-transport-assessment.json';
import tomasCandidate from '../../../content/verbal-missions/tomas-ferry-fact.json';
import { VerbalMoveSchema } from '../../ai/schemas/verbal-move';
import { reduceCommand } from '../../domain/commands/reducer';
import { DomainCommandSchema } from '../../domain/commands/types';
import { createInitialState } from '../../domain/state/initial-state';
import { parseWorldState } from '../../domain/state/schema';
import {
  LINDA_PURSE_MISSION_ID,
  PLAYER_KNOWLEDGE_AUTHORITIES,
  PRIYA_ASSESSMENT_COMMITMENT_ID,
  PRIYA_ASSESSMENT_MISSION_ID,
  TOMAS_FERRY_MISSION_ID,
  VERBAL_MISSION_AUTHORITIES,
  openingMissionFor,
  planOfferVerbalMission,
  planRecordPlayerKnowledge,
  planScheduledCommitment,
  verbalMissionAuthority,
} from '../../domain/verbal-missions/goal-planners';
import {
  createOpeningMission,
  goalReadiness,
  runOutcomeEngine,
} from '../../domain/verbal-missions/outcome-engine';
import {
  verbalMissionContextActions,
  verbalMissionDiscoveryRecord,
} from '../../domain/verbal-missions/discovery';
import { buildContentCatalog, buildVerbalMissionCatalog } from '../registries/catalog';
import {
  VERBAL_MISSION_OUTCOMES,
  type RouteContext,
  type RouteStep,
} from '../schemas/verbal-mission';
import {
  parseVerbalMissionContentFile,
  type VerbalMissionContentFile,
} from '../verbal-missions/catalog';
import { loadContentBundle } from '../../../scripts/content/validate-content';

const PRODUCTION_CONTENT = [tomasCandidate, lindaCandidate, priyaCandidate]
  .map(parseVerbalMissionContentFile);

function runTrace(
  content: VerbalMissionContentFile,
  steps: readonly RouteStep[] = content.definition.honestRoute.steps,
  startingContext: RouteContext = content.definition.honestRoute.context,
) {
  let mission = createOpeningMission(content.definition, content.disposition);
  let context = startingContext;
  for (const step of steps) {
    context = {
      ...context,
      playerFactIds: [...new Set([...context.playerFactIds, ...step.grantPlayerFactIds])],
    };
    mission = runOutcomeEngine({
      mission,
      definition: content.definition,
      disposition: content.disposition,
      move: step.move,
      context: {
        ...context,
        exactOfferAmount: step.exactOfferAmount,
        exactProposedMinute: step.exactProposedMinute,
      },
    }).mission;
  }
  return {
    mission,
    readiness: goalReadiness(mission, content.definition.goalContract, context),
  };
}

describe('production Verbal Missions', () => {
  test('all three production files share the engine and pass their complete honest traces', async () => {
    const bundle = await loadContentBundle(process.cwd());
    const baseCatalog = buildContentCatalog(bundle);
    const initialState = createInitialState();
    const catalog = buildVerbalMissionCatalog(
      PRODUCTION_CONTENT.map(({ disposition }) => disposition),
      PRODUCTION_CONTENT.map(({ definition }) => definition),
      {
        npcIds: new Set(baseCatalog.characters.map(({ id }) => id)),
        factIds: new Set(baseCatalog.registries.facts.items.map(({ id }) => id)),
        reachableFactIds: new Set(Object.keys(PLAYER_KNOWLEDGE_AUTHORITIES)),
        actionIds: new Set(baseCatalog.registries.actions.items.map(({ id }) => id)),
        locationIds: new Set(baseCatalog.locations.map(({ id }) => id)),
        objectIds: new Set(Object.keys(initialState.worldObjects)),
        referentIds: new Set(PRODUCTION_CONTENT.flatMap(({ referents }) => referents.map(({ id }) => id))),
      },
    );

    expect(catalog.missions.map(({ missionId }) => missionId)).toEqual([
      TOMAS_FERRY_MISSION_ID, LINDA_PURSE_MISSION_ID, PRIYA_ASSESSMENT_MISSION_ID,
    ]);
    expect(new Set(catalog.dispositions.map(({ decisionStyle }) => decisionStyle))).toEqual(
      new Set(['procedural', 'relational', 'evidence_first']),
    );
    for (const content of PRODUCTION_CONTENT) {
      expect(content.definition.goalContract).toEqual(
        VERBAL_MISSION_AUTHORITIES[content.definition.missionId]?.contract,
      );
      expect(createOpeningMission(content.definition, content.disposition)).toEqual(
        openingMissionFor(content.definition.missionId),
      );
      expect(runTrace(content).readiness).toEqual({ canConfirm: true, wouldSucceed: true });
      for (const { id } of content.facts) expect(PLAYER_KNOWLEDGE_AUTHORITIES[id]).toBeDefined();
      for (const outcome of VERBAL_MISSION_OUTCOMES) {
        const reactionId = content.definition.defaultReactionIds[outcome];
        const reaction = content.definition.reactions.find((candidate) => candidate.reactionId === reactionId);
        expect(reaction?.actorFallback.length).toBeGreaterThan(0);
        expect(content.readTheRoomLines[reaction!.readTheRoomId]?.length).toBeGreaterThan(0);
      }
    }

    const tomasContract = verbalMissionAuthority(TOMAS_FERRY_MISSION_ID).contract;
    const priyaContract = verbalMissionAuthority(PRIYA_ASSESSMENT_MISSION_ID).contract;
    expect('hardMinimumPrice' in tomasContract || 'successPriceExclusive' in tomasContract).toBe(false);
    expect('hardMinimumPrice' in priyaContract || 'successPriceExclusive' in priyaContract).toBe(false);
    expect(() => verbalMissionAuthority('convince_anyone_of_anything')).toThrow('Unsupported Verbal Mission');
  });

  test('Linda has a second honest route using inspection, formality, and an exact $90 offer', () => {
    const linda = PRODUCTION_CONTENT.find(({ definition }) => definition.missionId === LINDA_PURSE_MISSION_ID)!;
    const steps: RouteStep[] = [
      {
        playerMessage: 'Why does the purse matter to you?',
        move: VerbalMoveSchema.parse({
          acts: [{ act: 'ask', referentId: 'linda_marchetti_purse', evidenceText: 'purse matter' }],
          register: 'warm', claims: [], referenceConfidence: 'clear',
        }),
        exactOfferAmount: null, exactProposedMinute: null, grantPlayerFactIds: [],
      },
      {
        playerMessage: 'I would use the purse myself.',
        move: VerbalMoveSchema.parse({
          acts: [{ act: 'assert', referentId: 'linda_marchetti_purse', evidenceText: 'use the purse' }],
          register: 'plain', claims: [], referenceConfidence: 'clear',
        }),
        exactOfferAmount: null, exactProposedMinute: null, grantPlayerFactIds: [],
      },
      {
        playerMessage: 'I noticed the clasp is worn.',
        move: VerbalMoveSchema.parse({
          acts: [{ act: 'observe', referentId: 'linda_marchetti_purse', evidenceText: 'clasp is worn' }],
          register: 'plain',
          claims: [{ factId: 'linda_purse_worn_clasp', polarity: 'assert', evidenceText: 'clasp is worn' }],
          referenceConfidence: 'clear',
        }),
        exactOfferAmount: null, exactProposedMinute: null, grantPlayerFactIds: [],
      },
      {
        playerMessage: 'Let us make this a formal private sale.',
        move: VerbalMoveSchema.parse({
          acts: [{ act: 'assert', referentId: 'linda_marchetti_purse', evidenceText: 'formal private sale' }],
          register: 'formal', claims: [], referenceConfidence: 'clear',
        }),
        exactOfferAmount: null, exactProposedMinute: null, grantPlayerFactIds: [],
      },
      {
        playerMessage: 'I offer $90 for the purse.',
        move: VerbalMoveSchema.parse({
          acts: [{ act: 'offer', referentId: 'linda_marchetti_purse', evidenceText: '$90' }],
          register: 'plain', claims: [], referenceConfidence: 'clear',
        }),
        exactOfferAmount: 90, exactProposedMinute: null, grantPlayerFactIds: [],
      },
    ];
    const result = runTrace(linda, steps, {
      playerFactIds: ['linda_purse_worn_clasp'], npcFactIds: [], contradictedFactIds: [],
      playerMoney: 800, objectOwners: { linda_marchetti_purse: 'linda' }, absoluteMinute: 720,
    });

    expect(result.readiness).toEqual({ canConfirm: true, wouldSucceed: true });
    expect(result.mission).toEqual(expect.objectContaining({
      goalKind: 'buy_object', terms: { objectId: 'linda_marchetti_purse', currentOffer: 90 },
    }));
  });

  test('alternate term levers stay completable and Linda can reach the authored $100 failure', () => {
    const linda = PRODUCTION_CONTENT.find(({ definition }) => definition.missionId === LINDA_PURSE_MISSION_ID)!;
    const cashReady: RouteStep = {
      playerMessage: 'I have the exact cash ready for the trade.',
      move: VerbalMoveSchema.parse({
        acts: [{ act: 'trade', referentId: 'linda_marchetti_purse', evidenceText: 'cash ready' }],
        register: 'plain',
        claims: [{ factId: 'linda_cash_payment_ready', polarity: 'assert', evidenceText: 'cash ready' }],
        referenceConfidence: 'clear',
      }),
      exactOfferAmount: null, exactProposedMinute: null, grantPlayerFactIds: [],
    };
    const offer100: RouteStep = {
      playerMessage: 'I offer $100 for the purse.',
      move: VerbalMoveSchema.parse({
        acts: [{ act: 'offer', referentId: 'linda_marchetti_purse', evidenceText: '$100' }],
        register: 'plain', claims: [], referenceConfidence: 'clear',
      }),
      exactOfferAmount: 100, exactProposedMinute: null, grantPlayerFactIds: [],
    };
    const lindaResult = runTrace(
      linda,
      [...linda.definition.honestRoute.steps.slice(0, -1), cashReady, offer100],
      {
        ...linda.definition.honestRoute.context,
        playerFactIds: [...linda.definition.honestRoute.context.playerFactIds, 'linda_cash_payment_ready'],
      },
    );
    expect(lindaResult.readiness).toEqual({ canConfirm: true, wouldSucceed: false });
    expect(lindaResult.mission).toEqual(expect.objectContaining({
      terms: { objectId: 'linda_marchetti_purse', currentOffer: 100 },
    }));

    const priya = PRODUCTION_CONTENT.find(({ definition }) => definition.missionId === PRIYA_ASSESSMENT_MISSION_ID)!;
    const askWindow: RouteStep = {
      playerMessage: 'What is the formal clinic window for this assessment?',
      move: VerbalMoveSchema.parse({
        acts: [{ act: 'ask', referentId: 'assess_off_island_transport', evidenceText: 'clinic window' }],
        register: 'formal', claims: [], referenceConfidence: 'clear',
      }),
      exactOfferAmount: null, exactProposedMinute: null, grantPlayerFactIds: [],
    };
    const priyaResult = runTrace(priya, [
      ...priya.definition.honestRoute.steps.slice(0, -1),
      askWindow,
      priya.definition.honestRoute.steps.at(-1)!,
    ]);
    expect(priyaResult.readiness).toEqual({ canConfirm: true, wouldSucceed: true });
    expect(priyaResult.mission).toEqual(expect.objectContaining({
      terms: expect.objectContaining({ proposedMinute: 1980 }),
    }));
  });

  test('world transitions offer Tomas, while context actions reveal Linda and Priya facts once', () => {
    const initial = createInitialState();
    expect(initial.verbalMissions).toEqual({});
    const transitioned = reduceCommand(initial, DomainCommandSchema.parse({
      type: 'transition-protagonist', commandId: 'command-test-enter-docks', eventId: 'event-test-enter-docks',
      scheduledMinute: initial.clock.absoluteMinute, priority: 50,
      originMapId: 'northwest_residential', destinationMapId: 'southeast_docks',
      sourcePortalId: 'test-source-portal', destinationEntranceId: 'test-dock-entrance', tileX: 1, tileY: 1,
    }));
    expect(transitioned.state.verbalMissions[TOMAS_FERRY_MISSION_ID]).toBeDefined();
    expect(transitioned.state.eventLedger.filter(({ type }) => type === 'verbal-mission-offered')).toHaveLength(1);

    const lindaEligible = parseWorldState({
      ...initial,
      quests: {
        ...initial.quests,
        linda_boyfriend_check: { id: 'linda_boyfriend_check', status: 'resolved', flagIds: [] },
      },
    });
    const lindaOffered = planOfferVerbalMission(lindaEligible, LINDA_PURSE_MISSION_ID).state;
    expect(verbalMissionContextActions(lindaOffered, 'sora_tan')).toEqual([
      expect.objectContaining({ id: 'appraise_linda_purse', enabled: true }),
    ]);
    const appraisal = verbalMissionDiscoveryRecord(lindaOffered, 'appraise_linda_purse');
    const appraisalRecorded = planRecordPlayerKnowledge(lindaOffered, appraisal).state;
    expect(appraisal.factId).toBe('linda_quick_consignment_net');
    expect(verbalMissionContextActions(appraisalRecorded, 'sora_tan')).toEqual([]);

    const priyaEligible = parseWorldState({
      ...initial,
      quests: {
        ...initial.quests,
        linda_boyfriend_check: {
          id: 'linda_boyfriend_check', status: 'failed', flagIds: ['linda_protect_failed'],
        },
      },
      npcs: {
        ...initial.npcs,
        linda_boyfriend: { ...initial.npcs.linda_boyfriend, condition: 'injured' },
      },
    });
    const priyaOffered = planOfferVerbalMission(priyaEligible, PRIYA_ASSESSMENT_MISSION_ID).state;
    expect(verbalMissionContextActions(priyaOffered, 'linda_boyfriend')).toEqual([
      expect.objectContaining({ id: 'record_patient_consent', enabled: true }),
    ]);
  });

  test('Priya conversation creates an agreement, not the later assessment result', () => {
    const priya = PRODUCTION_CONTENT.find(({ definition }) => definition.missionId === PRIYA_ASSESSMENT_MISSION_ID)!;
    const traced = runTrace(priya);
    const initial = createInitialState();
    const eligible = parseWorldState({
      ...initial,
      quests: {
        ...initial.quests,
        linda_boyfriend_check: {
          id: 'linda_boyfriend_check', status: 'failed', flagIds: ['linda_protect_failed'],
        },
      },
      npcs: {
        ...initial.npcs,
        linda_boyfriend: { ...initial.npcs.linda_boyfriend, condition: 'injured' },
      },
    });
    const offered = planOfferVerbalMission(eligible, PRIYA_ASSESSMENT_MISSION_ID).state;
    const ready = parseWorldState({
      ...offered,
      verbalMissions: {
        ...offered.verbalMissions,
        [PRIYA_ASSESSMENT_MISSION_ID]: { ...traced.mission, status: 'active' },
      },
    });
    const agreement = planScheduledCommitment(
      ready, PRIYA_ASSESSMENT_MISSION_ID, PRIYA_ASSESSMENT_COMMITMENT_ID, 1980,
    );

    expect(agreement.commitment.status).toBe('agreed');
    expect(agreement.state.npcs.linda_boyfriend?.condition).toBe('injured');
    expect(agreement.state.verbalMissions[PRIYA_ASSESSMENT_MISSION_ID]).toEqual(expect.objectContaining({
      status: 'active', terminalResultId: null,
    }));
  });
});
