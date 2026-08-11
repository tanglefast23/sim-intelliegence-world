import {
  VFX_STEP_MILLISECONDS,
  type AuthoredMapEffect,
  type PreparedVfxEmitter,
  type VfxBounds,
  type VfxGeometry,
  type VfxRect,
  type VfxWorldRect,
} from './types';

const TILE_SIZE = 32;

function anchor(effect: Readonly<{ tile: AuthoredMapEffect['tile'] }>) {
  return {
    x: effect.tile.x * TILE_SIZE + TILE_SIZE / 2,
    y: effect.tile.y * TILE_SIZE + TILE_SIZE / 2,
  };
}

export function declaredVfxBounds(effect: Readonly<{ tile: AuthoredMapEffect['tile'] }>): VfxBounds {
  const center = anchor(effect);
  return Object.freeze({
    left: center.x - 5,
    top: center.y - 10,
    right: center.x + 5,
    bottom: center.y + 3,
  });
}

export function vfxBoundsIntersectWorldRect(
  effect: Readonly<{ tile: AuthoredMapEffect['tile'] }>,
  window: VfxWorldRect,
): boolean {
  const bounds = declaredVfxBounds(effect);
  return bounds.right >= window.left && bounds.left <= window.right &&
    bounds.bottom >= window.top && bounds.top <= window.bottom;
}

function rect(
  role: VfxRect['role'],
  x: number,
  y: number,
  width: number,
  height: number,
): VfxRect {
  return Object.freeze({ role, x, y, width, height });
}

function fireGeometry(
  emitter: PreparedVfxEmitter,
  step: number,
  reducedMotion: boolean,
): readonly VfxRect[] {
  const center = anchor(emitter);
  const phase = reducedMotion ? emitter.phaseOffset : (step + emitter.phaseOffset) % 4;
  const outerByPhase = [
    rect('fire-outer', center.x - 2, center.y - 7, 4, 5),
    rect('fire-outer', center.x - 1, center.y - 8, 3, 6),
    rect('fire-outer', center.x - 3, center.y - 6, 5, 4),
    rect('fire-outer', center.x - 2, center.y - 8, 4, 6),
  ] as const;
  const output = [
    rect('fire-halo', center.x - 4, center.y - 9, 9, 10),
    outerByPhase[phase] as VfxRect,
    rect('fire-core', center.x - 1, center.y - 4, 3, 4),
  ];
  if (!reducedMotion) {
    output.push(rect(
      'fire-ember',
      center.x + emitter.lateralSign * (2 + (phase % 2)),
      center.y - 8 - (phase % 3),
      1,
      1,
    ));
  }
  return Object.freeze(output);
}

function sparkleGeometry(
  emitter: PreparedVfxEmitter,
  step: number,
  reducedMotion: boolean,
): readonly VfxRect[] {
  const center = anchor(emitter);
  const phase = reducedMotion ? emitter.phaseOffset : (step + emitter.phaseOffset) % 4;
  const arm = reducedMotion ? 2 : 2 + (phase % 2);
  const output = [
    rect('sparkle-shadow', center.x - 1, center.y - arm - 1, 3, arm * 2 + 3),
    rect('sparkle-shadow', center.x - arm - 1, center.y - 1, arm * 2 + 3, 3),
    rect('sparkle-primary', center.x, center.y - arm, 1, arm * 2 + 1),
    rect('sparkle-primary', center.x - arm, center.y, arm * 2 + 1, 1),
  ];
  if (!reducedMotion) {
    output.push(rect(
      'sparkle-satellite',
      center.x + emitter.lateralSign * (3 + (phase % 2)),
      center.y - 3 + phase,
      1,
      1,
    ));
  }
  return Object.freeze(output);
}

export function sampleVfxGeometry(
  emitter: PreparedVfxEmitter,
  ageMilliseconds: number,
  reducedMotion: boolean,
): VfxGeometry {
  if (!Number.isFinite(ageMilliseconds) || ageMilliseconds < 0) {
    throw new Error('VFX age must be a finite non-negative number.');
  }
  const ageStep = Math.floor(ageMilliseconds / VFX_STEP_MILLISECONDS);
  const rects = emitter.kind === 'fire'
    ? fireGeometry(emitter, ageStep, reducedMotion)
    : sparkleGeometry(emitter, ageStep, reducedMotion);
  return Object.freeze({
    emitterId: emitter.id,
    kind: emitter.kind,
    recipeId: emitter.recipeId,
    ageStep,
    bounds: declaredVfxBounds(emitter),
    rects,
  });
}

export function primarySilhouette(geometry: VfxGeometry): string {
  return geometry.rects
    .filter(({ role }) => role === 'fire-outer' || role === 'fire-core' || role === 'sparkle-primary')
    .map(({ x, y, width, height }) => `${x},${y},${width},${height}`)
    .join('|');
}
