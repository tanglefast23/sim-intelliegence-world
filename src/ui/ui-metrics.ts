import type { UiScale } from '../render/responsive-layout';

export type UiMetrics = Readonly<{
  scale: UiScale;
  persistentText: number;
  secondaryText: number;
  panelText: number;
  conversationText: number;
  titleText: number;
  pointerTarget: number;
  primaryControl: number;
  gap: number;
  padding: number;
  focusWidth: number;
}>;

export function uiMetrics(scale: UiScale): UiMetrics {
  return {
    scale,
    persistentText: Math.round(12 * scale),
    secondaryText: Math.round(11 * scale),
    panelText: Math.round(14 * scale),
    conversationText: Math.round(16 * scale),
    titleText: Math.round(22 * scale),
    pointerTarget: Math.round(36 * scale),
    primaryControl: Math.round(44 * scale),
    gap: Math.round(8 * scale),
    padding: Math.round(12 * scale),
    focusWidth: 3,
  };
}
