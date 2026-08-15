import { rendererForEnvironment } from '../renderer-selection';

describe('temporary renderer selector', () => {
  test('accepts only the unsaved packaged smoke selector', () => {
    const input = { hostname: 'game', search: '', smokeMode: false, smokeRenderer: 'threejs-2d' as const };
    expect(rendererForEnvironment(input)).toBe('skia');
    expect(rendererForEnvironment({ ...input, smokeMode: true })).toBe('threejs-2d');
  });

  test.each(['skia', 'threejs-2d'] as const)('accepts localhost query selector %s', (renderer) => {
    expect(rendererForEnvironment({
      hostname: '127.0.0.1',
      search: `?testRenderer=${renderer}`,
      smokeMode: false,
    })).toBe(renderer);
  });

  test('ignores production and unknown query values', () => {
    expect(rendererForEnvironment({ hostname: 'game', search: '?testRenderer=threejs-2d', smokeMode: false })).toBe('skia');
    expect(rendererForEnvironment({ hostname: 'localhost', search: '?testRenderer=webgpu', smokeMode: false })).toBe('skia');
  });
});
