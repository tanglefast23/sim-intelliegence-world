import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { upsertJournalEntry } from '../quests/journal';
import { createInitialState } from '../state/initial-state';
import { migrateStateCopy } from '../state/migrations';
import { migrateV1ToV2 } from '../state/migrations/v1-to-v2';
import { migrateV2ToV3 } from '../state/migrations/v2-to-v3';
import { migrateV3ToV4 } from '../state/migrations/v3-to-v4';
import { migrateV4ToV5 } from '../state/migrations/v4-to-v5';
import { migrateV5ToV6 } from '../state/migrations/v5-to-v6';
import { WorldStateSchema } from '../state/schema';
import { VerbalMissionStateSchema } from '../verbal-missions/state';

const missionCommon = {
  missionId: 'mission_linda_purse',
  npcId: 'linda',
  status: 'available' as const,
  terminalResultId: null,
  concerns: [{ concernId: 'value', state: 'open' as const }],
  creditedMoves: [],
  firedAllergyIds: [],
  liabilityIds: [],
  patience: 5,
  consecutiveRepeatCount: 0,
  cooldownUntilMinute: null,
  roomState: 'open' as const,
};

const buyMission = {
  ...missionCommon,
  goalKind: 'buy_object' as const,
  terms: { objectId: 'linda_marchetti_purse', currentOffer: null },
};

describe('Verbal Mission save state', () => {
  test('initial state pins the qualified 4B model and owns the purse exactly once', () => {
    const state = createInitialState();
    expect(state.schemaVersion).toBe(7);
    expect(state.modelPin).toEqual({
      id: 'qwen3.5-4b',
      sourceRevision: '851bf6e806efd8d0a36b00ddf55e13ccb7b8cd0a',
      artifactSha256: '32c8ff2d0972cc26d4c1f99d6655c7e0d4814bae9c23093a9213e23fd36e3d14',
    });
    expect(state.worldObjects).toEqual({
      linda_marchetti_purse: { objectId: 'linda_marchetti_purse', ownerId: 'linda' },
    });
    expect(state.inventory.items.linda_marchetti_purse).toBeUndefined();
  });

  test('all three goal families parse only their own closed terms', () => {
    expect(VerbalMissionStateSchema.parse(buyMission).goalKind).toBe('buy_object');
    expect(VerbalMissionStateSchema.parse({
      ...missionCommon,
      missionId: 'mission_tomas_fact',
      npcId: 'tomas_reed',
      goalKind: 'disclose_fact',
      terms: { factId: 'fact_marina_log', recipientId: 'protagonist' },
    }).goalKind).toBe('disclose_fact');
    expect(VerbalMissionStateSchema.parse({
      ...missionCommon,
      missionId: 'mission_priya_help',
      npcId: 'priya_nair',
      goalKind: 'schedule_cooperation',
      terms: {
        actionId: 'protect', subjectNpcId: 'linda', locationId: 'linda_villa',
        proposedMinute: null, commitmentId: null,
      },
    }).goalKind).toBe('schedule_cooperation');
    expect(() => VerbalMissionStateSchema.parse({
      ...buyMission,
      terms: { ...buyMission.terms, factId: 'wrong_family' },
    })).toThrow();
  });

  test.each([
    ['concerns', { ...buyMission, concerns: [buyMission.concerns[0], buyMission.concerns[0]] }],
    ['credited moves', {
      ...buyMission,
      creditedMoves: [
        { leverId: 'fair_offer', concernId: 'value', supportFactIds: [], offerAmount: 80 },
        { leverId: 'fair_offer', concernId: 'value', supportFactIds: [], offerAmount: 80 },
      ],
    }],
    ['credited moves with reordered facts', {
      ...buyMission,
      creditedMoves: [
        { leverId: 'fair_offer', concernId: 'value', supportFactIds: ['fact_a', 'fact_b'], offerAmount: 80 },
        { leverId: 'fair_offer', concernId: 'value', supportFactIds: ['fact_b', 'fact_a'], offerAmount: 80 },
      ],
    }],
    ['fired allergies', { ...buyMission, firedAllergyIds: ['threat', 'threat'] }],
    ['liabilities', { ...buyMission, liabilityIds: ['insult', 'insult'] }],
  ])('rejects duplicate %s', (_label, candidate) => {
    expect(() => VerbalMissionStateSchema.parse(candidate)).toThrow('unique');
  });

  test('journal subjects validate and cannot change identity', () => {
    const state = WorldStateSchema.parse({
      ...createInitialState(),
      verbalMissions: { mission_linda_purse: buyMission },
      journal: {
        journal_linda_purse: {
          id: 'journal_linda_purse',
          subject: { kind: 'verbal_mission', missionId: 'mission_linda_purse' },
          summary: 'Ask Linda about her purse.',
          locationPrecision: 'none',
          markerVisible: false,
          source: { type: 'authored_event', sourceId: 'mission_offer' },
          resolutionState: 'open',
          outcomeReceipts: [],
        },
      },
    });
    expect(state.journal.journal_linda_purse?.subject).toEqual({
      kind: 'verbal_mission', missionId: 'mission_linda_purse',
    });
    expect(() => upsertJournalEntry(state.journal.journal_linda_purse, {
      ...state.journal.journal_linda_purse!,
      subject: { kind: 'quest', questId: 'linda_boyfriend_check' },
    })).toThrow('cannot change entry or subject identity');
  });

  test('new records fail closed on bad keys and references', () => {
    const state = createInitialState();
    expect(() => WorldStateSchema.parse({
      ...state,
      playerKnowledge: {
        wrong_key: {
          factId: 'fact_marina_log', assertedValue: true, epistemicState: 'observed_fact',
          truthStatus: 'verified', source: { type: 'authored_event', sourceId: 'test_event' },
        },
      },
    })).toThrow('Player knowledge key must match');
    expect(() => WorldStateSchema.parse({
      ...state,
      worldObjects: { wrong_key: state.worldObjects.linda_marchetti_purse },
    })).toThrow('World object must match');
    expect(() => WorldStateSchema.parse({
      ...state,
      verbalMissions: { wrong_key: buyMission },
    })).toThrow('Verbal Mission must match');
    expect(() => WorldStateSchema.parse({
      ...state,
      verbalMissions: {
        mission_linda_purse: { ...buyMission, terms: { objectId: 'missing_object', currentOffer: null } },
      },
    })).toThrow('Verbal Mission must match');
  });

  test('scheduled commitments must match their mission exactly', () => {
    const mission = {
      ...missionCommon,
      missionId: 'mission_priya_help',
      npcId: 'priya_nair',
      status: 'resolved' as const,
      terminalResultId: 'agreed_to_help',
      roomState: 'done' as const,
      goalKind: 'schedule_cooperation' as const,
      terms: {
        actionId: 'protect', subjectNpcId: 'linda', locationId: 'linda_villa',
        proposedMinute: 600, commitmentId: 'commitment_priya_help',
      },
    };
    const commitment = {
      commitmentId: 'commitment_priya_help', missionId: mission.missionId, npcId: mission.npcId,
      actionId: 'protect', targetId: 'linda', locationId: 'linda_villa', agreedMinute: 500,
      status: 'agreed' as const, scheduledMinute: 600,
    };
    const valid = WorldStateSchema.parse({
      ...createInitialState(),
      verbalMissions: { [mission.missionId]: mission },
      commitments: { [commitment.commitmentId]: commitment },
    });
    expect(valid.commitments.commitment_priya_help).toEqual(commitment);
    expect(() => WorldStateSchema.parse({
      ...valid,
      commitments: { commitment_priya_help: { ...commitment, targetId: 'generic_resident' } },
    })).toThrow('Commitment must match');
  });

  test('versions 1 through 6 migrate to stable version 7 copies', () => {
    const v1 = JSON.parse(readFileSync(resolve('tests/fixtures/saves/legacy-v1.json'), 'utf8')) as unknown;
    const v2 = migrateV1ToV2(v1, 'generation-v2');
    const v3 = migrateV2ToV3(v2, 'generation-v3');
    const v4 = migrateV3ToV4(v3, 'generation-v4');
    const v5 = migrateV4ToV5(v4, 'generation-v5');
    const v6 = migrateV5ToV6(v5, 'generation-v6');
    for (const [index, source] of [v1, v2, v3, v4, v5, v6].entries()) {
      const before = JSON.stringify(source);
      const migrated = migrateStateCopy(source, `generation-copy-v${index + 1}`);
      expect(migrated.schemaVersion).toBe(7);
      expect(JSON.stringify(source)).toBe(before);
      expect(WorldStateSchema.parse(JSON.parse(JSON.stringify(migrated)))).toEqual(migrated);
      expect(WorldStateSchema.parse(JSON.parse(JSON.stringify(migrated)))).toEqual(migrated);
    }
  });

  test('v6 journal entries become quest subjects and new records start empty', () => {
    const v1 = JSON.parse(readFileSync(resolve('tests/fixtures/saves/legacy-v1.json'), 'utf8')) as unknown;
    const v2 = migrateV1ToV2(v1, 'generation-journal-v2');
    const v3 = migrateV2ToV3(v2, 'generation-journal-v3');
    const v4 = migrateV3ToV4(v3, 'generation-journal-v4');
    const v5 = migrateV4ToV5(v4, 'generation-journal-v5');
    const v6 = migrateV5ToV6(v5, 'generation-journal-v6');
    const source = {
      ...v6,
      journal: {
        legacy_lead: {
          id: 'legacy_lead', questId: 'linda_boyfriend_check', summary: 'Old lead.',
          locationPrecision: 'none', markerVisible: false,
          source: { type: 'authored_event', sourceId: 'legacy_event' },
          resolutionState: 'open', outcomeReceipts: [],
        },
      },
    };
    const migrated = migrateStateCopy(source, 'generation-journal-v7');
    expect(migrated.journal.legacy_lead?.subject).toEqual({ kind: 'quest', questId: 'linda_boyfriend_check' });
    expect(migrated.playerKnowledge).toEqual({});
    expect(migrated.verbalMissions).toEqual({});
    expect(migrated.commitments).toEqual({});
  });
});
