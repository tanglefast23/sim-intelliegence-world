import { WORLD_MAP_CATALOG } from '../../../application/runtime/map-catalog';
import { parseWorldState } from '../../../domain/state/schema';
import {
  DEV_HARNESS_MAP_IDS,
  devHarnessLocationState,
  devHarnessQuestState,
  devHarnessVfxState,
} from '../scenario-state';
import { EXPECTED_VFX_ANCHORS } from '../../../render/vfx/fixtures';

describe('dev harness scenario states', () => {
  test.each(DEV_HARNESS_MAP_IDS)('opens %s in a paused valid state', (mapId) => {
    const state = devHarnessLocationState(mapId);
    expect(parseWorldState(state)).toEqual(state);
    expect(state.clock.selectedSpeed).toBe(0);
    expect(state.protagonist.worldPosition.mapId).toBe(mapId);
    expect(Object.values(state.maps).filter((map) => map.active).map((map) => map.id)).toEqual([mapId]);
    const position = state.protagonist.worldPosition;
    expect(WORLD_MAP_CATALOG[mapId].blockedKeys.has(`${position.tileX},${position.tileY}`)).toBe(false);
  });

  test.each([
    ['locked', 'locked', 'none'],
    ['active', 'active', 'vague'],
    ['discovered', 'active', 'exact'],
  ] as const)('builds the %s Linda quest view', (stage, status, precision) => {
    const state = devHarnessQuestState(stage);
    expect(parseWorldState(state)).toEqual(state);
    expect(state.clock.selectedSpeed).toBe(0);
    expect(state.quests.linda_boyfriend_check?.status).toBe(status);
    expect(state.journal.journal_linda_boyfriend?.locationPrecision ?? 'none').toBe(precision);
  });

  test.each(EXPECTED_VFX_ANCHORS)('opens $id near its emitter with time running', (anchor) => {
    const state = devHarnessVfxState(anchor.mapId, anchor.id);
    expect(parseWorldState(state)).toEqual(state);
    expect(state.clock.selectedSpeed).toBe(1);
    expect(state.protagonist.worldPosition.mapId).toBe(anchor.mapId);
    const position = state.protagonist.worldPosition;
    expect(Math.abs(position.tileX - anchor.x) + Math.abs(position.tileY - anchor.y)).toBe(3);
    expect(WORLD_MAP_CATALOG[anchor.mapId].blockedKeys.has(`${position.tileX},${position.tileY}`)).toBe(false);
  });
});
