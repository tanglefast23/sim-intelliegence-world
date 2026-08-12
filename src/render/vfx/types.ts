import type { TilePoint } from '../../world/maps/schema';

export const VFX_REVISION = 2 as const;
export const VFX_STEP_MILLISECONDS = 334 as const;
export const VFX_MAX_DELTA_MILLISECONDS = 50 as const;
export const VFX_SUSPENSION_GAP_MILLISECONDS = 250 as const;

export type VfxMode = 'circle' | 'procedural';
export const VFX_KINDS = ['fire', 'sparkle', 'insects', 'leaves', 'neon', 'palm', 'steam', 'water'] as const;
export type VfxKind = (typeof VFX_KINDS)[number];
export type VfxRecipeId = `${VfxKind}-v1`;
export type VfxPrimitiveRole =
  | 'fire-halo'
  | 'fire-outer'
  | 'fire-core'
  | 'fire-ember'
  | 'sparkle-shadow'
  | 'sparkle-primary'
  | 'sparkle-satellite'
  | 'insects-halo'
  | 'insects-primary'
  | 'leaves-shadow'
  | 'leaves-primary'
  | 'neon-halo'
  | 'neon-primary'
  | 'palm-shadow'
  | 'palm-primary'
  | 'steam-shadow'
  | 'steam-primary'
  | 'water-shadow'
  | 'water-primary';

export type AuthoredMapEffect = Readonly<{
  id: string;
  kind: VfxKind;
  tile: TilePoint;
}>;

export type PreparedVfxEmitter = Readonly<{
  id: string;
  kind: VfxKind;
  mapId: string;
  tile: TilePoint;
  recipeId: VfxRecipeId;
  seed: number;
  phaseOffset: number;
  lateralSign: -1 | 1;
}>;

export type VfxEmitterPartition = Readonly<{
  valid: readonly PreparedVfxEmitter[];
  fallback: readonly AuthoredMapEffect[];
}>;

export type VfxRect = Readonly<{
  role: VfxPrimitiveRole;
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type VfxBounds = Readonly<{
  left: number;
  top: number;
  right: number;
  bottom: number;
}>;

export type VfxGeometry = Readonly<{
  emitterId: string;
  kind: VfxKind;
  recipeId: VfxRecipeId;
  ageStep: number;
  bounds: VfxBounds;
  rects: readonly VfxRect[];
}>;

export type AmbientVfxClock = Readonly<{
  ageMilliseconds: number;
  frameActive: boolean;
  lastSubmittedDeltaMilliseconds: number;
}>;

export type AmbientVfxClockInput = Readonly<{
  running: boolean;
  resumedFromSuspension?: boolean;
}>;

export type VfxWorldRect = Readonly<{
  left: number;
  top: number;
  right: number;
  bottom: number;
}>;
