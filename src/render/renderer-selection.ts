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
