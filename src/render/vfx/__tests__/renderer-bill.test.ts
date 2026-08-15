import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { VFX_ROLE_COLORS } from '../types';

describe('procedural VFX renderer bill', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/render/vfx/ProceduralMapEffects.tsx'), 'utf8');

  test('uses a constant nineteen-node path bill with no per-primitive React mapping', () => {
    expect(source).toContain('export const PROCEDURAL_VFX_RENDER_NODE_COUNT = 19 as const;');
    expect(source.match(/<Path\b/gu)).toHaveLength(19);
    expect(source).not.toMatch(/rects\.map|emitters\.map|<Rect\b|<Circle\b/u);
  });

  test('keeps animated fire at 50 percent opacity and sparkle light at 90 percent', () => {
    expect(VFX_ROLE_COLORS['fire-outer']).toBe('#c64f2280');
    expect(VFX_ROLE_COLORS['fire-ember']).toBe('#ffe49a80');
    expect(VFX_ROLE_COLORS['sparkle-primary']).toBe('#fff4c8e6');
    expect(VFX_ROLE_COLORS['sparkle-satellite']).toBe('#fff3c4e6');
    expect(source).toContain("<Path color={colors['fire-outer']} path={fireOuter} />");
  });

  test('receives immutable sampled geometry and owns no clock', () => {
    expect(source).toContain('geometries: readonly VfxGeometry[];');
    expect(source).toContain('appendRole(builder, geometriesValue.value, cameraValue.value');
    expect(source).not.toMatch(/requestAnimationFrame|cancelAnimationFrame|setInterval|setTimeout|Math\.random|Date\b|performance\.now/u);
  });

  test('only converts world rectangles to screen paths', () => {
    expect(source).toContain('primitive?.role === role');
    expect(source).toContain('addScreenRect(builder, camera');
    expect(source).not.toMatch(/running|ageMilliseconds|ageStep|mapEntryIdentity/u);
  });
});
