# Phase 30 Grok implementation audit brief

## Target

- Branch: `codex/phase-30-tier-a-sunward-art`
- Base: `origin/main` at `c4541cadb61004c36bea7096312f1df570113f3a`
- Tested source commit: `b962213e1aab506fdef70bc674d7f802cd0290f5`
- Product targets: macOS and Windows. Linux is not a product target.
- Scope: re-author only art already used by `northwest_residential`. Do not change map geometry, game rules, interactions, routes, businesses, or story content.

## Implementation

1. Art revision 4 adds four real villa-floor variants, two plaza variants, two boardwalk variants, and one shell decal. It re-authors all four warm-sand variants.
2. The villa palette has local wall modules. Each of the 16 villa adjacency cells now shows a broad stucco face, terracotta band, core, cap, and contact shadow.
3. The shared default wall modules did not change. Revision 3 hashes prove downtown, commercial, and civic wall cells are byte-identical.
4. Existing Sunward doors, roof cells, bed, sofa, table, counter, signs, lamp, planter, and palm were re-authored. Object placement and collision data did not change.
5. The material selector keeps deterministic tuple hashing and adds a Murmur-style avalanche finalizer. The native warm-sand board has no identical `2x2` block and no identical diagonal run longer than four cells.
6. Review generation now produces native `1x` and nearest-neighbor `3x` boards for all changed Sunward material and architecture cells.
7. The Phase 30 packaged evidence allowlist accepts only the Phase 30 evidence root in addition to the older Phase 28 and 29 roots.

## Locked invariants

- `content/maps/northwest.json` SHA-256: `a831fbbe8f3a9d379a15aaa5be81fb17b3c2248cfde697e4d6e9bd7867386982`
- Public atlas cells: 240
- Ground cells: 25
- Transparent part cells: 88
- Presentation cells: 37
- Generated atlas: 512 by 546 RGBA pixels
- Every villa wall cell has at least 600 visible pixels, and all 16 adjacency masks have unique hashes.
- All 44 Sunward solid footprint cells have a render part at the same offset with at least 128 visible pixels.
- No new solid, object placement, room, wall run, interaction, route, business, or story content exists.

## Executed gates

- Focused Phase 30 gate: 9 suites, 67 tests passed.
- Full test gate: 53 suites, 453 tests passed.
- `npm run art:check`: passed after exact Phase 30 generated files were staged.
- `npm run content:check`: passed.
- `npm run validate:content`: passed.
- `npm run check:boundaries`: passed.
- `npm run typecheck`: passed.
- `npm run package:electron`: passed for the local Apple-silicon package.
- Packaged art-quality smoke: passed and names source commit `b962213`.
- Packaged natural-movement smoke: deterministic and 119.9 FPS against a 55 FPS threshold.
- Packaged responsive qualification: passed at 2560 by 1440 with device pixel ratio 2, 98.83 percent width coverage, 97.92 percent height coverage, no overflow, and a minimum 17 pixel font.
- Same-package art comparison: passed with enhanced-to-legacy median ratio 1.0, minimum rounded FPS 60, and one added static batch against a maximum of one.
- Tier A review: all three critical questions and all six total questions passed against the exact native `1x` color and grayscale frames.

## Audit request

Audit the named Phase 30 files for high-confidence correctness or regression defects. Check deterministic generation, atlas reachability, material selection, wall-family isolation, visible collision mass, immutable map geometry, review-evidence integrity, and packaging provenance. Reject style preferences and future-scope suggestions. Report only concrete findings that require a correction before merge.

## Initial Grok finding and correction

The first high-effort Grok audit found that the villa core covered the south module, which made eight south-bit mask pairs identical. Codex reproduced all eight pairs. The correction ends the core at row 27 and leaves four south-module rows visible. The semantic test now requires all 16 villa wall hashes to be unique and requires at least 600 visible pixels per cell. The regenerated baseline and review board contain 16 unique villa cells.

During corrected package qualification, the serial responsive smoke also exposed a mixed resize evidence frame after the 2560 by 1440 target. The captured 1600 by 720 PNG filled its frame, but the evidence label still contained the prior surface size. The harness now restores a maximized window and waits until content size, measured surface size, and both overflow values agree. Its regression test, final packaged art smoke, and independent high-DPI qualification pass on commit `b962213`.
