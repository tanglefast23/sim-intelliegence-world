import type { IpcMain } from 'electron';

import { RendererPresentationPatchSchema } from '../../src/application/presentation/preferences';
import { assertTrustedEvent, IpcRateLimiter } from '../ipc/contracts';
import type { PresentationPreferencesRepository } from './presentation-preferences';

export const PRESENTATION_IPC_CHANNELS = Object.freeze({
  load: 'si-world:load-presentation-preferences',
  save: 'si-world:save-presentation-preferences',
});

export function registerPresentationPreferencesIpc(
  ipcMain: IpcMain,
  repository: PresentationPreferencesRepository,
): void {
  const limiter = new IpcRateLimiter(40, 10_000);
  ipcMain.handle(PRESENTATION_IPC_CHANNELS.load, (event, ...args: unknown[]) => {
    assertTrustedEvent(event, limiter);
    if (args.length !== 0) throw new Error('Unexpected IPC payload.');
    return repository.load();
  });
  ipcMain.handle(PRESENTATION_IPC_CHANNELS.save, (event, candidate: unknown, ...extra: unknown[]) => {
    assertTrustedEvent(event, limiter);
    if (extra.length !== 0) throw new Error('Unexpected IPC payload.');
    return repository.saveRendererPatch(RendererPresentationPatchSchema.parse(candidate));
  });
}
