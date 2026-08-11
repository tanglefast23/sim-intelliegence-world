import { stableTupleHash } from '../../world/presentation/material-selection';
import {
  VFX_REVISION,
  type AuthoredMapEffect,
  type PreparedVfxEmitter,
  type VfxEmitterPartition,
  type VfxRecipeId,
} from './types';

function recipeIdFor(kind: AuthoredMapEffect['kind']): VfxRecipeId {
  return kind === 'fire' ? 'fire-v1' : 'sparkle-v1';
}

function assertEffect(effect: AuthoredMapEffect): void {
  if (effect.id.trim().length === 0) throw new Error('A VFX emitter ID cannot be empty.');
  if (effect.kind !== 'fire' && effect.kind !== 'sparkle') {
    throw new Error(`Unsupported VFX emitter kind: ${String(effect.kind)}.`);
  }
  if (!Number.isInteger(effect.tile.x) || !Number.isInteger(effect.tile.y)) {
    throw new Error(`VFX emitter ${effect.id} must use an integer tile anchor.`);
  }
}

export function prepareVfxEmitter(mapId: string, effect: AuthoredMapEffect): PreparedVfxEmitter {
  if (mapId.trim().length === 0) throw new Error('A VFX map ID cannot be empty.');
  assertEffect(effect);
  const recipeId = recipeIdFor(effect.kind);
  const seed = stableTupleHash([
    VFX_REVISION,
    mapId,
    effect.id,
    effect.kind,
    effect.tile.x,
    effect.tile.y,
    recipeId,
  ]);
  return Object.freeze({
    id: effect.id,
    kind: effect.kind,
    mapId,
    tile: Object.freeze({ ...effect.tile }),
    recipeId,
    seed,
    phaseOffset: seed % 4,
    lateralSign: (seed & 1) === 0 ? -1 : 1,
  });
}

export function partitionVfxEmitters(
  mapId: string,
  effects: readonly AuthoredMapEffect[],
): VfxEmitterPartition {
  const valid: PreparedVfxEmitter[] = [];
  const fallback: AuthoredMapEffect[] = [];
  for (const effect of effects) {
    try {
      valid.push(prepareVfxEmitter(mapId, effect));
    } catch {
      fallback.push(effect);
    }
  }
  return Object.freeze({
    valid: Object.freeze(valid),
    fallback: Object.freeze(fallback),
  });
}
