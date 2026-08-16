import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PROCEDURAL_VFX_RENDER_NODE_COUNT, VFX_ROLE_COLORS } from '../types';

/**
 * Stage 7 deleted the Skia ProceduralMapEffects component. The VFX contract it carried is now the
 * Three.js effects batch, so these assertions describe that renderer instead of the old component.
 */
describe('procedural VFX renderer bill', () => {
  const renderer = readFileSync(resolve(process.cwd(), 'src/render/three/world-renderer.ts'), 'utf8');

  test('keeps the nineteen-node evidence bill renderer-neutral', () => {
    expect(PROCEDURAL_VFX_RENDER_NODE_COUNT).toBe(19);
  });

  test('keeps animated fire at 50 percent opacity and sparkle light at 90 percent', () => {
    expect(VFX_ROLE_COLORS['fire-outer']).toBe('#c64f2280');
    expect(VFX_ROLE_COLORS['fire-ember']).toBe('#ffe49a80');
    expect(VFX_ROLE_COLORS['sparkle-primary']).toBe('#fff4c8e6');
    expect(VFX_ROLE_COLORS['sparkle-satellite']).toBe('#fff3c4e6');
  });

  test('draws sampled geometry into one effects batch and owns no clock', () => {
    expect(renderer).toContain("this.#set('effects'");
    expect(renderer).toContain('frame.effects');
    // The renderer presents the frame it is given; it never advances VFX time itself.
    expect(renderer).not.toMatch(/setInterval|Math\.random|performance\.now/u);
  });
});
