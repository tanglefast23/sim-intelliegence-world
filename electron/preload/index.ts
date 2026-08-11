import { contextBridge, ipcRenderer } from 'electron';

import type { RendererReadyReport, RuntimeInfo } from '../ipc/contracts';
import type {
  LoadResult,
  MigrationRequest,
  MigrationResult,
  SaveRequest,
  SaveResult,
  SaveSlotId,
} from '../../src/application/effects/PersistencePort';
import type {
  BeginConversationRequest,
  BeginConversationResult,
  CloseConversationRequest,
  CloseConversationResult,
  ConversationTurnRequest,
  ConversationTurnResult,
} from '../../src/application/effects/ConversationPort';
import type {
  PresentationPreferences,
  RendererPresentationPatch,
} from '../../src/application/presentation/preferences';

// A sandboxed preload is bundled by Electron's restricted loader. Keep its runtime
// surface self-contained; the security tests lock these values to the main contract.
const IPC_CHANNELS = Object.freeze({
  abortConversation: 'si-world:abort-conversation',
  beginConversation: 'si-world:begin-conversation',
  endConversation: 'si-world:end-conversation',
  getRuntimeInfo: 'si-world:get-runtime-info',
  loadPresentationPreferences: 'si-world:load-presentation-preferences',
  loadSave: 'si-world:load-save',
  migrateSave: 'si-world:migrate-save',
  reportRendererReady: 'si-world:report-renderer-ready',
  requestSave: 'si-world:request-save',
  savePresentationPreferences: 'si-world:save-presentation-preferences',
  sendConversationTurn: 'si-world:send-conversation-turn',
});

const desktopBridge = Object.freeze({
  abortConversation: (request: CloseConversationRequest): Promise<CloseConversationResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.abortConversation, request),
  beginConversation: (request: BeginConversationRequest): Promise<BeginConversationResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.beginConversation, request),
  endConversation: (request: CloseConversationRequest): Promise<CloseConversationResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.endConversation, request),
  getRuntimeInfo: (): Promise<RuntimeInfo> => ipcRenderer.invoke(IPC_CHANNELS.getRuntimeInfo),
  loadPresentationPreferences: (): Promise<PresentationPreferences> =>
    ipcRenderer.invoke(IPC_CHANNELS.loadPresentationPreferences),
  loadSave: (slotId: SaveSlotId): Promise<LoadResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.loadSave, slotId),
  migrateSave: (request: MigrationRequest): Promise<MigrationResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.migrateSave, request),
  reportRendererReady: (
    report: RendererReadyReport,
  ): Promise<Readonly<{ accepted: true }>> =>
    ipcRenderer.invoke(IPC_CHANNELS.reportRendererReady, report),
  requestSave: (request: SaveRequest): Promise<SaveResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.requestSave, request),
  savePresentationPreferences: (patch: RendererPresentationPatch): Promise<PresentationPreferences> =>
    ipcRenderer.invoke(IPC_CHANNELS.savePresentationPreferences, patch),
  sendConversationTurn: (request: ConversationTurnRequest): Promise<ConversationTurnResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.sendConversationTurn, request),
});

contextBridge.exposeInMainWorld('siWorldDesktop', desktopBridge);
contextBridge.exposeInMainWorld(
  'siWorldSmokeMode',
  process.argv.includes('--si-world-smoke-mode=1'),
);
const smokeArtMode = process.argv.find((argument) => argument.startsWith('--si-world-art-mode='))?.split('=')[1];
if (process.argv.includes('--si-world-smoke-mode=1') && (smokeArtMode === 'legacy' || smokeArtMode === 'enhanced')) {
  contextBridge.exposeInMainWorld('siWorldArtMode', smokeArtMode);
}
