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

// A sandboxed preload is bundled by Electron's restricted loader. Keep its runtime
// surface self-contained; the security tests lock these values to the main contract.
const IPC_CHANNELS = Object.freeze({
  abortConversation: 'si-world:abort-conversation',
  beginConversation: 'si-world:begin-conversation',
  endConversation: 'si-world:end-conversation',
  getRuntimeInfo: 'si-world:get-runtime-info',
  loadSave: 'si-world:load-save',
  migrateSave: 'si-world:migrate-save',
  reportRendererReady: 'si-world:report-renderer-ready',
  requestSave: 'si-world:request-save',
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
  sendConversationTurn: (request: ConversationTurnRequest): Promise<ConversationTurnResult> =>
    ipcRenderer.invoke(IPC_CHANNELS.sendConversationTurn, request),
});

contextBridge.exposeInMainWorld('siWorldDesktop', desktopBridge);
