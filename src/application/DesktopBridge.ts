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
import type {
  PresentationPreferences,
  RendererPresentationPatch,
} from './presentation/preferences';
import type { CharacterId } from '../render/atlas';
import type { MapId } from '../world/maps/catalog';

export type DesktopBridge = ConversationPort & Readonly<{
  getRuntimeInfo: () => Promise<RuntimeInfo>;
  loadPresentationPreferences: () => Promise<PresentationPreferences>;
  loadSave: (slotId: SaveSlotId) => Promise<LoadResult>;
  migrateSave: (request: MigrationRequest) => Promise<MigrationResult>;
  reportRendererReady: (
    report: RendererReadyReport,
  ) => Promise<Readonly<{ accepted: true }>>;
  requestSave: (request: SaveRequest) => Promise<SaveResult>;
  savePresentationPreferences: (patch: RendererPresentationPatch) => Promise<PresentationPreferences>;
}>;

declare global {
  interface Window {
    siWorldDesktop?: DesktopBridge;
    siWorldArtMode?: 'legacy' | 'enhanced';
    siWorldDevHarnessMode?: boolean;
    siWorldVfxMode?: 'circle' | 'procedural';
    siWorldSmokeMode?: boolean;
    siWorldOpenConversationFixture?: (characterId: CharacterId) => void;
    siWorldCloseConversationFixture?: () => void;
    siWorldSetAuthoredDialogueFixture?: (characterId?: 'linda-boyfriend') => void;
    siWorldOpenVfxFixture?: (mapId: MapId, effectId: string) => void;
    siWorldStartNaturalMovementFixture?: () => Readonly<{
      npcId: 'linda';
      source: 'fixture';
      target: Readonly<{ x: 23; y: 28 }>;
    }>;
  }
}

export function getDesktopBridge(): DesktopBridge | undefined {
  return typeof window === 'undefined' ? undefined : window.siWorldDesktop;
}
