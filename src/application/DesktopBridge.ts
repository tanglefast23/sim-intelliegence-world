import type {
  RendererReadyReport,
  RuntimeInfo,
} from '../../electron/ipc/contracts';
import type {
  LoadResult,
  MigrationRequest,
  MigrationResult,
  SaveRequest,
  SaveResult,
  SaveSlotId,
} from './effects/PersistencePort';
import type { ConversationPort } from './effects/ConversationPort';

export type DesktopBridge = ConversationPort & Readonly<{
  getRuntimeInfo: () => Promise<RuntimeInfo>;
  loadSave: (slotId: SaveSlotId) => Promise<LoadResult>;
  migrateSave: (request: MigrationRequest) => Promise<MigrationResult>;
  reportRendererReady: (
    report: RendererReadyReport,
  ) => Promise<Readonly<{ accepted: true }>>;
  requestSave: (request: SaveRequest) => Promise<SaveResult>;
}>;

declare global {
  interface Window {
    siWorldDesktop?: DesktopBridge;
  }
}

export function getDesktopBridge(): DesktopBridge | undefined {
  return typeof window === 'undefined' ? undefined : window.siWorldDesktop;
}
