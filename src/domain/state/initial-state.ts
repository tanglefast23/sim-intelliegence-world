import { createPrng } from '../prng';
import { ENGINE_VERSION } from '../version';
import { PROTOTYPE_ECONOMY_POLICY } from '../economy/economy';
import {
  CONTENT_VERSION,
  MODEL_CONTRACT_VERSION,
  PROMPT_VERSION,
  STATE_SCHEMA_VERSION,
  parseWorldState,
  type WorldState,
} from './schema';

export function createInitialState(displayName = 'Player'): WorldState {
  const prng = createPrng(0x51_57_01);
  return parseWorldState({
    schemaVersion: STATE_SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    contentVersion: CONTENT_VERSION,
    promptVersion: PROMPT_VERSION,
    modelContractVersion: MODEL_CONTRACT_VERSION,
    modelPin: {
      id: 'qwen3.5-9b',
      sourceRevision: 'c202236235762e1c871ad0ccb60c8ee5ba337b9a',
      artifactSha256: '8a9256b233037ea081c2e606e49dba0851cd42e441800da8ee04597ae9798341',
    },
    generationId: 'generation-prototype-001',
    revision: 0,
    prng: prng.snapshot(),
    clock: {
      absoluteMinute: 8 * 60,
      subMinuteMilliseconds: 0,
      selectedSpeed: 1,
      pauseTokens: [],
    },
    protagonist: {
      id: 'protagonist',
      displayName,
      energy: 100,
      health: 100,
      confidence: 50,
      locationId: 'protagonist_villa',
      worldPosition: { mapId: 'northwest_residential', tileX: 18, tileY: 18 },
    },
    npcs: {
      linda: {
        id: 'linda',
        tier: 'full_ai',
        presence: {
          kind: 'active_local', mapId: 'northwest_residential', locationId: 'linda_villa', tileX: 23, tileY: 28,
        },
        scheduleGoal: {
          mapId: 'northwest_residential', locationId: 'northwest_residential', activityId: 'relax',
          tileX: 28, tileY: 30, scheduledMinute: 480,
        },
        knowledge: [],
        unlockedInterestIds: [],
        unlockedIds: [],
        memories: [],
      },
      generic_resident: {
        id: 'generic_resident',
        tier: 'ambient',
        presence: {
          kind: 'active_local', mapId: 'northwest_residential', locationId: 'northwest_residential', tileX: 29, tileY: 33,
        },
        scheduleGoal: {
          mapId: 'northwest_residential', locationId: 'northwest_residential', activityId: 'work',
          tileX: 36, tileY: 30, scheduledMinute: 480,
        },
        knowledge: [],
        unlockedInterestIds: [],
        unlockedIds: [],
        memories: [],
      },
    },
    relationships: {
      linda: {
        npcId: 'linda',
        values: { familiarity: 5, trust: 0, attraction: 0 },
        stage: 'stranger',
        rejections: [
          {
            reasonId: 'current_relationship', kind: 'changeable_circumstance', sourceActionId: 'ask_date',
            circumstanceFlagId: 'linda_relationship_resolved', resolved: false,
          },
          {
            reasonId: 'home_visit_not_safe', kind: 'changeable_circumstance', sourceActionId: 'invite_home',
            circumstanceFlagId: 'linda_relationship_resolved', resolved: false,
          },
        ],
        compatibility: { social: true, romantic: true },
        policy: {
          romanticEligibleAtStart: false,
          hardBoundaries: [
            { id: 'no_aggressive_flirting', scope: 'romantic', blockedActionIds: ['aggressive_flirt'] },
          ],
          stageRules: [
            { stage: 'dating', unavailable: false, requiredFlagIds: ['cats_common_interest'] },
          ],
        },
      },
      generic_resident: {
        npcId: 'generic_resident',
        values: { familiarity: 0, trust: 0, attraction: 0 },
        stage: 'stranger',
        rejections: [
          {
            reasonId: 'not_romantically_compatible', kind: 'permanent_boundary',
            sourceActionId: 'ask_date', resolved: false,
          },
        ],
        compatibility: { social: true, romantic: false },
        policy: { romanticEligibleAtStart: false, hardBoundaries: [], stageRules: [] },
      },
    },
    inventory: { money: PROTOTYPE_ECONOMY_POLICY.weeklyAllowance, items: {}, homeStorageItems: {} },
    economy: {
      weeklyAllowance: PROTOTYPE_ECONOMY_POLICY.weeklyAllowance,
      basicDailyCost: PROTOTYPE_ECONOMY_POLICY.basicDailyCost,
      nextAllowanceMinute: 7 * 1_440,
      nextBasicCostMinute: 1_440,
    },
    factions: {
      island_administration: { id: 'island_administration', standing: 0, revealed: true },
      velvet_tide: { id: 'velvet_tide', standing: 0, revealed: false },
    },
    quests: {
      linda_boyfriend_check: { id: 'linda_boyfriend_check', status: 'locked', flagIds: [] },
    },
    journal: {},
    invitations: {},
    maps: {
      northwest_residential: { id: 'northwest_residential', active: true, unlocked: true, discoveredEntranceIds: ['protagonist_villa'] },
      northeast_downtown: { id: 'northeast_downtown', active: false, unlocked: true, discoveredEntranceIds: [] },
      southwest_commercial: { id: 'southwest_commercial', active: false, unlocked: true, discoveredEntranceIds: [] },
      southeast_docks: { id: 'southeast_docks', active: false, unlocked: true, discoveredEntranceIds: ['ferry_terminal'] },
    },
    schedules: {
      linda_daily: {
        id: 'linda_daily',
        npcId: 'linda',
        blocks: [
          { startMinuteOfDay: 0, locationId: 'linda_villa', activityId: 'sleep', mapId: 'northwest_residential', tileX: 23, tileY: 28 },
          { startMinuteOfDay: 480, locationId: 'northwest_residential', activityId: 'relax', mapId: 'northwest_residential', tileX: 28, tileY: 30 },
          { startMinuteOfDay: 720, locationId: 'southwest_commercial', activityId: 'shop', mapId: 'southwest_commercial', tileX: 15, tileY: 16 },
          { startMinuteOfDay: 1_080, locationId: 'linda_villa', activityId: 'home', mapId: 'northwest_residential', tileX: 23, tileY: 28 },
        ],
      },
      generic_daily: {
        id: 'generic_daily',
        npcId: 'generic_resident',
        blocks: [
          { startMinuteOfDay: 0, locationId: 'northwest_residential', activityId: 'sleep', mapId: 'northwest_residential', tileX: 29, tileY: 33 },
          { startMinuteOfDay: 480, locationId: 'northwest_residential', activityId: 'work', mapId: 'northwest_residential', tileX: 36, tileY: 30 },
          { startMinuteOfDay: 720, locationId: 'northeast_downtown', activityId: 'meal', mapId: 'northeast_downtown', tileX: 44, tileY: 34 },
          { startMinuteOfDay: 1_080, locationId: 'northeast_downtown', activityId: 'nightlife', mapId: 'northeast_downtown', tileX: 18, tileY: 13 },
        ],
      },
    },
    transfers: {},
    evidence: {},
    policeAttention: 'none',
    eventReceipts: [],
    eventLedger: [],
  });
}
