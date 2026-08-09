import type { IpcMain } from 'electron';

import {
  LoadResultSchema,
  MigrationRequestSchema,
  MigrationResultSchema,
  SaveRequestSchema,
  SaveResultSchema,
  SaveSlotIdSchema,
  type PersistencePort,
} from '../../src/application/effects/PersistencePort';
import { assertTrustedEvent, IpcRateLimiter } from '../ipc/contracts';

export const PERSISTENCE_IPC_CHANNELS = Object.freeze({
  requestSave: 'si-world:request-save',
  loadSave: 'si-world:load-save',
  migrateSave: 'si-world:migrate-save',
});

const MAX_SAVE_REQUEST_BYTES = 2 * 1_024 * 1_024;

function assertPayloadSize(payload: unknown): void {
  const serialized = JSON.stringify(payload);
  if (serialized === undefined || Buffer.byteLength(serialized, 'utf8') > MAX_SAVE_REQUEST_BYTES) {
    throw new Error('Persistence IPC payload exceeds the size limit.');
  }
}

export function registerPersistenceIpc(ipcMain: IpcMain, persistence: PersistencePort): void {
  const limiter = new IpcRateLimiter(12, 10_000);
  ipcMain.handle(PERSISTENCE_IPC_CHANNELS.requestSave, async (event, payload: unknown, ...extra: unknown[]) => {
    assertTrustedEvent(event, limiter);
    if (extra.length !== 0) throw new Error('Unexpected persistence IPC payload.');
    assertPayloadSize(payload);
    const request = SaveRequestSchema.parse(payload);
    return SaveResultSchema.parse(await persistence.requestSave(request));
  });
  ipcMain.handle(PERSISTENCE_IPC_CHANNELS.loadSave, async (event, slotCandidate: unknown, ...extra: unknown[]) => {
    assertTrustedEvent(event, limiter);
    if (extra.length !== 0) throw new Error('Unexpected persistence IPC payload.');
    const slotId = SaveSlotIdSchema.parse(slotCandidate);
    return LoadResultSchema.parse(await persistence.loadSave(slotId));
  });
  ipcMain.handle(PERSISTENCE_IPC_CHANNELS.migrateSave, async (event, payload: unknown, ...extra: unknown[]) => {
    assertTrustedEvent(event, limiter);
    if (extra.length !== 0) throw new Error('Unexpected persistence IPC payload.');
    assertPayloadSize(payload);
    const request = MigrationRequestSchema.parse(payload);
    return MigrationResultSchema.parse(await persistence.migrateSave(request));
  });
}
