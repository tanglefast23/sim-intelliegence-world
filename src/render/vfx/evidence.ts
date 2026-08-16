import { z } from 'zod';

import { VFX_REVISION } from './types';
import { TRANSIENT_VFX_MAX_CUES, TRANSIENT_VFX_MAX_RECTS, TRANSIENT_VFX_REVISION } from './transient';

const SortedIdListSchema = z.array(z.string().min(1)).readonly();

/**
 * One-shot VFX state. Version 2 adds this block; the ambient fields above it are unchanged.
 *
 * `liveRects.max()` is a backstop, not the enforcement — `sampleTransientVfx` owns the cap and is
 * tested directly. This makes a leak throw here rather than overrun silently.
 */
const TransientEvidenceSchema = z.object({
  revision: z.literal(TRANSIENT_VFX_REVISION),
  enabled: z.boolean(),
  activeCueIds: SortedIdListSchema,
  liveRects: z.number().int().nonnegative().max(TRANSIENT_VFX_MAX_RECTS),
  groundRects: z.number().int().nonnegative(),
  aerialRects: z.number().int().nonnegative(),
  glows: z.number().int().nonnegative(),
  droppedCues: z.number().int().nonnegative(),
  updateRateHz: z.number().nonnegative().max(20),
}).strict().readonly();

export const VfxEvidenceSchema = z.object({
  schemaVersion: z.literal(2),
  mode: z.enum(['circle', 'procedural']),
  mapId: z.string().min(1),
  vfxRevision: z.literal(VFX_REVISION),
  ageStep: z.number().int().nonnegative(),
  reducedMotion: z.boolean(),
  visibleEmitterIds: SortedIdListSchema,
  culledEmitterIds: SortedIdListSchema,
  fallbackEmitterIds: SortedIdListSchema,
  primitiveCounts: z.object({
    fire: z.number().int().nonnegative(),
    sparkle: z.number().int().nonnegative(),
    insects: z.number().int().nonnegative(),
    leaves: z.number().int().nonnegative(),
    neon: z.number().int().nonnegative(),
    palm: z.number().int().nonnegative(),
    steam: z.number().int().nonnegative(),
    water: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }).strict().readonly(),
  renderNodeCount: z.number().int().nonnegative(),
  /** The AMBIENT rate. The transient block carries its own, faster one. */
  updateRateHz: z.number().nonnegative().max(3),
  transient: TransientEvidenceSchema,
}).strict().readonly();

export type VfxEvidence = z.infer<typeof VfxEvidenceSchema>;

export function parseVfxEvidence(input: unknown): VfxEvidence {
  return VfxEvidenceSchema.parse(input);
}
