import { rendererForEnvironment, selectedRenderer, toneMappingForEnvironment } from '../renderer-selection';

describe('renderer selection after Skia removal', () => {
  // Stage 7 deleted the temporary selector. There is one renderer and no way to ask for another.
  test('always reports the only renderer', () => {
    expect(rendererForEnvironment()).toBe('threejs-2d');
    expect(selectedRenderer()).toBe('threejs-2d');
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
