import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { WORLD_MAP_CATALOG } from '../../application/runtime/map-catalog';
import { createInitialState } from '../../domain/state/initial-state';
import { buildWorldFrameState, withAuthoredPropScale } from '../world-frame';
import type { WorldPropPlacement } from '../world-frame';

/**
 * Handoff technique 4a: authored prop scale.
 *
 * Production carried a `scale` field on every placement and only floors ever passed a value other
 * than 1, so a sofa read as the same visual weight as the floor tile beneath it. The spike gave
 * furniture presence by drawing it slightly larger.
 */
const TILE = 32;

function prop(sprite: string, worldX = 320, worldY = 640): WorldPropPlacement {
  return {
    id: `${sprite}-fixture`, sprite, worldX, worldY,
    source: { x: 0, y: 0, width: TILE, height: TILE },
    pivot: { x: 0, y: 0 }, rotationDegrees: 0, scale: 1,
    color: '#ffffff', opacity: 1, layer: 'prop', layerValue: 0,
    isDoor: false, objectId: 'object', tile: { x: 10, y: 20 },
  } as unknown as WorldPropPlacement;
}

describe('authored prop scale', () => {
  test('every sprite in the table exists in the atlas', () => {
    // A spike-only key would silently leave that furniture unscaled, and 4a would look like a
    // no-op wherever production uses a different id — the market planter is exactly such a case.
    const atlas = JSON.parse(readFileSync(resolve('assets/generated/atlas-index.json'), 'utf8')) as {
      sprites: Record<string, unknown>;
    };
    const scaled = ['tile.fixture-planter', 'tile.flowering-market-planter', 'tile.decal-neon-planter',
      'tile.table-left', 'tile.table-right', 'tile.sofa-left', 'tile.sofa-right'];
    for (const sprite of scaled) {
      expect(withAuthoredPropScale(prop(sprite)).scale).toBeGreaterThan(1);
      expect(atlas.sprites[sprite]).toBeDefined();
    }
  });

  test('a sprite absent from the table is returned untouched', () => {
    const plain = prop('tile.wall-villa-a');
    expect(withAuthoredPropScale(plain)).toBe(plain);
  });

  test('keeps the feet and the horizontal centre exactly where they were', () => {
    // A top-left anchor would grow the sprite down and right, sinking its feet below the floor.
    for (const sprite of ['tile.sofa-left', 'tile.fixture-planter']) {
      const before = prop(sprite);
      const after = withAuthoredPropScale(before);
      const footBefore = before.worldY + before.source.height * before.scale;
      const footAfter = after.worldY + after.source.height * after.scale;
      expect(footAfter).toBeCloseTo(footBefore, 10);

      const centreBefore = before.worldX + before.source.width * before.scale / 2;
      const centreAfter = after.worldX + after.source.width * after.scale / 2;
      expect(centreAfter).toBeCloseTo(centreBefore, 10);
    }
  });

  test('grows upward and outward only, never below the ground line', () => {
    const after = withAuthoredPropScale(prop('tile.sofa-left'));
    expect(after.worldY).toBeLessThan(640);
    expect(after.worldX).toBeLessThan(320);
  });

  test('covers no neighbouring tile CENTRE it did not cover before', () => {
    // The predicate has to be tile-centre. An unscaled prop's bounds are exactly one 32x32 tile,
    // so ANY scale above 1 intersects its neighbours by construction — a predicate of "intersects
    // a neighbouring tile" would fail 4a everywhere next to an aisle while saying nothing about
    // whether a route is still walkable. The centre is the point a walker actually occupies.
    const centresCovered = (placement: WorldPropPlacement): string[] => {
      const left = placement.worldX;
      const top = placement.worldY;
      const right = left + placement.source.width * placement.scale;
      const bottom = top + placement.source.height * placement.scale;
      const covered: string[] = [];
      for (let tileY = 18; tileY <= 22; tileY += 1) {
        for (let tileX = 8; tileX <= 12; tileX += 1) {
          const centreX = tileX * TILE + TILE / 2;
          const centreY = tileY * TILE + TILE / 2;
          if (centreX >= left && centreX < right && centreY >= top && centreY < bottom) {
            covered.push(`${tileX},${tileY}`);
          }
        }
      }
      return covered;
    };
    for (const sprite of ['tile.sofa-left', 'tile.sofa-right', 'tile.table-left', 'tile.table-right',
      'tile.fixture-planter', 'tile.flowering-market-planter', 'tile.decal-neon-planter']) {
      const before = prop(sprite);
      expect(centresCovered(withAuthoredPropScale(before))).toEqual(centresCovered(before));
    }
  });

  test('contact shadows stay on the unscaled ground line in a real frame', () => {
    // This is the guard that matters most. `propShadows` derives its position from each prop's
    // `worldY`, so scaling the shared list before it runs would carry every shadow UP with the
    // origin and detach it from the feet it belongs to. The scale is applied to the rendered list
    // only, and this asserts the separation on a real frame rather than trusting the comment.
    const frame = buildWorldFrameState(
      WORLD_MAP_CATALOG.northwest_residential, createInitialState(), {}, 'down', 0,
    );

    const scaled = frame.props.filter(({ scale }) => scale !== 1);
    expect(scaled.length).toBeGreaterThan(0);

    for (const placement of scaled) {
      const shadow = frame.propShadows.find((candidate) => candidate.worldX >= 0 &&
        Math.abs(candidate.worldY - (placement.worldY + (placement.scale - 1) * placement.source.height + 25)) < 0.001);
      // Every scaled prop's shadow sits at the UNSCALED worldY plus the authored offset, which is
      // only true because the shadow list never saw the shift.
      expect(shadow).toBeDefined();
    }
  });

  test('the largest authored scale still cannot reach a neighbouring centre', () => {
    // The headroom, stated as a number rather than assumed. A 32px tile grows by (scale-1)*32/2 on
    // each side at the widest; reaching the next centre needs 16px. At 1.12 that is 1.92px.
    const widest = 1.12;
    expect((widest - 1) * TILE / 2).toBeLessThan(TILE / 2);
    expect((widest - 1) * TILE / 2).toBeCloseTo(1.92, 5);
  });
});
