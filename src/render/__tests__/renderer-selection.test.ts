import { rendererForEnvironment, toneMappingForEnvironment } from '../renderer-selection';

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

// Stage 4: the tone-mapping override is unsaved and test-only; production always gets ACES.
describe('tone mapping selection', () => {
  const base = { hostname: 'localhost', search: '', smokeMode: false } as const;

  test('defaults to ACES in production', () => {
    expect(toneMappingForEnvironment({ ...base, hostname: 'siworld.example' })).toBe('aces');
    expect(toneMappingForEnvironment({ ...base, hostname: 'siworld.example', search: '?testToneMapping=none' })).toBe('aces');
  });

  test('honours the local development override', () => {
    expect(toneMappingForEnvironment({ ...base, search: '?testToneMapping=none' })).toBe('none');
    expect(toneMappingForEnvironment({ ...base, search: '?testToneMapping=aces' })).toBe('aces');
    expect(toneMappingForEnvironment({ ...base, search: '?testToneMapping=bogus' })).toBe('aces');
  });

  test('honours the packaged smoke override only in smoke mode', () => {
    expect(toneMappingForEnvironment({ ...base, smokeMode: true, smokeToneMapping: 'none' })).toBe('none');
    expect(toneMappingForEnvironment({ ...base, hostname: 'siworld.example', smokeMode: true, smokeToneMapping: 'none' })).toBe('none');
    expect(toneMappingForEnvironment({ ...base, hostname: 'siworld.example', smokeToneMapping: 'none' })).toBe('aces');
  });
});
