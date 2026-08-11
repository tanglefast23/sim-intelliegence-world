# Phase 28 Grok implementation audit

## Scope

- Branch: `codex/phase-28-art-prototype`
- Base SHA: `63b59583dd0dda4e0ac50bbd51d545bac5c37fe2`
- Packaged source SHA after corrections: `7436aab15a685429ff17b06b440c54c749c3eb43`
- Model: Grok 4.5
- Reasoning effort: high
- Access: subscription-backed, read-only audit wrapper

## Art and source audit

Verdict: `FINDINGS`

Grok reported five findings. Local verification rejected one and confirmed four:

1. Rejected. The alleged internal multi-tile seam did not exist. Exact RGBA inspection found no differing pair where both join pixels were opaque. The regression test now checks every both-opaque join pixel.
2. Confirmed. A hard material edge incorrectly mapped to the built transition class. The mapping now keeps hard material boundaries unblended.
3. Confirmed. The material distribution validator did not enforce the specified count band. It now enforces `floor(72 / variantCount)` through `ceil(216 / variantCount)` for each variant.
4. Confirmed. Roofed rooms could receive presentation decals. The presentation index now rejects decals inside roofed rooms.
5. Confirmed. The locked-door review fixture reused the closed-unlocked art. A distinct locked-door cell and fixture now prove the three door states.

## Evidence audit

Verdict: `FINDINGS`

Grok reported five findings. Local verification confirmed and corrected all five:

1. Subordinate evidence JSON could be empty or malformed because the top-level validator did not parse its schema.
2. Top-level and subordinate reports did not have to use the same source commit and packaged payload.
3. The legacy and enhanced fixed-target pair did not prove the same map, camera, window, DPR, zoom, package, and source commit.
4. The performance report did not pin the complete maximum-load input record.
5. The validator enforced the FPS floor only for enhanced mode.

The correction parses each subordinate schema, pins commit and package provenance, compares fixed-camera inputs, records the complete maximum-load inputs, and enforces the FPS floor for both modes.

## First correction audit

Verdict: `FINDINGS`

Grok found two remaining evidence defects. Local verification confirmed both:

1. The performance `matchedInputs` schema required only commit and package fields. It now also requires map, content size, world surface, DPR, selected world zoom, camera, and UI scale.
2. The report could lower its own FPS requirement because `minimumRoundedFps` accepted any positive integer. It is now fixed to exactly `60`.

## Final correction audit

Verdict: `NO_CONFIRMED_FINDINGS`

Grok rechecked all seven evidence defects against the corrected source and final artifacts. It confirmed subordinate schema parsing, complete commit and package provenance, fixed-camera equality, complete maximum-load inputs, FPS checks for both modes, and an exact `60 FPS` acceptance floor.

## Verified packaged results

- Source commit: `7436aab15a685429ff17b06b440c54c749c3eb43`
- Packaged payload SHA-256: `5b0715f3f2111d92f4ff37d249a352f2fff732c7baada7617f55f97e24217999`
- Atlas SHA-256: `c940e82f2e32c9558983e80ea6915a23e4d81fccb746da59db3ff583f6de0c3d`
- Legacy performance: `119.9 FPS`, `8.3 ms` median frame time
- Enhanced performance: `119.9 FPS`, `8.3 ms` median frame time
- Enhanced-to-legacy ratio: `1.0`
- Added enhanced presentation cost: one static batch
- Full gate: `51` suites and `415` tests passed before the final evidence-only record update.
