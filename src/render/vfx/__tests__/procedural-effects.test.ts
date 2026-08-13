import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { WORLD_MAP_CATALOG } from '../../../application/runtime/map-catalog';
import { catalogueVfxAnchors, EXPECTED_VFX_ANCHORS } from '../fixtures';
import {
  declaredVfxBounds,
  primarySilhouette,
  sampleVfxGeometry,
  vfxBoundsIntersectWorldRect,
} from '../procedural-effects';
import { partitionVfxEmitters, prepareVfxEmitter } from '../seed';
import { VFX_STEP_MILLISECONDS } from '../types';

const FIRE = { id: 'patio-fire', kind: 'fire', tile: { x: 27, y: 32 } } as const;
const SPARKLE = { id: 'beach-sparkle', kind: 'sparkle', tile: { x: 50, y: 40 } } as const;
const ENVIRONMENTAL = [
  { id: 'leaves', kind: 'leaves', tile: { x: 20, y: 20 } },
  { id: 'insects', kind: 'insects', tile: { x: 20, y: 20 } },
  { id: 'neon', kind: 'neon', tile: { x: 20, y: 20 } },
  { id: 'palm', kind: 'palm', tile: { x: 20, y: 20 } },
  { id: 'steam', kind: 'steam', tile: { x: 20, y: 20 } },
  { id: 'water', kind: 'water', tile: { x: 20, y: 20 } },
] as const;
const SAMPLE_AGES = [0, 50, 250, 500, 1_000] as const;

describe('procedural ambient effect contracts', () => {
  test('matches every authored catalogue anchor without changing map schema', () => {
    expect(catalogueVfxAnchors(WORLD_MAP_CATALOG)).toEqual(EXPECTED_VFX_ANCHORS);
    expect(Object.keys(WORLD_MAP_CATALOG.northwest_residential.source.effects[0] ?? {}).sort())
      .toEqual(['id', 'kind', 'tile']);
  });

  test('uses stable semantic seeds and isolates invalid emitters', () => {
    const first = prepareVfxEmitter('northwest_residential', FIRE);
    const second = prepareVfxEmitter('northwest_residential', FIRE);
    expect(first).toEqual(second);
    expect(first.seed).toBe(259_184_209);
    expect(prepareVfxEmitter('northwest_residential', SPARKLE).seed).not.toBe(first.seed);
    const partition = partitionVfxEmitters('northwest_residential', [
      FIRE,
      { id: '', kind: 'sparkle', tile: { x: 2, y: 2 } },
    ]);
    expect(partition.valid.map(({ id }) => id)).toEqual(['patio-fire']);
    expect(partition.fallback).toHaveLength(1);
  });

  test.each(SAMPLE_AGES)('returns call-order-independent geometry at %d ms', (age) => {
    const fire = prepareVfxEmitter('northwest_residential', FIRE);
    const sparkle = prepareVfxEmitter('northwest_residential', SPARKLE);
    const expected = JSON.stringify([sampleVfxGeometry(fire, age, false), sampleVfxGeometry(sparkle, age, false)]);
    sampleVfxGeometry(sparkle, 3_000, false);
    sampleVfxGeometry(fire, 5_000, true);
    expect(JSON.stringify([sampleVfxGeometry(fire, age, false), sampleVfxGeometry(sparkle, age, false)]))
      .toBe(expected);
  });

  test('uses deliberate steps, bounded primitive counts, and distinct color-free silhouettes', () => {
    expect(VFX_STEP_MILLISECONDS).toBeGreaterThanOrEqual(333);
    const fire = prepareVfxEmitter('northwest_residential', FIRE);
    const sparkle = prepareVfxEmitter('northwest_residential', SPARKLE);
    const fireBeforeStep = sampleVfxGeometry(fire, VFX_STEP_MILLISECONDS - 1, false);
    const fireAtStep = sampleVfxGeometry(fire, VFX_STEP_MILLISECONDS, false);
    expect(fireBeforeStep).not.toEqual(fireAtStep);
    expect(fireAtStep.rects.length).toBeLessThanOrEqual(4);
    expect(sampleVfxGeometry(sparkle, 0, false).rects.length).toBeLessThanOrEqual(5);
    expect(primarySilhouette(sampleVfxGeometry(fire, 0, true)))
      .not.toBe(primarySilhouette(sampleVfxGeometry(sparkle, 0, true)));
  });

  test('keeps reduced motion static and omits traveling secondary marks', () => {
    const fire = prepareVfxEmitter('northwest_residential', FIRE);
    const sparkle = prepareVfxEmitter('northwest_residential', SPARKLE);
    const firstFire = sampleVfxGeometry(fire, 0, true);
    expect(sampleVfxGeometry(fire, 8_000, true)).toMatchObject({ rects: firstFire.rects });
    expect(firstFire.rects.some(({ role }) => role === 'fire-ember')).toBe(false);
    expect(sampleVfxGeometry(sparkle, 8_000, true).rects.some(({ role }) => role === 'sparkle-satellite')).toBe(false);
    expect(sampleVfxGeometry(sparkle, 0, true).rects.some(({ role }) => role === 'sparkle-shadow')).toBe(true);
  });

  test.each(ENVIRONMENTAL)('keeps $kind deterministic, distinct, and static under reduced motion', (effect) => {
    const emitter = prepareVfxEmitter('ambient_test', effect);
    const moving = sampleVfxGeometry(emitter, 0, false);
    expect(sampleVfxGeometry(emitter, 8_000, true).rects)
      .toEqual(sampleVfxGeometry(emitter, 0, true).rects);
    expect(moving.kind).toBe(effect.kind);
    expect(moving.rects.length).toBeLessThanOrEqual(effect.kind === 'water' ? 5 : 4);
    expect(primarySilhouette(moving)).not.toBe('');
  });

  test('declares complete bounds and keeps partially overlapping effects visible', () => {
    expect(declaredVfxBounds(FIRE)).toEqual({ left: 875, top: 1_030, right: 885, bottom: 1_043 });
    expect(declaredVfxBounds(ENVIRONMENTAL.at(-1)!)).toEqual({ left: 641, top: 650, right: 671, bottom: 660 });
    expect(vfxBoundsIntersectWorldRect(FIRE, {
      left: 884,
      top: 1_030,
      right: 900,
      bottom: 1_043,
    })).toBe(true);
    expect(vfxBoundsIntersectWorldRect(FIRE, {
      left: 886,
      top: 1_030,
      right: 900,
      bottom: 1_043,
    })).toBe(false);
  });

  test('contains no runtime randomness or wall-clock authority', () => {
    const source = [
      'types.ts',
      'seed.ts',
      'clock.ts',
      'procedural-effects.ts',
    ].map((name) => readFileSync(resolve(process.cwd(), 'src/render/vfx', name), 'utf8')).join('\n');
    expect(source).not.toMatch(/Math\.random|Date\b|performance\.now/u);
  });
});
