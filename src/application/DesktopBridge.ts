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
import type { RendererKind } from '../render/renderer-selection';
import type { ThreeRendererEvidence } from '../render/three/world-renderer';

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
    siWorldTestRenderer?: RendererKind;
    siWorldFreezeNpcMotion?: true;
    siWorldOpenConversationFixture?: (characterId: CharacterId) => void;
    siWorldCloseConversationFixture?: () => void;
    siWorldSetAuthoredDialogueFixture?: (characterId?: 'linda-boyfriend') => void;
    siWorldMeasureResponsiveEvidence?: () => Readonly<Record<string, unknown>> | undefined;
    siWorldOpenVfxFixture?: (mapId: MapId, effectId: string) => void;
    siWorldStartNaturalMovementFixture?: () => Readonly<{
      npcId: 'linda';
      source: 'fixture';
      target: Readonly<{ x: 23; y: 28 }>;
    }>;
    siWorldOpenRendererFeedbackFixture?: () => void;
    siWorldOpenRendererMotionFixture?: (fixture: 'door-transition' | 'walk-east-frame-1') => void;
    siWorldFreezeRendererParityFrame?: () => void;
    siWorldThreeRendererEvidence?: () => ThreeRendererEvidence;
  }
}

export function getDesktopBridge(): DesktopBridge | undefined {
  return typeof window === 'undefined' ? undefined : window.siWorldDesktop;
}
