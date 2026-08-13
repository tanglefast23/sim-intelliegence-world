import { MAP_IDS } from '../../world/maps/catalog';
import { districtLighting } from '../district-lighting';

describe('authored district lighting', () => {
  test('gives every district a unique accent and three light pools', () => {
    const lighting = MAP_IDS.map((mapId) => districtLighting(mapId, 1_050));
    expect(new Set(lighting.map(({ accent }) => accent)).size).toBe(MAP_IDS.length);
    expect(new Set(lighting.map(({ shelterShade }) => shelterShade)).size).toBe(MAP_IDS.length);
    expect(lighting.every(({ casters, pools }) => casters.length === 3 && pools.length === 3)).toBe(true);
  });

  test('casts longer golden-hour shadows than daytime shadows', () => {
    const day = districtLighting('northwest_residential', 720);
    const dusk = districtLighting('northwest_residential', 1_050);
    expect(dusk.poolOpacity).toBeGreaterThan(day.poolOpacity);
    expect(dusk.shadow.color).not.toBe(day.shadow.color);
    expect(Math.hypot(dusk.shadow.x, dusk.shadow.y)).toBeGreaterThan(Math.hypot(day.shadow.x, day.shadow.y));
  });

  test('uses restrained strength where warm ground already carries the district color', () => {
    const sunward = districtLighting('northwest_residential', 1_050);
    const saffron = districtLighting('southwest_commercial', 1_050);
    expect(saffron.poolOpacity).toBeLessThan(sunward.poolOpacity);
    expect(saffron.shadow.color).not.toBe(sunward.shadow.color);
  });

  test('keeps entrance pools local instead of washing whole rooms', () => {
    const lighting = MAP_IDS.map((mapId) => districtLighting(mapId, 1_050));
    expect(lighting.flatMap(({ pools }) => pools).every(({ radius }) => radius <= 52)).toBe(true);
    expect(districtLighting('southeast_docks', 1_050).pools).toContainEqual({ x: 49, y: 34, radius: 50 });
  });
});
