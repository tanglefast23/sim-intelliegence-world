import { z } from 'zod';

import { WorldStateSchema } from '../../domain/state/schema';

export const SaveSlotIdSchema = z.string().regex(/^slot-[0-9]{3}$/u);
export const SaveTriggerSchema = z.enum(['manual', 'sleep', 'travel', 'major_quest']);

export const SaveRequestSchema = z.object({
  slotId: SaveSlotIdSchema,
  expectedSaveGeneration: z.number().int().nonnegative().nullable(),
  trigger: SaveTriggerSchema,
  state: WorldStateSchema,
}).strict();

export const MigrationRequestSchema = z.object({
  sourceSlotId: SaveSlotIdSchema,
  targetSlotId: SaveSlotIdSchema,
  nextGenerationId: z.string().regex(/^generation-[a-z0-9-]+$/u),
}).strict().refine((request) => request.sourceSlotId !== request.targetSlotId, {
  message: 'Migration target slot must differ from its source slot.',
});

export const SaveResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('saved'),
    slotId: SaveSlotIdSchema,
    saveGeneration: z.number().int().positive(),
    checksum: z.string().regex(/^[a-f0-9]{64}$/u),
    maintenanceWarnings: z.array(z.enum([
      'post_commit_observer_failed',
      'autosave_maintenance_failed',
      'manifest_maintenance_failed',
    ])),
  }).strict(),
  z.object({
    status: z.literal('deferred'),
    slotId: SaveSlotIdSchema,
    blockingPauseTokens: z.array(z.string()).min(1),
  }).strict(),
]);

export const LoadResultSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('empty'), slotId: SaveSlotIdSchema }).strict(),
  z.object({
    status: z.literal('unrecoverable'),
    slotId: SaveSlotIdSchema,
    invalidCandidateCount: z.number().int().positive(),
  }).strict(),
  z.object({
    status: z.literal('loaded'),
    slotId: SaveSlotIdSchema,
    saveGeneration: z.number().int().positive(),
    checksum: z.string().regex(/^[a-f0-9]{64}$/u),
    source: z.enum(['main', 'temporary', 'backup', 'autosave']),
    state: WorldStateSchema,
    invalidCandidateCount: z.number().int().nonnegative(),
  }).strict(),
]);

export const MigrationResultSchema = z.object({
  status: z.literal('migrated'),
  sourceSlotId: SaveSlotIdSchema,
  targetSlotId: SaveSlotIdSchema,
  saveGeneration: z.number().int().positive(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/u),
  stateSchemaVersion: z.number().int().positive(),
  maintenanceWarnings: z.array(z.enum([
    'post_commit_observer_failed',
    'autosave_maintenance_failed',
    'manifest_maintenance_failed',
  ])),
}).strict();

export type SaveSlotId = z.infer<typeof SaveSlotIdSchema>;
export type SaveTrigger = z.infer<typeof SaveTriggerSchema>;
export type SaveRequest = z.infer<typeof SaveRequestSchema>;
export type SaveResult = z.infer<typeof SaveResultSchema>;
export type LoadResult = z.infer<typeof LoadResultSchema>;
export type MigrationRequest = z.infer<typeof MigrationRequestSchema>;
export type MigrationResult = z.infer<typeof MigrationResultSchema>;

export type PersistencePort = Readonly<{
  requestSave: (request: SaveRequest) => Promise<SaveResult>;
  loadSave: (slotId: SaveSlotId) => Promise<LoadResult>;
  migrateSave: (request: MigrationRequest) => Promise<MigrationResult>;
}>;
