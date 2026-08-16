import { AccessibilityInfo } from 'react-native';
import { useEffect, useState } from 'react';

import { UI_MOTION_CSS } from '../ui/ui-motion';

export const WEB_ACCESSIBILITY_STYLE_ID = 'si-world-accessibility';

// The reduced-motion block is last on purpose. It neutralises every animation in UI_MOTION_CSS by
// construction, because !important beats any declaration there regardless of specificity, so no
// animation needs its own opt-out. The delay resets matter as much as the duration ones: a
// staggered entry uses animation-delay with backwards fill, so zeroing only the duration would
// leave the item held at opacity 0 for the delay and then pop into place.
export const WEB_ACCESSIBILITY_CSS = `
*:focus-visible {
  outline: 3px solid #f1c65b !important;
  outline-offset: 2px !important;
}
${UI_MOTION_CSS}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-delay: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-delay: 0.01ms !important;
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
