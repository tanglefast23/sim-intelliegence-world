import { GLOW_PLATEAUS, glowPlateauAlpha } from '../three/world-renderer';

/**
 * Handoff technique 7: the glow ramp is stepped, not smooth.
 *
 * The texture itself needs a canvas, which the Jest environment does not have, so the ramp is a
 * pure table and this tests the table. What the table cannot show is how the two consumers differ:
 * `lamp-glow` samples it with axis-aligned quad UVs over an 88x88 box, while `district-light-pools`
 * samples it through the fan of `addEllipse`, whose UVs map the inscribed disc. Radial plateaus are
 * correct for both. They do not make both look identical, and they are not meant to.
 */
describe('glow plateau ramp', () => {
  test('keeps the spike step count without the spike brightness', () => {
    // The spike ran 0.04 to 0.12 against production's centre of 1. Importing those alphas would
    // recreate the "glow reads as nothing" bug that the additive-glow work fixed, so only the
    // step COUNT is taken from the handoff.
    expect(GLOW_PLATEAUS).toHaveLength(5);
    expect(GLOW_PLATEAUS.filter(([, alpha]) => alpha > 0)).toHaveLength(4);
    expect(glowPlateauAlpha(0)).toBe(1);
  });

  test('falls to exactly zero at the rim', () => {
    // The pools' fan rim sits on the radius-1 circle, so any alpha left there draws a hard ring
    // around every pool. The existing comment at the glow texture records that trap.
    expect(GLOW_PLATEAUS[GLOW_PLATEAUS.length - 1]).toEqual([1, 0]);
    expect(glowPlateauAlpha(1)).toBe(0);
    expect(glowPlateauAlpha(1.5)).toBe(0);
  });

  test('never brightens outward', () => {
    let previous = Infinity;
    for (let radius = 0; radius <= 1.2; radius += 0.01) {
      const alpha = glowPlateauAlpha(radius);
      expect(alpha).toBeLessThanOrEqual(previous);
      previous = alpha;
    }
  });

  test('is flat inside each band and steps only at its boundary', () => {
    // This is what makes it a plateau rather than a ramp. A smooth gradient would differ at every
    // sample; these must be identical within a band and different across one.
    for (const [index, [outerRadius]] of GLOW_PLATEAUS.entries()) {
      const innerRadius = index === 0 ? 0 : GLOW_PLATEAUS[index - 1]![0];
      const low = glowPlateauAlpha(innerRadius + (outerRadius - innerRadius) * 0.1);
      const high = glowPlateauAlpha(innerRadius + (outerRadius - innerRadius) * 0.9);
      expect(low).toBe(high);
      if (index > 0) expect(glowPlateauAlpha(innerRadius)).not.toBe(low);
    }
  });
});
