import { createInitialState } from '../state/initial-state';
import { WorldStateSchema } from '../state/schema';

describe('world state schema', () => {
  test('the prototype fixture covers every authoritative state area', () => {
    const state = createInitialState();
    expect(WorldStateSchema.parse(state)).toEqual(state);
    expect(state.protagonist.id).toBe('protagonist');
    expect(Object.keys(state)).toEqual(expect.arrayContaining([
      'npcs', 'relationships', 'inventory', 'economy', 'factions', 'quests', 'journal',
      'invitations', 'maps', 'schedules', 'transfers', 'evidence', 'policeAttention', 'eventReceipts', 'eventLedger',
    ]));
  });

  test('record keys and cross-record NPC references must match', () => {
    const state = createInitialState();
    expect(() => WorldStateSchema.parse({
      ...state,
      relationships: {
        ...state.relationships,
        linda: { ...state.relationships.linda, npcId: 'missing_npc' },
      },
    })).toThrow('Relationship must reference its keyed NPC');
  });

  test('the engine version is a literal compatibility pin', () => {
    const state = createInitialState();
    expect(() => WorldStateSchema.parse({ ...state, engineVersion: 'wrong-engine' })).toThrow();
  });

  test('journal markers require exact location knowledge', () => {
    const state = createInitialState();
    expect(() => WorldStateSchema.parse({
      ...state,
      journal: {
        lead: {
          id: 'lead',
          questId: 'linda_boyfriend_check',
          summary: 'Look for Linda.',
          locationPrecision: 'vague',
          markerVisible: true,
          source: { type: 'npc_report', sourceId: 'report_linda' },
          resolutionState: 'open',
          outcomeReceipts: [],
        },
      },
    })).toThrow('A map marker requires an exact known location');
  });

  test('schedules require four to six ordered blocks', () => {
    const state = createInitialState();
    expect(() => WorldStateSchema.parse({
      ...state,
      schedules: {
        linda_daily: {
          ...state.schedules.linda_daily,
          blocks: [
            { ...state.schedules.linda_daily!.blocks[0]!, startMinuteOfDay: 100 },
            { ...state.schedules.linda_daily!.blocks[1]!, startMinuteOfDay: 90 },
            { ...state.schedules.linda_daily!.blocks[2]!, startMinuteOfDay: 200 },
            { ...state.schedules.linda_daily!.blocks[3]!, startMinuteOfDay: 300 },
          ],
        },
      },
    })).toThrow('strictly increasing times');
  });
});
