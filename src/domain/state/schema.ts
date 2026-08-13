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
  InvitationStateSchema,
  JournalEntrySchema,
  MapStateSchema,
  NpcStateSchema,
  PoliceAttentionSchema,
  ProtagonistStateSchema,
  QuestStateSchema,
  RelationshipStateSchema,
  ScheduleStateSchema,
  TransferStateSchema,
  KnowledgeRecordSchema,
} from './models';
import {
  CommitmentStateSchema,
  VerbalMissionStateSchema,
  WorldObjectStateSchema,
} from '../verbal-missions/state';

export const STATE_SCHEMA_VERSION = 7 as const;
export const CONTENT_VERSION = 'content-0.1.0' as const;
export const PROMPT_VERSION = 'prompt-0.1.0' as const;
export const MODEL_CONTRACT_VERSION = 'qwen-json-v1' as const;
export const EVENT_HISTORY_LIMIT = 512;

const PrngStateSchema = z.object({
  version: z.literal(PRNG_VERSION),
  cursor: z.number().int().min(0).max(0xffff_ffff),
}).strict();

export const LayoutMigrationEvidenceSchema = z.object({
  recordId: StableIdSchema,
  field: z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u).max(96),
  mapId: StableIdSchema,
  oldTile: z.object({ x: z.number().int().min(0).max(63), y: z.number().int().min(0).max(47) }).strict(),
  newTile: z.object({ x: z.number().int().min(0).max(63), y: z.number().int().min(0).max(47) }).strict(),
  oldLayoutRevision: z.number().int().nonnegative(),
  newLayoutRevision: z.number().int().positive(),
  reason: z.enum(['static_solid', 'claimed_actor', 'reserved_role', 'location_binding', 'portal_moved']),
}).strict();

export const ModelPinSchema = z.object({
  id: z.literal('qwen3.5-4b'),
  sourceRevision: z.literal('851bf6e806efd8d0a36b00ddf55e13ccb7b8cd0a'),
  artifactSha256: z.literal('32c8ff2d0972cc26d4c1f99d6655c7e0d4814bae9c23093a9213e23fd36e3d14'),
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
  layoutRevisions: z.record(StableIdSchema, z.number().int().nonnegative()),
  layoutMigrationEvidence: z.array(LayoutMigrationEvidenceSchema).max(512),
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
  invitations: z.record(StableIdSchema, InvitationStateSchema),
  maps: z.record(StableIdSchema, MapStateSchema),
  schedules: z.record(StableIdSchema, ScheduleStateSchema),
  transfers: z.record(StableIdSchema, TransferStateSchema),
  evidence: z.record(StableIdSchema, EvidenceStateSchema),
  playerKnowledge: z.record(StableIdSchema, KnowledgeRecordSchema),
  worldObjects: z.record(StableIdSchema, WorldObjectStateSchema),
  verbalMissions: z.record(StableIdSchema, VerbalMissionStateSchema),
  commitments: z.record(StableIdSchema, CommitmentStateSchema),
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
  const firstEventSequence = state.eventLedger[0]?.sequence ?? 0;
  state.eventLedger.forEach((event, index) => {
    if (event.sequence !== firstEventSequence + index) {
      context.addIssue({ code: 'custom', path: ['eventLedger', index, 'sequence'], message: 'Event sequence must match ledger order.' });
    }
  });
  const ledgerReceipts = eventIds.length === 0 ? [] : state.eventReceipts.slice(-eventIds.length);
  if (ledgerReceipts.length !== eventIds.length || ledgerReceipts.some((eventId, index) => eventId !== eventIds[index])) {
    context.addIssue({ code: 'custom', path: ['eventReceipts'], message: 'Event receipts must end with ledger order.' });
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
    const subjectExists = entry.subject.kind === 'quest'
      ? Boolean(state.quests[entry.subject.questId])
      : Boolean(state.verbalMissions[entry.subject.missionId]);
    if (entry.id !== id || !subjectExists) {
      context.addIssue({ code: 'custom', path: ['journal', id], message: 'Journal entry must match its key and reference its subject.' });
    }
  }
  for (const [id, invitation] of Object.entries(state.invitations)) {
    const npc = state.npcs[invitation.npcId];
    const reservedTransfer = invitation.transferId ? state.transfers[invitation.transferId] : undefined;
    if (
      invitation.id !== id || !npc ||
      (invitation.transferId !== undefined && reservedTransfer?.npcId !== invitation.npcId)
    ) {
      context.addIssue({ code: 'custom', path: ['invitations', id], message: 'Invitation must match its key, NPC, and reserved transfer.' });
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
        : npc.presence.kind === 'in_transit' || npc.presence.mapId !== transfer.originMapId) ||
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
    if (npc.scheduleGoal?.sourceInvitationId) {
      const invitation = state.invitations[npc.scheduleGoal.sourceInvitationId];
      if (!invitation || invitation.npcId !== id || invitation.status !== 'accepted') {
        context.addIssue({ code: 'custom', path: ['npcs', id, 'scheduleGoal'], message: 'An invitation goal must reference its accepted invitation.' });
      }
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
  for (const [id, knowledge] of Object.entries(state.playerKnowledge)) {
    if (knowledge.factId !== id) {
      context.addIssue({ code: 'custom', path: ['playerKnowledge', id], message: 'Player knowledge key must match its fact ID.' });
    }
  }
  for (const [id, object] of Object.entries(state.worldObjects)) {
    if (object.objectId !== id || (object.ownerId !== state.protagonist.id && !state.npcs[object.ownerId])) {
      context.addIssue({ code: 'custom', path: ['worldObjects', id], message: 'World object must match its key and reference an existing owner.' });
    }
  }
  for (const [id, mission] of Object.entries(state.verbalMissions)) {
    const targetExists = mission.goalKind === 'disclose_fact'
      ? mission.terms.recipientId === state.protagonist.id || Boolean(state.npcs[mission.terms.recipientId])
      : mission.goalKind === 'buy_object'
        ? Boolean(state.worldObjects[mission.terms.objectId])
        : Boolean(state.npcs[mission.terms.subjectNpcId]);
    if (mission.missionId !== id || !state.npcs[mission.npcId] || !targetExists) {
      context.addIssue({ code: 'custom', path: ['verbalMissions', id], message: 'Verbal Mission must match its key, NPC, goal, and target.' });
    }
    if (mission.goalKind === 'schedule_cooperation' && mission.terms.commitmentId !== null) {
      const commitment = state.commitments[mission.terms.commitmentId];
      if (!commitment || commitment.missionId !== id) {
        context.addIssue({ code: 'custom', path: ['verbalMissions', id, 'terms', 'commitmentId'], message: 'Mission commitment must reference this mission.' });
      }
    }
  }
  const commitmentMissionIds: string[] = [];
  for (const [id, commitment] of Object.entries(state.commitments)) {
    const mission = state.verbalMissions[commitment.missionId];
    commitmentMissionIds.push(commitment.missionId);
    if (
      commitment.commitmentId !== id ||
      mission?.goalKind !== 'schedule_cooperation' ||
      mission.npcId !== commitment.npcId ||
      mission.terms.actionId !== commitment.actionId ||
      mission.terms.subjectNpcId !== commitment.targetId ||
      mission.terms.locationId !== commitment.locationId ||
      mission.terms.commitmentId !== id
    ) {
      context.addIssue({ code: 'custom', path: ['commitments', id], message: 'Commitment must match its key and scheduled mission terms.' });
    }
  }
  if (new Set(commitmentMissionIds).size !== commitmentMissionIds.length) {
    context.addIssue({ code: 'custom', path: ['commitments'], message: 'A mission can own only one commitment.' });
  }
});

export type WorldState = z.infer<typeof WorldStateSchema>;

export function parseWorldState(candidate: unknown): WorldState {
  return WorldStateSchema.parse(candidate);
}
