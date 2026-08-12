import type { WorldState } from '../domain/state/schema';
import { activeScheduleBlock } from '../world/schedules/schedule';

export type CharacterMood = 'CURIOUS' | 'ENGAGED' | 'FOCUSED' | 'GUARDED' | 'HURT' | 'OPEN' | 'RESTFUL' | 'STEADY' | 'TIRED';

export type SelectedCharacterSummary = Readonly<{
  activity: string;
  destination: string;
  displayName: string;
  id: string;
  mood: CharacterMood;
  portraitExpression: 'rest' | 'joy' | 'upset';
  relationship: string;
}>;

function label(value: string): string {
  const authored: Readonly<Record<string, string>> = {
    evening: 'EVENING SOCIAL',
    meet_visitors: 'MEETING VISITORS',
    morning: 'MORNING ROUTINE',
    northeast_downtown: 'NEON CRESCENT',
    northwest_residential: 'SUNWARD VILLAS',
    southeast_docks: 'GREYWAKE HARBOR',
    southwest_commercial: 'SAFFRON BAZAAR',
  };
  return authored[value] ?? value.replaceAll('_', ' ').replaceAll('-', ' ').toUpperCase();
}

function protagonistMood(state: WorldState): Pick<SelectedCharacterSummary, 'mood' | 'portraitExpression'> {
  if (state.protagonist.health < 45) return { mood: 'HURT', portraitExpression: 'upset' };
  if (state.protagonist.energy < 35) return { mood: 'TIRED', portraitExpression: 'upset' };
  if (state.protagonist.confidence >= 70) return { mood: 'STEADY', portraitExpression: 'joy' };
  return { mood: 'CURIOUS', portraitExpression: 'rest' };
}

export function selectedCharacterSummary(
  state: WorldState,
  selectedId: string,
  moving: boolean,
): SelectedCharacterSummary {
  if (selectedId === 'protagonist' || !state.npcs[selectedId]) {
    return {
      activity: moving ? 'WALKING' : 'EXPLORING',
      destination: moving ? 'PLAYER WAYPOINT' : label(state.protagonist.locationId),
      displayName: state.protagonist.displayName,
      id: 'protagonist',
      relationship: `SELF · CONFIDENCE ${state.protagonist.confidence}`,
      ...protagonistMood(state),
    };
  }

  const npc = state.npcs[selectedId]!;
  const relationship = state.relationships[selectedId];
  const schedule = Object.values(state.schedules).find((candidate) => candidate.npcId === selectedId);
  const block = schedule ? activeScheduleBlock(schedule, state.clock.absoluteMinute) : undefined;
  const transfer = Object.values(state.transfers).find((candidate) => candidate.npcId === selectedId);
  const goal = npc.scheduleGoal;
  const activityId = moving ? 'on_the_way' : goal?.activityId ?? block?.activityId ?? 'idle';
  const destinationId = transfer?.destinationLocationId ?? goal?.locationId ?? block?.locationId ?? (
    npc.presence.kind === 'in_transit' ? 'between_districts' : npc.presence.locationId
  );
  const socialActivity = ['evening', 'meet_visitors', 'nightlife', 'socialize'].includes(activityId);
  const resting = ['home', 'sleep'].includes(activityId);
  const mood = npc.condition === 'injured'
    ? 'HURT'
    : moving ? 'FOCUSED'
      : socialActivity ? 'ENGAGED'
        : resting ? 'RESTFUL'
          : (relationship?.values.trust ?? 0) >= 35 ? 'OPEN' : 'GUARDED';
  return {
    activity: label(activityId),
    destination: label(destinationId),
    displayName: label(selectedId),
    id: selectedId,
    mood,
    portraitExpression: mood === 'ENGAGED' || mood === 'OPEN' ? 'joy' : mood === 'HURT' || mood === 'GUARDED' ? 'upset' : 'rest',
    relationship: relationship
      ? `${label(relationship.stage)} · TRUST ${relationship.values.trust}`
      : 'UNKNOWN RESIDENT',
  };
}
