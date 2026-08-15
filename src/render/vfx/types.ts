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

export const VFX_ROLE_COLORS: Readonly<Record<VfxPrimitiveRole, string>> = Object.freeze({
  'fire-halo': '#f0783226',
  'fire-outer': '#c64f2280',
  'fire-core': '#ffd15c',
  'fire-ember': '#ffe49a80',
  'sparkle-shadow': '#5c4428cc',
  'sparkle-primary': '#fff4c8e6',
  'sparkle-satellite': '#fff3c4e6',
  'insects-halo': '#f6cd5133',
  'insects-primary': '#ffe889e6',
  'leaves-shadow': '#392c2259',
  'leaves-primary': '#e0a14ed9',
  'neon-halo': '#ef48bb33',
  'neon-primary': '#ff67d9e6',
  'palm-shadow': '#26341f66',
  'palm-primary': '#86a451d9',
  'steam-shadow': '#3f342c4d',
  'steam-primary': '#fff0d6a6',
  'water-shadow': '#174c5966',
  'water-primary': '#8ef1e6d9',
});

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
