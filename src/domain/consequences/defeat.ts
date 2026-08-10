import type { WorldState } from '../state/schema';
import { simulateWorldInterval } from '../../world/schedules/simulation';

export const INJURED_ESCAPE_HEALTH_COST = 25;
export const INJURED_ESCAPE_TIME_MINUTES = 4 * 60;

export type DefeatResult = Readonly<{
  state: WorldState;
  healthDelta: number;
  timeDeltaMinutes: number;
}>;

export function applyInjuredEscape(state: WorldState): DefeatResult {
  if (state.clock.pauseTokens.length > 0) {
    throw new Error('A defeat outcome requires a stable unpaused world.');
  }
  const advanced = simulateWorldInterval({
    state,
    toAbsoluteMinute: state.clock.absoluteMinute + INJURED_ESCAPE_TIME_MINUTES,
    toSubMinuteMilliseconds: 0,
    awake: false,
    frameMovement: false,
  }).state;
  const health = Math.max(1, state.protagonist.health - INJURED_ESCAPE_HEALTH_COST);
  return {
    state: { ...advanced, protagonist: { ...advanced.protagonist, health } },
    healthDelta: health - state.protagonist.health,
    timeDeltaMinutes: INJURED_ESCAPE_TIME_MINUTES,
  };
}
