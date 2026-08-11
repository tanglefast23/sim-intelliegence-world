---
date: 2026-08-11
topic: hfm-full-cast-two-feature-rebuild
---

# HFM Full-Cast Two-Feature Rebuild

## What We're Building

Move all 35 production characters onto the accepted HFM `24x30` world and `24x29` portrait grammar. Every person keeps one primary caricature feature and gains one coded secondary clothing, jewelry, hat, footwear, scarf, or carried-item feature.

## Why This Approach

The five-person pilot proved that HFM's face, shoulder, arm, leg, bust, and outline geometry fixes the failed square character system. The production rebuild must reuse that grammar directly instead of making a third character skeleton.

## Key Decisions

- Keep all existing character IDs and save mappings.
- Replace the `40x44` portrait source with HFM's `24x29` source.
- Use the same head and feature coordinates in portraits and world cells.
- Require two visible, described features for every person.
- Include large black boots, scarves, jewelry, a flared dress, carried cases, pouches, hats, and asymmetrical garments across the cast.
- Preserve three expressions for named characters and one rest portrait for ambient residents.
- Bump the production art revision and regenerate the atlas only after all 35 sources validate.

## Acceptance

- All 35 world sprites have explicit arms, hands, separate legs, and shaped feet.
- All 35 portraits use stepped HFM shoulders and do not use a square lower-body block.
- Every source has two nonempty feature layers that survive the generated review.
- The protagonist has black hair and small angled eyes. Linda wears a flared dress.
- Native `1x`, nearest-neighbor `3x`, atlas, content, TypeScript, and full tests pass.

## Next Steps

Migrate the generator, render all secondary features, regenerate revisioned assets, inspect the complete contact sheet, and run full verification.
