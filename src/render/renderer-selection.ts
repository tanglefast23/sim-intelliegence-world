export type RendererKind = 'threejs-2d';

export function rendererForEnvironment(): RendererKind {
  // Stage 7 removed Skia, so there is nothing left to select.
  return 'threejs-2d';
}

export function selectedRenderer(): RendererKind {
  return 'threejs-2d';
}

/**
 * Stage 4 enables ACES in production. The override is unsaved and test-only, so no-tone parity
 * and production ACES contrast can both be rerun from the same package.
 */
export type ToneMappingKind = 'none' | 'aces';

export function toneMappingForEnvironment(input: Readonly<{
  hostname: string;
  search: string;
  smokeMode: boolean;
  smokeToneMapping?: ToneMappingKind;
}>): ToneMappingKind {
  if (input.smokeMode && input.smokeToneMapping) return input.smokeToneMapping;
  const local = input.hostname === 'localhost' || input.hostname === '127.0.0.1';
  const requested = new URLSearchParams(input.search).get('testToneMapping');
  return local && (requested === 'none' || requested === 'aces') ? requested : 'aces';
}

export function selectedToneMapping(): ToneMappingKind {
  if (typeof window === 'undefined' || !window.location) return 'aces';
  return toneMappingForEnvironment({
    hostname: window.location.hostname,
    search: window.location.search,
    smokeMode: window.siWorldSmokeMode === true,
    smokeToneMapping: window.siWorldTestToneMapping,
  });
}
