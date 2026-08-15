import { MAP_IDS } from '../../world/maps/catalog';
import { ALL_MAP_PARITY_CASES } from '../three/all-map-parity';

describe('Stage 3 all-map parity matrix', () => {
  test('locks every supported map, viewport, DPR, and full-map zoom', () => {
    expect([...new Set(ALL_MAP_PARITY_CASES.map(({ mapId }) => mapId))].sort()).toEqual([...MAP_IDS].sort());
    expect([...new Set(ALL_MAP_PARITY_CASES.map(({ viewport }) => `${viewport.width}x${viewport.height}`))].sort()).toEqual([
      '1280x720', '1440x900', '1600x720', '1920x1080', '2560x1440',
    ]);
    expect([...new Set(ALL_MAP_PARITY_CASES.map(({ devicePixelRatio }) => devicePixelRatio))].sort()).toEqual([1, 1.25, 1.5, 2]);
    expect([...new Set(ALL_MAP_PARITY_CASES.map(({ zoom }) => zoom))].sort()).toEqual([1, 2, 3]);
    expect(ALL_MAP_PARITY_CASES.some(({ id }) => id.startsWith('maximum-load-'))).toBe(true);
  });
});
