export type RendererKind = 'skia' | 'threejs-2d';

export function rendererForEnvironment(input: Readonly<{
  hostname: string;
  search: string;
  smokeMode: boolean;
  smokeRenderer?: RendererKind;
}>): RendererKind {
  if (input.smokeMode && input.smokeRenderer) return input.smokeRenderer;
  const local = input.hostname === 'localhost' || input.hostname === '127.0.0.1';
  const requested = new URLSearchParams(input.search).get('testRenderer');
  return local && (requested === 'skia' || requested === 'threejs-2d') ? requested : 'skia';
}

export function selectedRenderer(): RendererKind {
  if (typeof window === 'undefined' || !window.location) return 'skia';
  return rendererForEnvironment({
    hostname: window.location.hostname,
    search: window.location.search,
    smokeMode: window.siWorldSmokeMode === true,
    smokeRenderer: window.siWorldTestRenderer,
  });
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
