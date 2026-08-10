import {
  automaticUiScale,
  automaticWorldZoom,
  coalescedResizeDelay,
  responsivePanelLayout,
  responsiveSurface,
} from '../responsive-layout';
import { uiMetrics } from '../../ui/ui-metrics';

describe('responsive world layout', () => {
  test.each([
    [1_280, 720, 1],
    [1_440, 900, 1],
    [1_920, 1_080, 2],
    [2_560, 1_440, 2],
    [1_600, 720, 1],
  ] as const)('fills %ix%i and selects %ix automatic world zoom', (width, height, zoom) => {
    const layout = responsiveSurface(width, height);
    expect(layout.surface).toEqual({ width: width - 30, height: height - 30 });
    expect(layout.widthCoverage).toBeGreaterThanOrEqual(0.9);
    expect(layout.heightCoverage).toBeGreaterThanOrEqual(0.85);
    expect(automaticWorldZoom(layout.surface)).toBe(zoom);
  });

  test('selects bounded automatic UI scales', () => {
    expect(automaticUiScale({ width: 1_250, height: 690 })).toBe(1);
    expect(automaticUiScale({ width: 1_890, height: 1_050 })).toBe(1.25);
    expect(automaticUiScale({ width: 2_530, height: 1_410 }, 2)).toBe(1.5);
  });

  test.each([1, 1.25, 1.5] as const)('keeps minimum text and targets at %s UI scale', (scale) => {
    const metrics = uiMetrics(scale);
    expect(metrics.persistentText).toBeGreaterThanOrEqual(12);
    expect(metrics.secondaryText).toBeGreaterThanOrEqual(11);
    expect(metrics.panelText).toBeGreaterThanOrEqual(14);
    expect(metrics.conversationText).toBeGreaterThanOrEqual(16);
    expect(metrics.pointerTarget).toBeGreaterThanOrEqual(36);
    expect(metrics.primaryControl).toBeGreaterThanOrEqual(44);
  });

  test('keeps the 150 percent conversation panel inside 1280 by 720', () => {
    const surface = responsiveSurface(1_280, 720).surface;
    const panel = responsivePanelLayout(surface, 1.5);
    expect(panel.width).toBeLessThanOrEqual(surface.width - 32);
    expect(panel.height).toBeLessThanOrEqual(surface.height - 32);
    expect(panel.compact).toBe(true);
    expect(panel.bodyScrolls).toBe(true);
  });

  test('bounds resize coalescing', () => {
    expect(coalescedResizeDelay()).toBe(48);
    expect(() => coalescedResizeDelay(251)).toThrow('between 0 and 250');
  });
});
