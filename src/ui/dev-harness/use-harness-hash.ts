import { useCallback, useEffect, useState } from 'react';

import {
  formatDevHarnessHash,
  parseDevHarnessHash,
  type DevHarnessRoute,
} from './route';

function hashLocation(): Location | undefined {
  if (typeof window === 'undefined') return undefined;
  return typeof window.location?.hash === 'string' ? window.location : undefined;
}

export function useHarnessHash() {
  const [route, setRoute] = useState<DevHarnessRoute>(() => {
    const location = hashLocation();
    return location ? parseDevHarnessHash(location.hash) : {};
  });

  useEffect(() => {
    const location = hashLocation();
    if (!location) return undefined;
    const onHashChange = () => setRoute(parseDevHarnessHash(location.hash));
    onHashChange();
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const push = useCallback((next: DevHarnessRoute) => {
    setRoute(next);
    const location = hashLocation();
    const hash = formatDevHarnessHash(next);
    if (location && location.hash !== hash) location.hash = hash;
  }, []);

  const replace = useCallback((next: DevHarnessRoute) => {
    setRoute(next);
    const location = hashLocation();
    const hash = formatDevHarnessHash(next);
    if (!location || location.hash === hash) return;
    window.history.replaceState(null, '', hash);
  }, []);

  return { route, push, replace } as const;
}
