import { z } from 'zod';

import { ClockStateSchema } from '../../clock/clock';
import { DomainEventSchema } from '../../events/types';
import { PRNG_VERSION } from '../../version';
import {
  EconomyStateSchema,
  EvidenceStateSchema,
  FactionStateSchema,
  InventoryStateSchema,
  InvitationStateSchema,
  MapStateSchema,
  NpcStateSchema,
  PoliceAttentionSchema,
  ProtagonistStateSchema,
  QuestStateSchema,
  RelationshipStateSchema,
  ScheduleStateSchema,
  TransferStateSchema,
} from '../models';
import { EventIdSchema, StableIdSchema } from '../ids';

const LegacyJournalEntryV6Schema = z.object({
  id: StableIdSchema,
  questId: StableIdSchema,
  summary: z.string().trim().min(1).max(500),
  locationPrecision: z.enum(['none', 'vague', 'exact']),
  locationId: StableIdSchema.optional(),
  markerVisible: z.boolean(),
  deadlineMinute: z.number().int().nonnegative().optional(),
  source: z.object({
    type: z.enum(['npc_report', 'scene_observation', 'authored_event', 'item']),
    sourceId: StableIdSchema,
  }).strict(),
  resolutionState: z.enum(['open', 'resolved', 'expired']),
  outcomeReceipts: z.array(z.object({
    id: StableIdSchema,
    summary: z.string().trim().min(1).max(240),
    outcome: z.enum(['success', 'failure', 'withdrawn', 'information']),
  }).strict()),
}).strict();

const LegacyLayoutMigrationEvidenceV6Schema = z.object({
  recordId: StableIdSchema,
  field: z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u).max(96),
  mapId: StableIdSchema,
  oldTile: z.object({ x: z.number().int().min(0).max(63), y: z.number().int().min(0).max(47) }).strict(),
  newTile: z.object({ x: z.number().int().min(0).max(63), y: z.number().int().min(0).max(47) }).strict(),
  oldLayoutRevision: z.number().int().nonnegative(),
  newLayoutRevision: z.number().int().positive(),
  reason: z.enum(['static_solid', 'claimed_actor', 'reserved_role', 'location_binding', 'portal_moved']),
}).strict();

export const LegacyStateV6Schema = z.object({
  schemaVersion: z.literal(6),
  engineVersion: z.literal('si-world-0.1.0'),
  contentVersion: z.literal('content-0.1.0'),
  promptVersion: z.literal('prompt-0.1.0'),
  modelContractVersion: z.literal('qwen-json-v1'),
  modelPin: z.object({
    id: z.enum(['qwen3.5-9b', 'qwen3.5-4b']),
    sourceRevision: z.string().regex(/^[a-f0-9]{40}$/u),
    artifactSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  }).strict(),
  generationId: z.string().regex(/^generation-[a-z0-9-]+$/u),
  revision: z.number().int().nonnegative(),
  layoutRevisions: z.record(StableIdSchema, z.number().int().nonnegative()),
  layoutMigrationEvidence: z.array(LegacyLayoutMigrationEvidenceV6Schema).max(512),
  prng: z.object({
    version: z.literal(PRNG_VERSION),
    cursor: z.number().int().min(0).max(0xffff_ffff),
  }).strict(),
  clock: ClockStateSchema,
  protagonist: ProtagonistStateSchema,
  npcs: z.record(StableIdSchema, NpcStateSchema),
  relationships: z.record(StableIdSchema, RelationshipStateSchema),
  inventory: InventoryStateSchema,
  economy: EconomyStateSchema,
  factions: z.record(StableIdSchema, FactionStateSchema),
  quests: z.record(StableIdSchema, QuestStateSchema),
  journal: z.record(StableIdSchema, LegacyJournalEntryV6Schema),
  invitations: z.record(StableIdSchema, InvitationStateSchema),
  maps: z.record(StableIdSchema, MapStateSchema),
  schedules: z.record(StableIdSchema, ScheduleStateSchema),
  transfers: z.record(StableIdSchema, TransferStateSchema),
  evidence: z.record(StableIdSchema, EvidenceStateSchema),
  policeAttention: PoliceAttentionSchema,
  eventReceipts: z.array(EventIdSchema),
  eventLedger: z.array(DomainEventSchema),
}).strict();

export type LegacyStateV6 = z.infer<typeof LegacyStateV6Schema>;
