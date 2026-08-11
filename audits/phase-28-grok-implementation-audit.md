# Phase 28 Grok implementation audit

## Scope

- Branch: `codex/phase-28-art-prototype`
- Base SHA: `63b59583dd0dda4e0ac50bbd51d545bac5c37fe2`
- Packaged source SHA after corrections: `d250cea41fe4ab19df1ad22a222952d8c548d876`
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

## Hosted CI repair audit

The first hosted run after GitHub runners became available exposed two additional defects:

1. On Windows, npm removed the `--output-root` option name and forwarded only its value. All five Windows smoke steps now invoke the TypeScript entry points through `node --import tsx`, preserving the option and value exactly.
2. Linux and Intel macOS could miss the short curve state because the main process sampled it intermittently. The packaged harness now records the complete first route through a renderer-side `requestAnimationFrame` sampler, capped at 900 samples and bounded by the existing route and process deadlines.

The first post-CI Grok audit confirmed those repairs and found one medium evidence defect: reduced-motion mode claimed an interruption without running the tagged interruption scenario. Local verification confirmed the report had `interruptionObserved: true` and zero interruption tags. The correction initializes the claim as false and makes the validator re-derive all reduced summary fields from its recorded samples.

The correction-only Grok audit returned `NO_CONFIRMED_FINDINGS`. The raw movement report exceeded the audit wrapper's 256 KiB per-file limit, so Grok reviewed the capture source, validator, and regression test. Codex separately schema-validated the complete generated report and confirmed standard interruption true from a tagged sample and reduced interruption false with zero tags.

## Intel macOS platform-shell correction audit

The next hosted run passed Linux and Windows, but the Intel macOS runner measured `23.96 FPS` and failed the movement report's unconditional `55 FPS` rule. The natural-movement specification applies that floor to the Phase 22 maximum-load qualification scene. The cross-platform specification requires hosted shells to record FPS without replacing local qualification.

The report schema is now version 2 and records an explicit `qualification` or `platform-shell` FPS profile. Validation recomputes the threshold result from the packaged measurement, rejects unknown profiles and forged threshold fields, and lets a caller require the expected profile. A qualification report still fails below `55 FPS`; a platform-shell report records the same failure without claiming qualification.

Grok audited the correction against the movement specification, cross-platform specification, CI workflow, source, and regression tests. Verdict: `NO_CONFIRMED_FINDINGS`. The audit used source and schema-validated summaries rather than the oversized raw sample dump.

## Verified packaged results

- Source commit: `d250cea41fe4ab19df1ad22a222952d8c548d876`
- Packaged payload SHA-256: `ae03b877cd978c7d90af0939fcee283e5ca9a63d647cffb7ff477927377a29b6`
- Atlas SHA-256: `c940e82f2e32c9558983e80ea6915a23e4d81fccb746da59db3ff583f6de0c3d`
- Legacy performance: `119.9 FPS`, `8.3 ms` median frame time
- Enhanced performance: `119.9 FPS`, `8.3 ms` median frame time
- Enhanced-to-legacy ratio: `1.0`
- Added enhanced presentation cost: one static batch
- Full gate: `51` suites and `415` tests passed before the final evidence-only record update.
