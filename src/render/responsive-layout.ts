import { selectAutomaticWorldZoom } from '../world/maps/start-composition';
import type { ZoomLevel } from './atlas';
import type { ViewportSize } from './camera';

export const OUTER_MARGIN = 12;
export const SURFACE_BORDER = 3;
export const UI_SCALES = [1, 1.25, 1.5] as const;
export type UiScale = typeof UI_SCALES[number];

export type SurfaceLayout = Readonly<{
  content: ViewportSize;
  margin: number;
  surface: ViewportSize;
  widthCoverage: number;
  heightCoverage: number;
}>;

export function responsiveSurface(contentWidth: number, contentHeight: number): SurfaceLayout {
  if (!Number.isFinite(contentWidth) || !Number.isFinite(contentHeight) || contentWidth < 1 || contentHeight < 1) {
    throw new RangeError('Content dimensions must be positive finite numbers.');
  }
  const content = { width: Math.floor(contentWidth), height: Math.floor(contentHeight) };
  const inset = OUTER_MARGIN + SURFACE_BORDER;
  const surface = {
    width: Math.max(1, content.width - inset * 2),
    height: Math.max(1, content.height - inset * 2),
  };
  return {
    content,
    margin: OUTER_MARGIN,
    surface,
    widthCoverage: surface.width / content.width,
    heightCoverage: surface.height / content.height,
  };
}

export function automaticWorldZoom(surface: ViewportSize): ZoomLevel {
  return selectAutomaticWorldZoom(surface.width, surface.height);
}

export function automaticUiScale(surface: ViewportSize, devicePixelRatio = 1): UiScale {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) {
    throw new RangeError('Device pixel ratio must be positive.');
  }
  if (surface.width >= 2_200 && surface.height >= 1_200) return 1.5;
  if (surface.width >= 1_600 && surface.height >= 880) return 1.25;
  return 1;
}

export type ResponsivePanelLayout = Readonly<{
  compact: boolean;
  clearance: number;
  width: number;
  height: number;
  bodyScrolls: boolean;
}>;

export function responsivePanelLayout(surface: ViewportSize, uiScale: UiScale): ResponsivePanelLayout {
  const clearance = 16;
  const availableWidth = Math.max(1, surface.width - clearance * 2);
  const availableHeight = Math.max(1, surface.height - clearance * 2);
  const width = Math.min(availableWidth, Math.round(900 * uiScale));
  const height = Math.min(availableHeight, Math.round(620 * uiScale));
  return {
    compact: availableWidth < 1_000 * uiScale || availableHeight < 650 * uiScale,
    clearance,
    width,
    height,
    bodyScrolls: height < 620 * uiScale,
  };
}

export function coalescedResizeDelay(milliseconds = 48): number {
  if (!Number.isFinite(milliseconds) || milliseconds < 0 || milliseconds > 250) {
    throw new RangeError('Resize delay must be between 0 and 250 milliseconds.');
  }
  return Math.round(milliseconds);
}
