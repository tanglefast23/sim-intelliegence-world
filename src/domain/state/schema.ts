import { z } from 'zod';

import { ClockStateSchema } from '../clock/clock';
import { DomainEventSchema } from '../events/types';
import { ENGINE_VERSION, PRNG_VERSION } from '../version';
import { EventIdSchema, StableIdSchema } from './ids';
import {
  EconomyStateSchema,
  EvidenceStateSchema,
  FactionStateSchema,
  InventoryStateSchema,
  JournalEntrySchema,
  MapStateSchema,
  NpcStateSchema,
  PoliceAttentionSchema,
  ProtagonistStateSchema,
  QuestStateSchema,
  RelationshipStateSchema,
  ScheduleStateSchema,
  TransferStateSchema,
} from './models';

export const STATE_SCHEMA_VERSION = 4 as const;
export const CONTENT_VERSION = 'content-0.1.0' as const;
export const PROMPT_VERSION = 'prompt-0.1.0' as const;
export const MODEL_CONTRACT_VERSION = 'qwen-json-v1' as const;

const PrngStateSchema = z.object({
  version: z.literal(PRNG_VERSION),
  cursor: z.number().int().min(0).max(0xffff_ffff),
}).strict();

export const ModelPinSchema = z.object({
  id: z.enum(['qwen3.5-9b', 'qwen3.5-4b']),
  sourceRevision: z.string().regex(/^[a-f0-9]{40}$/u),
  artifactSha256: z.string().regex(/^[a-f0-9]{64}$/u),
}).strict();

export const WorldStateBaseSchema = z.object({
  schemaVersion: z.literal(STATE_SCHEMA_VERSION),
  engineVersion: z.literal(ENGINE_VERSION),
  contentVersion: z.literal(CONTENT_VERSION),
  promptVersion: z.literal(PROMPT_VERSION),
  modelContractVersion: z.literal(MODEL_CONTRACT_VERSION),
  modelPin: ModelPinSchema,
  generationId: z.string().regex(/^generation-[a-z0-9-]+$/u),
  revision: z.number().int().nonnegative(),
  prng: PrngStateSchema,
  clock: ClockStateSchema,
  protagonist: ProtagonistStateSchema,
  npcs: z.record(StableIdSchema, NpcStateSchema),
  relationships: z.record(StableIdSchema, RelationshipStateSchema),
  inventory: InventoryStateSchema,
  economy: EconomyStateSchema,
  factions: z.record(StableIdSchema, FactionStateSchema),
  quests: z.record(StableIdSchema, QuestStateSchema),
  journal: z.record(StableIdSchema, JournalEntrySchema),
  maps: z.record(StableIdSchema, MapStateSchema),
  schedules: z.record(StableIdSchema, ScheduleStateSchema),
  transfers: z.record(StableIdSchema, TransferStateSchema),
  evidence: z.record(StableIdSchema, EvidenceStateSchema),
  policeAttention: PoliceAttentionSchema,
  eventReceipts: z.array(EventIdSchema),
  eventLedger: z.array(DomainEventSchema),
}).strict();

export const WorldStateSchema = WorldStateBaseSchema.superRefine((state, context) => {
  if (new Set(state.eventReceipts).size !== state.eventReceipts.length) {
    context.addIssue({ code: 'custom', path: ['eventReceipts'], message: 'Event receipts must be unique.' });
  }
  const eventIds = state.eventLedger.map(({ eventId }) => eventId);
  if (new Set(eventIds).size !== eventIds.length) {
    context.addIssue({ code: 'custom', path: ['eventLedger'], message: 'Event ledger IDs must be unique.' });
  }
  state.eventLedger.forEach((event, index) => {
    if (event.sequence !== index) {
      context.addIssue({ code: 'custom', path: ['eventLedger', index, 'sequence'], message: 'Event sequence must match ledger order.' });
    }
  });
  if (
    state.eventReceipts.length !== eventIds.length ||
    state.eventReceipts.some((eventId, index) => eventId !== eventIds[index])
  ) {
    context.addIssue({ code: 'custom', path: ['eventReceipts'], message: 'Event receipts must match ledger order.' });
  }
  for (const [id, npc] of Object.entries(state.npcs)) {
    if (npc.id !== id) context.addIssue({ code: 'custom', path: ['npcs', id], message: 'NPC record key must match its ID.' });
  }
  for (const [id, relationship] of Object.entries(state.relationships)) {
    if (relationship.npcId !== id || !state.npcs[id]) {
      context.addIssue({ code: 'custom', path: ['relationships', id], message: 'Relationship must reference its keyed NPC.' });
    }
  }
  for (const [id, faction] of Object.entries(state.factions)) {
    if (faction.id !== id) context.addIssue({ code: 'custom', path: ['factions', id], message: 'Faction record key must match its ID.' });
  }
  for (const [id, quest] of Object.entries(state.quests)) {
    if (quest.id !== id) context.addIssue({ code: 'custom', path: ['quests', id], message: 'Quest record key must match its ID.' });
  }
  for (const [id, entry] of Object.entries(state.journal)) {
    if (entry.id !== id || !state.quests[entry.questId]) {
      context.addIssue({ code: 'custom', path: ['journal', id], message: 'Journal entry must match its key and reference an existing quest.' });
    }
  }
  for (const [id, map] of Object.entries(state.maps)) {
    if (map.id !== id) context.addIssue({ code: 'custom', path: ['maps', id], message: 'Map record key must match its ID.' });
  }
  for (const [id, schedule] of Object.entries(state.schedules)) {
    if (
      schedule.id !== id ||
      !state.npcs[schedule.npcId] ||
      schedule.blocks.some(({ mapId }) => !state.maps[mapId])
    ) {
      context.addIssue({ code: 'custom', path: ['schedules', id], message: 'Schedule must reference an existing NPC.' });
    }
  }
  const transferNpcIds = Object.values(state.transfers).map(({ npcId }) => npcId);
  if (new Set(transferNpcIds).size !== transferNpcIds.length) {
    context.addIssue({ code: 'custom', path: ['transfers'], message: 'An NPC can own only one transfer.' });
  }
  for (const [id, transfer] of Object.entries(state.transfers)) {
    const npc = state.npcs[transfer.npcId];
    if (
      transfer.id !== id ||
      !npc ||
      (transfer.status === 'in_transit'
        ? npc.presence.kind !== 'in_transit' || npc.presence.transferId !== id
        : npc.presence.kind !== 'active_local' || npc.presence.mapId !== transfer.originMapId) ||
      !state.maps[transfer.originMapId] ||
      !state.maps[transfer.destinationMapId]
    ) {
      context.addIssue({ code: 'custom', path: ['transfers', id], message: 'Transfer must match one in-transit NPC and reference existing maps.' });
    }
  }
  for (const [id, npc] of Object.entries(state.npcs)) {
    if (
      npc.presence.kind === 'in_transit' &&
      (!state.transfers[npc.presence.transferId] || state.transfers[npc.presence.transferId]?.status !== 'in_transit')
    ) {
      context.addIssue({ code: 'custom', path: ['npcs', id, 'presence'], message: 'An in-transit NPC must reference an existing transfer.' });
    }
    if (npc.presence.kind !== 'in_transit' && !state.maps[npc.presence.mapId]) {
      context.addIssue({ code: 'custom', path: ['npcs', id, 'presence'], message: 'NPC presence must reference an existing map.' });
    }
    if (npc.scheduleGoal && !state.maps[npc.scheduleGoal.mapId]) {
      context.addIssue({ code: 'custom', path: ['npcs', id, 'scheduleGoal'], message: 'NPC goal must reference an existing map.' });
    }
  }
  const activeMapIds = Object.values(state.maps).filter(({ active }) => active).map(({ id }) => id);
  if (activeMapIds.length !== 1 || activeMapIds[0] !== state.protagonist.worldPosition.mapId) {
    context.addIssue({ code: 'custom', path: ['maps'], message: 'Exactly the protagonist map must be active.' });
  }
  for (const [id, evidence] of Object.entries(state.evidence)) {
    if (evidence.id !== id || evidence.witnessNpcIds.some((npcId) => !state.npcs[npcId])) {
      context.addIssue({ code: 'custom', path: ['evidence', id], message: 'Evidence must match its key and reference existing witnesses.' });
    }
  }
});

export type WorldState = z.infer<typeof WorldStateSchema>;

export function parseWorldState(candidate: unknown): WorldState {
  return WorldStateSchema.parse(candidate);
}
