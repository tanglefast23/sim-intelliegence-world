import { AccessibilityInfo } from 'react-native';
import { useEffect, useState } from 'react';

export const WEB_ACCESSIBILITY_STYLE_ID = 'si-world-accessibility';

export const WEB_ACCESSIBILITY_CSS = `
*:focus-visible {
  outline: 3px solid #f1c65b !important;
  outline-offset: 2px !important;
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
`;

export function installWebAccessibilityStyles(): void {
  if (typeof document === 'undefined' || document.getElementById(WEB_ACCESSIBILITY_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = WEB_ACCESSIBILITY_STYLE_ID;
  style.textContent = WEB_ACCESSIBILITY_CSS;
  document.head.append(style);
}

function browserReducedMotionQuery(): MediaQueryList | undefined {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : undefined;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => browserReducedMotionQuery()?.matches ?? false);
  useEffect(() => {
    let active = true;
    const query = browserReducedMotionQuery();
    const handleBrowserChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query?.addEventListener('change', handleBrowserChange);
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduced(enabled || query?.matches === true);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      active = false;
      query?.removeEventListener('change', handleBrowserChange);
      subscription.remove();
    };
  }, []);
  return reduced;
}
