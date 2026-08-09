import { z } from 'zod';

import {
  SaveSlotIdSchema,
  SaveTriggerSchema,
  type SaveSlotId,
  type SaveTrigger,
} from '../../src/application/effects/PersistencePort';
import { WorldStateSchema, type WorldState } from '../../src/domain/state/schema';
import { canonicalStateJson, checksumState, checksumUtf8 } from './checksum';

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

export const SaveEnvelopeSchema = z.object({
  formatVersion: z.literal(1),
  slotId: SaveSlotIdSchema,
  saveGeneration: z.number().int().positive(),
  trigger: SaveTriggerSchema,
  stateChecksum: Sha256Schema,
  payloadChecksum: Sha256Schema,
  state: WorldStateSchema,
}).strict();

export type SaveEnvelope = z.infer<typeof SaveEnvelopeSchema>;

export const SaveManifestSchema = z.object({
  formatVersion: z.literal(1),
  slotId: SaveSlotIdSchema,
  latestSaveGeneration: z.number().int().positive(),
  stateChecksum: Sha256Schema,
  payloadChecksum: Sha256Schema,
  pins: z.object({
    stateSchemaVersion: z.number().int().positive(),
    engineVersion: z.string().min(1),
    contentVersion: z.string().min(1),
    promptVersion: z.string().min(1),
    modelContractVersion: z.string().min(1),
    modelId: z.enum(['qwen3.5-9b', 'qwen3.5-4b']),
    modelSourceRevision: z.string().regex(/^[a-f0-9]{40}$/u),
    modelArtifactSha256: Sha256Schema,
  }).strict(),
}).strict();

export function createSaveEnvelope(
  slotId: SaveSlotId,
  saveGeneration: number,
  trigger: SaveTrigger,
  state: WorldState,
): SaveEnvelope {
  const safeState = WorldStateSchema.parse(state);
  const stateChecksum = checksumState(safeState);
  const payloadChecksum = checksumUtf8(JSON.stringify({
    formatVersion: 1,
    slotId,
    saveGeneration,
    trigger,
    stateChecksum,
    state: JSON.parse(canonicalStateJson(safeState)) as unknown,
  }));
  return SaveEnvelopeSchema.parse({
    formatVersion: 1,
    slotId,
    saveGeneration,
    trigger,
    stateChecksum,
    payloadChecksum,
    state: safeState,
  });
}

export function parseSaveEnvelope(candidate: unknown): SaveEnvelope {
  const envelope = SaveEnvelopeSchema.parse(candidate);
  if (checksumState(envelope.state) !== envelope.stateChecksum) {
    throw new Error('Save state checksum does not match.');
  }
  const expectedPayloadChecksum = checksumUtf8(JSON.stringify({
    formatVersion: envelope.formatVersion,
    slotId: envelope.slotId,
    saveGeneration: envelope.saveGeneration,
    trigger: envelope.trigger,
    stateChecksum: envelope.stateChecksum,
    state: JSON.parse(canonicalStateJson(envelope.state)) as unknown,
  }));
  if (expectedPayloadChecksum !== envelope.payloadChecksum) {
    throw new Error('Save payload checksum does not match.');
  }
  return envelope;
}

export function serializeSaveEnvelope(envelope: SaveEnvelope): string {
  return `${JSON.stringify(parseSaveEnvelope(envelope))}\n`;
}

export function manifestForEnvelope(envelope: SaveEnvelope): z.infer<typeof SaveManifestSchema> {
  return SaveManifestSchema.parse({
    formatVersion: 1,
    slotId: envelope.slotId,
    latestSaveGeneration: envelope.saveGeneration,
    stateChecksum: envelope.stateChecksum,
    payloadChecksum: envelope.payloadChecksum,
    pins: {
      stateSchemaVersion: envelope.state.schemaVersion,
      engineVersion: envelope.state.engineVersion,
      contentVersion: envelope.state.contentVersion,
      promptVersion: envelope.state.promptVersion,
      modelContractVersion: envelope.state.modelContractVersion,
      modelId: envelope.state.modelPin.id,
      modelSourceRevision: envelope.state.modelPin.sourceRevision,
      modelArtifactSha256: envelope.state.modelPin.artifactSha256,
    },
  });
}
