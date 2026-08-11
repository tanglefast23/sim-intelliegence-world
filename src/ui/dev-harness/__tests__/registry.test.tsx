import { CHARACTER_IDS } from '../../../render/atlas';
import { EXPECTED_VFX_ANCHORS } from '../../../render/vfx/fixtures';

jest.mock('../../../render/WorldScene', () => ({ WorldScene: () => null }));

import { DEV_HARNESS_ENTRIES } from '../registry';

describe('dev harness registry', () => {
  test('has stable, unique, non-empty entry and case ids', () => {
    expect(DEV_HARNESS_ENTRIES.map((entry) => entry.id)).toEqual([
      'welcome', 'locations', 'procedural-effects', 'conversations', 'panels',
    ]);
    expect(new Set(DEV_HARNESS_ENTRIES.map((entry) => entry.id)).size).toBe(DEV_HARNESS_ENTRIES.length);
    for (const entry of DEV_HARNESS_ENTRIES) {
      expect(entry.cases.length).toBeGreaterThan(0);
      expect(new Set(entry.cases.map((entryCase) => entryCase.id)).size).toBe(entry.cases.length);
    }
  });

  test('covers every authored conversation portrait', () => {
    const conversations = DEV_HARNESS_ENTRIES.find((entry) => entry.id === 'conversations');
    expect(conversations?.cases.map((entryCase) => entryCase.id)).toEqual(CHARACTER_IDS);
  });

  test('covers every authored procedural effect', () => {
    const effects = DEV_HARNESS_ENTRIES.find((entry) => entry.id === 'procedural-effects');
    expect(effects?.cases.map((entryCase) => entryCase.id)).toEqual(
      EXPECTED_VFX_ANCHORS.map(({ id }) => id),
    );
  });
});
