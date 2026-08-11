import { WORLD_MAP_CATALOG } from '../../application/runtime/map-catalog';
import {
  buildTurnCurve,
  sampleQuadratic,
  sampleQuadraticByDistance,
  TURN_RADIUS,
} from '../movement/turn-curve';

describe('safe turn curve', () => {
  test('rounds a clear ninety-degree path by six world pixels', () => {
    const curve = buildTurnCurve(
      WORLD_MAP_CATALOG.northwest_residential,
      { x: 18, y: 18 },
      { x: 18, y: 19 },
      { x: 19, y: 19 },
    );
    expect(curve).toBeDefined();
    if (!curve) return;
    expect(Math.hypot(curve.control.x - curve.start.x, curve.control.y - curve.start.y)).toBeCloseTo(TURN_RADIUS);
    expect(Math.hypot(curve.end.x - curve.control.x, curve.end.y - curve.control.y)).toBeCloseTo(TURN_RADIUS);
    const before = sampleQuadratic(curve, 0.49);
    const after = sampleQuadratic(curve, 0.51);
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(1);
  });

  test('samples the curve by near-equal traveled distances', () => {
    const curve = buildTurnCurve(
      WORLD_MAP_CATALOG.northwest_residential,
      { x: 18, y: 18 },
      { x: 18, y: 19 },
      { x: 19, y: 19 },
    );
    expect(curve).toBeDefined();
    if (!curve) return;
    const points = Array.from({ length: 9 }, (_, index) => sampleQuadraticByDistance(curve, index / 8));
    const distances = points.slice(1).map((point, index) => (
      Math.hypot(point.x - points[index]!.x, point.y - points[index]!.y)
    ));
    expect(Math.max(...distances) - Math.min(...distances)).toBeLessThan(0.08);
  });

  test('rejects a turn whose expanded envelope touches a solid', () => {
    const map = WORLD_MAP_CATALOG.northwest_residential;
    const curve = buildTurnCurve(map, { x: 6, y: 7 }, { x: 7, y: 7 }, { x: 7, y: 8 });
    if (curve) {
      expect(curve.touchedTileKeys.every((key) => !map.blockedKeys.has(key))).toBe(true);
    } else {
      expect(curve).toBeUndefined();
    }
  });
});
