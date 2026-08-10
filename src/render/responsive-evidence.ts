import type { MapId } from '../world/maps/catalog';
import type { CameraState } from './camera';
import { automaticWorldZoom, type UiScale } from './responsive-layout';
import { uiMetrics } from '../ui/ui-metrics';
import type { WorldLayer } from './world-frame';

type RectEvidence = Readonly<{ x: number; y: number; width: number; height: number }>;

export type ResponsiveEvidence = Readonly<{
  schemaVersion: 1;
  content: Readonly<{ width: number; height: number }>;
  surface: RectEvidence;
  coverage: Readonly<{ width: number; height: number }>;
  devicePixelRatio: number;
  canvas: Readonly<{ backingWidth: number; backingHeight: number }>;
  automaticWorldZoom: 1 | 2 | 3;
  selectedWorldZoom: 1 | 2 | 3;
  uiScale: UiScale;
  camera: CameraState;
  mapId: MapId;
  minimumFontSize: number;
  minimumPointerTarget: number;
  activePanel: Readonly<{ id: string; rect: RectEvidence }> | null;
  conversationInput: RectEvidence | null;
  roofGroupId: string | null;
  roofState: 'hidden' | 'restored';
  drawCounts: Readonly<Record<WorldLayer, number> & { total: number }>;
  overflow: Readonly<{ body: boolean; surface: boolean }>;
}>;

function rectEvidence(rectangle: DOMRect): RectEvidence {
  return {
    x: Math.round(rectangle.x * 100) / 100,
    y: Math.round(rectangle.y * 100) / 100,
    width: Math.round(rectangle.width * 100) / 100,
    height: Math.round(rectangle.height * 100) / 100,
  };
}

export function measureResponsiveEvidence(
  documentValue: Document,
  state: Readonly<{
    camera: CameraState;
    mapId: MapId;
    roofGroupId?: string;
    uiScale: UiScale;
    drawCounts: Readonly<Record<WorldLayer, number> & { total: number }>;
  }>,
): ResponsiveEvidence | undefined {
  const surfaceElement = documentValue.querySelector<HTMLElement>('#world-input-viewport');
  const canvasHost = documentValue.querySelector('#world-canvas');
  const canvas = canvasHost instanceof HTMLCanvasElement
    ? canvasHost
    : canvasHost?.querySelector<HTMLCanvasElement>('canvas');
  if (!surfaceElement || !canvas) return undefined;
  const documentElement = documentValue.documentElement;
  const body = documentValue.body;
  const surfaceRect = surfaceElement.getBoundingClientRect();
  const content = { width: documentElement.clientWidth, height: documentElement.clientHeight };
  const panel = documentValue.querySelector<HTMLElement>([
    '#world-ui-conversation-panel',
    '#world-ui-journal-panel',
    '#world-ui-relationship-panel',
  ].join(','));
  const input = documentValue.querySelector<HTMLElement>('[aria-label="Conversation message"]');
  const metrics = uiMetrics(state.uiScale);
  return {
    schemaVersion: 1,
    content,
    surface: rectEvidence(surfaceRect),
    coverage: {
      width: Math.round(surfaceRect.width / content.width * 10_000) / 10_000,
      height: Math.round(surfaceRect.height / content.height * 10_000) / 10_000,
    },
    devicePixelRatio: documentValue.defaultView?.devicePixelRatio ?? 1,
    canvas: { backingWidth: canvas.width, backingHeight: canvas.height },
    automaticWorldZoom: automaticWorldZoom({ width: surfaceRect.width, height: surfaceRect.height }),
    selectedWorldZoom: state.camera.zoom,
    uiScale: state.uiScale,
    camera: state.camera,
    mapId: state.mapId,
    minimumFontSize: Math.min(metrics.persistentText, metrics.secondaryText),
    minimumPointerTarget: metrics.pointerTarget,
    activePanel: panel ? { id: panel.id, rect: rectEvidence(panel.getBoundingClientRect()) } : null,
    conversationInput: input ? rectEvidence(input.getBoundingClientRect()) : null,
    roofGroupId: state.roofGroupId ?? null,
    roofState: state.roofGroupId ? 'hidden' : 'restored',
    drawCounts: state.drawCounts,
    overflow: {
      body: body.scrollWidth > documentElement.clientWidth || body.scrollHeight > documentElement.clientHeight,
      surface: surfaceElement.scrollWidth > surfaceElement.clientWidth || surfaceElement.scrollHeight > surfaceElement.clientHeight,
    },
  };
}
