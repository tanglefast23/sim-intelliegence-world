import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { z } from 'zod';

export const ART_CATEGORY_IDS = [
  'ground-base',
  'ground-transition',
  'ground-decal',
  'wall-door',
  'roof',
  'object-landmark',
  'world-character',
  'portrait',
  'effect-reserve',
] as const;

export type ArtCategoryId = typeof ART_CATEGORY_IDS[number];

const CategorySchema = z.object({
  maximumCount: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
}).strict();

export const ArtManifestSchema = z.object({
  schemaVersion: z.literal(1),
  artRevision: z.number().int().positive(),
  toolVersion: z.string().min(1),
  indexVersion: z.literal(3),
  publicIdPrefixes: z.array(z.string().min(1)).min(1),
  limits: z.object({
    maximumWidth: z.literal(1024),
    maximumHeight: z.literal(1024),
    maximumRawAreaRatio: z.literal(0.7),
    maximumPackedAreaRatio: z.literal(0.8),
    gutter: z.literal(1),
  }).strict(),
  categories: z.object(Object.fromEntries(
    ART_CATEGORY_IDS.map((category) => [category, CategorySchema]),
  ) as Record<ArtCategoryId, typeof CategorySchema>).strict(),
}).strict();

export type ArtManifest = z.infer<typeof ArtManifestSchema>;

export function loadArtManifest(root = process.cwd()): ArtManifest {
  return ArtManifestSchema.parse(JSON.parse(
    readFileSync(resolve(root, 'assets/source/art/manifest.json'), 'utf8'),
  ) as unknown);
}
