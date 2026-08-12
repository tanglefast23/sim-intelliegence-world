import { z } from 'zod';

import { isWorldZoom } from '../../domain/presentation/world-zoom';
import { MAP_IDS } from '../../world/maps/catalog';

export const UiScaleSchema = z.union([z.literal(1), z.literal(1.25), z.literal(1.5)]);
export const WorldZoomSchema = z.number().refine(isWorldZoom, {
  message: 'World zoom must be from 100% to 300% in 5% increments.',
});
export const PresentationPreferencesSchema = z.object({
  schemaVersion: z.literal(1),
  worldZoom: WorldZoomSchema.nullable(),
  uiScale: UiScaleSchema.nullable(),
  camera: z.object({
    mapId: z.enum(MAP_IDS),
    x: z.number().int().min(-10_000).max(10_000),
    y: z.number().int().min(-10_000).max(10_000),
  }).strict().nullable(),
  windowSize: z.object({
    width: z.number().int().min(960).max(10_000),
    height: z.number().int().min(640).max(10_000),
  }).strict().nullable(),
}).strict();

export const RendererPresentationPatchSchema = PresentationPreferencesSchema.pick({
  worldZoom: true,
  uiScale: true,
  camera: true,
}).strict();

export type PresentationPreferences = z.infer<typeof PresentationPreferencesSchema>;
export type RendererPresentationPatch = z.infer<typeof RendererPresentationPatchSchema>;

export const DEFAULT_PRESENTATION_PREFERENCES: PresentationPreferences = Object.freeze({
  schemaVersion: 1,
  worldZoom: null,
  uiScale: null,
  camera: null,
  windowSize: null,
});

export function parsePresentationPreferences(candidate: unknown): PresentationPreferences {
  return PresentationPreferencesSchema.parse(candidate);
}
