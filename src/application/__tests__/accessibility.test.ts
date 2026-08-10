import {
  installWebAccessibilityStyles,
  WEB_ACCESSIBILITY_CSS,
} from '../accessibility';

describe('web accessibility policy', () => {
  test('defines focus and reduced-motion policy and is safe without a DOM', () => {
    expect(() => installWebAccessibilityStyles()).not.toThrow();
    expect(WEB_ACCESSIBILITY_CSS).toContain(':focus-visible');
    expect(WEB_ACCESSIBILITY_CSS).toContain('prefers-reduced-motion: reduce');
  });
});
