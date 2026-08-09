import { z } from 'zod';

import {
  RelationshipStageSchema,
  RelationshipValuesSchema,
  RejectionRecordSchema,
} from '../../domain/relationships/relationship';
import { StableIdSchema } from '../../domain/state/ids';

export const RegistryNameSchema = z.enum([
  'actions',
  'facts',
  'factions',
  'interests',
  'locations',
  'memory-subjects',
  'quests',
  'unlocks',
]);
export type RegistryName = z.infer<typeof RegistryNameSchema>;

export const REGISTRY_NAMES = RegistryNameSchema.options;

export const RegistryItemSchema = z.object({
  id: StableIdSchema,
  displayName: z.string().trim().min(1).max(80),
}).strict();

export const RegistryFileSchema = z.object({
  schemaVersion: z.literal(1),
  items: z.array(RegistryItemSchema),
}).strict();

export type RegistryFile = z.infer<typeof RegistryFileSchema>;

export const NpcRulesSchema = z.object({
  schemaVersion: z.literal(1),
  npcId: StableIdSchema,
  factIds: z.array(StableIdSchema),
  interestIds: z.array(StableIdSchema),
  actionIds: z.array(StableIdSchema),
  memorySubjectIds: z.array(StableIdSchema),
  unlockIds: z.array(StableIdSchema),
  questIds: z.array(StableIdSchema),
  locationIds: z.array(StableIdSchema),
  factionIds: z.array(StableIdSchema),
  compatibility: z.object({
    social: z.boolean(),
    romantic: z.boolean(),
    romanticEligibleAtStart: z.boolean(),
  }).strict(),
  startingRelationship: z.object({
    values: RelationshipValuesSchema,
    stage: RelationshipStageSchema,
  }).strict(),
  hardBoundaries: z.array(z.object({
    id: StableIdSchema,
    scope: z.enum(['social', 'romantic']),
    blockedActionIds: z.array(StableIdSchema).min(1),
  }).strict()),
  stageRules: z.array(z.object({
    stage: RelationshipStageSchema.exclude(['stranger']),
    floor: RelationshipValuesSchema.optional(),
    unavailable: z.boolean(),
    requiredFlagIds: z.array(StableIdSchema),
  }).strict()),
  rejections: z.array(RejectionRecordSchema),
}).strict();

export type NpcRules = z.infer<typeof NpcRulesSchema>;
