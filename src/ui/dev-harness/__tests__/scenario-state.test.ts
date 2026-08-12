import { WORLD_MAP_CATALOG } from '../../../application/runtime/map-catalog';
import { parseWorldState } from '../../../domain/state/schema';
import {
  DEV_HARNESS_MAP_IDS,
  devHarnessGoldenHourState,
  devHarnessDistrictPanelState,
  devHarnessGroundingState,
  devHarnessHeroSceneState,
  devHarnessLocationState,
  devHarnessQuestState,
  devHarnessVfxState,
} from '../scenario-state';
import { EXPECTED_VFX_ANCHORS } from '../../../render/vfx/fixtures';

describe('dev harness scenario states', () => {
  test.each(DEV_HARNESS_MAP_IDS)('holds %s at golden hour', (mapId) => {
    const state = devHarnessGoldenHourState(mapId);
    expect(state.clock).toMatchObject({ absoluteMinute: 1_050, selectedSpeed: 0 });
    expect(state.protagonist.worldPosition.mapId).toBe(mapId);
  });

  test.each(DEV_HARNESS_MAP_IDS)('opens %s at an unblocked grounding close-up', (mapId) => {
    const state = devHarnessGroundingState(mapId);
    const position = state.protagonist.worldPosition;
    expect(state.clock.absoluteMinute).toBe(1_050);
    expect(position.mapId).toBe(mapId);
    expect(WORLD_MAP_CATALOG[mapId].blockedKeys.has(`${position.tileX},${position.tileY}`)).toBe(false);
  });

  test.each(DEV_HARNESS_MAP_IDS)('stages the required actors in the %s hero scene', (mapId) => {
    const state = devHarnessHeroSceneState(mapId);
    const composition = WORLD_MAP_CATALOG[mapId].source.startComposition;
    expect(composition).toBeDefined();
    expect(state.protagonist.worldPosition).toMatchObject({
      mapId,
      tileX: composition?.cameraAnchor.x,
      tileY: composition?.cameraAnchor.y,
    });
    for (const id of composition?.requiredActorIds ?? []) {
      if (id === 'protagonist') continue;
      const presence = state.npcs[id]?.presence;
      expect(presence).toMatchObject({ kind: 'active_local', mapId });
    }
  });

  test.each(DEV_HARNESS_MAP_IDS)('keeps discovered panel data over %s', (mapId) => {
    const state = devHarnessDistrictPanelState(mapId);
    expect(state.protagonist.worldPosition.mapId).toBe(mapId);
    expect(Object.keys(state.journal)).not.toHaveLength(0);
    expect(state.clock.absoluteMinute).toBe(1_050);
  });

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
