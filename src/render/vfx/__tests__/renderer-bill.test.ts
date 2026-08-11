import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('procedural VFX renderer bill', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/render/vfx/ProceduralMapEffects.tsx'), 'utf8');

  test('uses a constant seven-node path bill with no per-primitive React mapping', () => {
    expect(source).toContain('export const PROCEDURAL_VFX_RENDER_NODE_COUNT = 7 as const;');
    expect(source.match(/<Path\b/gu)).toHaveLength(7);
    expect(source).not.toMatch(/rects\.map|emitters\.map|<Rect\b|<Circle\b/u);
  });

  test('keeps animated fire at 50 percent opacity and sparkle light at 90 percent', () => {
    expect(source).toContain('<Path color="#c64f2280" path={fireOuter} />');
    expect(source).toContain('<Path color="#ffe49a80" path={fireEmber} />');
    expect(source).toContain('<Path color="#fff4c8e6" path={sparklePrimary} />');
    expect(source).toContain('<Path color="#fff3c4e6" path={sparkleSatellite} />');
  });

  test('uses one platform frame loop and no timer, random, or wall-clock source', () => {
    expect(source.match(/const animate = \(time: number\)/gu)).toHaveLength(1);
    expect(source.match(/requestAnimationFrame\(animate\)/gu)).toHaveLength(2);
    expect(source).toContain('cancelAnimationFrame(animationFrame)');
    expect(source).not.toMatch(/setInterval|setTimeout|Math\.random|Date\b|performance\.now/u);
  });

  test('contains pause, suspension, clamp, and map-entry reset contracts', () => {
    expect(source).toContain('if (!running)');
    expect(source).toContain('rawDelta > VFX_SUSPENSION_GAP_MILLISECONDS');
    expect(source).toContain('Math.min(rawDelta, VFX_MAX_DELTA_MILLISECONDS)');
    expect(source).toContain('ageStepValue.value = ageStep');
    expect(source).toContain('mapEntryIdentity');
    expect(source).toContain('ageMilliseconds.value = 0');
  });
});
