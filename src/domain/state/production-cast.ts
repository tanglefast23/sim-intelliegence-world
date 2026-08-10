import type { WorldState } from './schema';

export const PRODUCTION_FULL_AI_CAST = [
  {
    id: 'mina_park', visualId: 'mina-park', displayName: 'Mina Park', role: 'spa manager',
    homeLocationId: 'mina_spa', businessDisplayName: 'Shoreglass Spa', factionIds: ['island_administration'], romantic: true,
    position: { x: 34, y: 12 }, interestId: 'wellness', memorySubjectId: 'protagonist_wellness',
    work: { mapId: 'northwest_residential', locationId: 'mina_spa', x: 34, y: 12 },
  },
  {
    id: 'rafael_cruz', visualId: 'rafael-cruz', displayName: 'Rafael Cruz', role: 'chef and cafe owner',
    homeLocationId: 'rafael_cafe', businessDisplayName: "Rafael's Cafe", factionIds: [], romantic: false,
    position: { x: 39, y: 15 }, interestId: 'cooking', memorySubjectId: 'protagonist_food',
    work: { mapId: 'southwest_commercial', locationId: 'rafael_cafe', x: 41, y: 34 },
  },
  {
    id: 'sora_tan', visualId: 'sora-tan', displayName: 'Sora Tan', role: 'boutique manager',
    homeLocationId: 'sora_boutique', businessDisplayName: "Sora's Boutique", factionIds: [], romantic: true,
    position: { x: 45, y: 20 }, interestId: 'fashion', memorySubjectId: 'protagonist_style',
    work: { mapId: 'southwest_commercial', locationId: 'sora_boutique', x: 20, y: 16 },
  },
  {
    id: 'devon_price', visualId: 'devon-price', displayName: 'Devon Price', role: 'bartender',
    homeLocationId: 'devon_bar', businessDisplayName: 'Low Lantern Bar', factionIds: ['velvet_tide'], romantic: false,
    position: { x: 50, y: 14 }, interestId: 'nightlife', memorySubjectId: 'protagonist_nightlife',
    work: { mapId: 'northeast_downtown', locationId: 'devon_bar', x: 20, y: 13 },
  },
  {
    id: 'priya_nair', visualId: 'priya-nair', displayName: 'Priya Nair', role: 'clinic doctor',
    homeLocationId: 'priya_clinic', businessDisplayName: 'Halcyra Clinic', factionIds: ['island_administration'], romantic: true,
    position: { x: 32, y: 26 }, interestId: 'medicine', memorySubjectId: 'protagonist_health',
    work: { mapId: 'southeast_docks', locationId: 'priya_clinic', x: 18, y: 15 },
  },
  {
    id: 'tomas_reed', visualId: 'tomas-reed', displayName: 'Tomas Reed', role: 'marina clerk',
    homeLocationId: 'tomas_marina', businessDisplayName: 'Public Marina Office', factionIds: ['island_administration'], romantic: false,
    position: { x: 43, y: 31 }, interestId: 'boating', memorySubjectId: 'protagonist_boating',
    work: { mapId: 'southeast_docks', locationId: 'tomas_marina', x: 42, y: 30 },
  },
  {
    id: 'elise_moreau', visualId: 'elise-moreau', displayName: 'Elise Moreau', role: 'local journalist',
    homeLocationId: 'elise_studio', businessDisplayName: 'Elise Moreau Studio', factionIds: [], romantic: true,
    position: { x: 52, y: 30 }, interestId: 'journalism', memorySubjectId: 'protagonist_story',
    work: { mapId: 'northeast_downtown', locationId: 'elise_studio', x: 46, y: 36 },
  },
] as const;

const AMBIENT_POSITIONS = [
  [30, 5], [36, 5], [42, 5], [48, 5], [54, 5], [60, 5],
  [30, 20], [36, 20], [42, 20], [48, 20], [54, 20], [60, 20],
  [30, 30], [36, 30], [42, 30], [48, 30], [54, 30], [60, 30],
  [28, 40], [34, 40], [40, 40], [46, 40], [52, 40], [58, 40],
] as const;

export const PRODUCTION_AMBIENT_RESIDENTS = AMBIENT_POSITIONS.map(([x, y], index) => {
  const number = String(index + 1).padStart(2, '0');
  return Object.freeze({
    id: `resident_${number}`,
    displayName: `Resident ${number}`,
    position: { x, y },
  });
});

type NpcState = WorldState['npcs'][string];
type RelationshipState = WorldState['relationships'][string];
type ScheduleState = WorldState['schedules'][string];

function blankNpc(
  id: string,
  tier: NpcState['tier'],
  position: Readonly<{ x: number; y: number }>,
  locationId = 'northwest_residential',
): NpcState {
  return {
    id,
    tier,
    presence: {
      kind: 'active_local', mapId: 'northwest_residential', locationId,
      tileX: position.x, tileY: position.y,
    },
    knowledge: [],
    unlockedInterestIds: [],
    unlockedIds: [],
    memories: [],
  };
}

export function createProductionNpcs(): Record<string, NpcState> {
  return Object.fromEntries([
    ...PRODUCTION_FULL_AI_CAST.map((character) => [
      character.id,
      blankNpc(character.id, 'full_ai', character.position),
    ] as const),
    ...PRODUCTION_AMBIENT_RESIDENTS.map((resident) => [
      resident.id,
      blankNpc(resident.id, 'ambient', resident.position),
    ] as const),
  ]);
}

export function createProductionRelationships(): Record<string, RelationshipState> {
  return Object.fromEntries(PRODUCTION_FULL_AI_CAST.map((character) => {
    const rejections = character.romantic ? [] : [{
      reasonId: 'not_romantically_compatible',
      kind: 'permanent_boundary' as const,
      sourceActionId: 'ask_date',
      resolved: false,
    }];
    return [character.id, {
      npcId: character.id,
      values: { familiarity: 0, trust: 0, attraction: 0 },
      stage: 'stranger' as const,
      rejections,
      compatibility: { social: true, romantic: character.romantic },
      policy: {
        romanticEligibleAtStart: false,
        hardBoundaries: [
          { id: 'no_aggressive_flirting', scope: 'romantic' as const, blockedActionIds: ['aggressive_flirt'] },
        ],
        stageRules: [{ stage: 'dating' as const, unavailable: !character.romantic, requiredFlagIds: [] }],
      },
    }] as const;
  }));
}

function residentSchedule(
  id: string,
  position: Readonly<{ x: number; y: number }>,
  _index: number,
): ScheduleState {
  return {
    id: `${id}_daily`,
    npcId: id,
    blocks: [
      { startMinuteOfDay: 0, locationId: 'northwest_residential', activityId: 'sleep', mapId: 'northwest_residential', tileX: position.x, tileY: position.y },
      { startMinuteOfDay: 480, locationId: 'northwest_residential', activityId: 'stroll', mapId: 'northwest_residential', tileX: position.x, tileY: position.y },
      { startMinuteOfDay: 720, locationId: 'northwest_residential', activityId: 'errands', mapId: 'northwest_residential', tileX: position.x, tileY: position.y },
      { startMinuteOfDay: 1_080, locationId: 'northwest_residential', activityId: 'socialize', mapId: 'northwest_residential', tileX: position.x, tileY: position.y },
    ],
  };
}

export function createProductionSchedules(): Record<string, ScheduleState> {
  const named = PRODUCTION_FULL_AI_CAST.map((character) => {
    return [character.id + '_daily', {
    id: character.id + '_daily',
    npcId: character.id,
    blocks: [
      { startMinuteOfDay: 0, locationId: 'northwest_residential', activityId: 'sleep', mapId: 'northwest_residential', tileX: character.position.x, tileY: character.position.y },
      { startMinuteOfDay: 480, locationId: 'northwest_residential', activityId: 'morning', mapId: 'northwest_residential', tileX: character.position.x, tileY: character.position.y },
      { startMinuteOfDay: 720, locationId: 'northwest_residential', activityId: 'meet_visitors', mapId: 'northwest_residential', tileX: character.position.x, tileY: character.position.y },
      { startMinuteOfDay: 1_080, locationId: 'northwest_residential', activityId: 'evening', mapId: 'northwest_residential', tileX: character.position.x, tileY: character.position.y },
    ],
  } satisfies ScheduleState] as const;
  });
  const ambient = PRODUCTION_AMBIENT_RESIDENTS.map((resident, index) => {
    const schedule = residentSchedule(resident.id, resident.position, index);
    return [schedule.id, schedule] as const;
  });
  return Object.fromEntries([...named, ...ambient]);
}

export const PRODUCTION_CAST_COUNTS = Object.freeze({
  fullAi: PRODUCTION_FULL_AI_CAST.length + 1,
  ambient: PRODUCTION_AMBIENT_RESIDENTS.length + 2,
  totalNpcs: PRODUCTION_FULL_AI_CAST.length + PRODUCTION_AMBIENT_RESIDENTS.length + 3,
});
