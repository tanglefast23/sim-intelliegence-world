import type { WorldState } from './schema';
import { GENERATED_LAYOUT } from './generated-layout';

export const PRODUCTION_FULL_AI_CAST = [
  {
    id: 'mina_park', visualId: 'mina-park', displayName: 'Mina Park', role: 'spa manager',
    homeLocationId: 'mina_spa', businessDisplayName: 'Shoreglass Spa', factionIds: ['island_administration'], romantic: true,
    position: GENERATED_LAYOUT.actorTiles.mina_park, interestId: 'wellness', memorySubjectId: 'protagonist_wellness',
    work: GENERATED_LAYOUT.workTiles.mina_park,
  },
  {
    id: 'rafael_cruz', visualId: 'rafael-cruz', displayName: 'Rafael Cruz', role: 'chef and cafe owner',
    homeLocationId: 'rafael_cafe', businessDisplayName: "Rafael's Cafe", factionIds: [], romantic: false,
    position: GENERATED_LAYOUT.actorTiles.rafael_cruz, interestId: 'cooking', memorySubjectId: 'protagonist_food',
    work: GENERATED_LAYOUT.workTiles.rafael_cruz,
  },
  {
    id: 'sora_tan', visualId: 'sora-tan', displayName: 'Sora Tan', role: 'boutique manager',
    homeLocationId: 'sora_boutique', businessDisplayName: "Sora's Boutique", factionIds: [], romantic: true,
    position: GENERATED_LAYOUT.actorTiles.sora_tan, interestId: 'fashion', memorySubjectId: 'protagonist_style',
    work: GENERATED_LAYOUT.workTiles.sora_tan,
  },
  {
    id: 'devon_price', visualId: 'devon-price', displayName: 'Devon Price', role: 'bartender',
    homeLocationId: 'devon_bar', businessDisplayName: 'Low Lantern Bar', factionIds: ['velvet_tide'], romantic: false,
    position: GENERATED_LAYOUT.actorTiles.devon_price, interestId: 'nightlife', memorySubjectId: 'protagonist_nightlife',
    work: GENERATED_LAYOUT.workTiles.devon_price,
  },
  {
    id: 'priya_nair', visualId: 'priya-nair', displayName: 'Priya Nair', role: 'clinic doctor',
    homeLocationId: 'priya_clinic', businessDisplayName: 'Halcyra Clinic', factionIds: ['island_administration'], romantic: true,
    position: GENERATED_LAYOUT.actorTiles.priya_nair, interestId: 'medicine', memorySubjectId: 'protagonist_health',
    work: GENERATED_LAYOUT.workTiles.priya_nair,
  },
  {
    id: 'tomas_reed', visualId: 'tomas-reed', displayName: 'Tomas Reed', role: 'marina clerk',
    homeLocationId: 'tomas_marina', businessDisplayName: 'Public Marina Office', factionIds: ['island_administration'], romantic: false,
    position: GENERATED_LAYOUT.actorTiles.tomas_reed, interestId: 'boating', memorySubjectId: 'protagonist_boating',
    work: GENERATED_LAYOUT.workTiles.tomas_reed,
  },
  {
    id: 'elise_moreau', visualId: 'elise-moreau', displayName: 'Elise Moreau', role: 'local journalist',
    homeLocationId: 'elise_studio', businessDisplayName: 'Elise Moreau Studio', factionIds: [], romantic: true,
    position: GENERATED_LAYOUT.actorTiles.elise_moreau, interestId: 'journalism', memorySubjectId: 'protagonist_story',
    work: GENERATED_LAYOUT.workTiles.elise_moreau,
  },
] as const;

export const PRODUCTION_AMBIENT_RESIDENTS = Array.from({ length: 24 }, (_, index) => {
  const number = String(index + 1).padStart(2, '0');
  const id = `resident_${number}` as keyof typeof GENERATED_LAYOUT.actorTiles;
  return Object.freeze({
    id,
    displayName: `Resident ${number}`,
    position: GENERATED_LAYOUT.actorTiles[id],
  });
});

type NpcState = WorldState['npcs'][string];
type RelationshipState = WorldState['relationships'][string];
type ScheduleState = WorldState['schedules'][string];

function blankNpc(
  id: string,
  tier: NpcState['tier'],
  position: Readonly<{ mapId: string; locationId: string; x: number; y: number }>,
): NpcState {
  return {
    id,
    tier,
    presence: {
      kind: 'active_local', mapId: position.mapId, locationId: position.locationId,
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
  position: Readonly<{ mapId: string; locationId: string; x: number; y: number }>,
  _index: number,
): ScheduleState {
  return {
    id: `${id}_daily`,
    npcId: id,
    blocks: [
      { startMinuteOfDay: 0, locationId: position.locationId, activityId: 'sleep', mapId: position.mapId, tileX: position.x, tileY: position.y },
      { startMinuteOfDay: 480, locationId: position.locationId, activityId: 'stroll', mapId: position.mapId, tileX: position.x, tileY: position.y },
      { startMinuteOfDay: 720, locationId: position.locationId, activityId: 'errands', mapId: position.mapId, tileX: position.x, tileY: position.y },
      { startMinuteOfDay: 1_080, locationId: position.locationId, activityId: 'socialize', mapId: position.mapId, tileX: position.x, tileY: position.y },
    ],
  };
}

export function createProductionSchedules(): Record<string, ScheduleState> {
  const named = PRODUCTION_FULL_AI_CAST.map((character) => {
    return [character.id + '_daily', {
    id: character.id + '_daily',
    npcId: character.id,
    blocks: [
      { startMinuteOfDay: 0, locationId: character.position.locationId, activityId: 'sleep', mapId: character.position.mapId, tileX: character.position.x, tileY: character.position.y },
      { startMinuteOfDay: 480, locationId: character.position.locationId, activityId: 'morning', mapId: character.position.mapId, tileX: character.position.x, tileY: character.position.y },
      { startMinuteOfDay: 720, locationId: character.position.locationId, activityId: 'meet_visitors', mapId: character.position.mapId, tileX: character.position.x, tileY: character.position.y },
      { startMinuteOfDay: 1_080, locationId: character.position.locationId, activityId: 'evening', mapId: character.position.mapId, tileX: character.position.x, tileY: character.position.y },
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
