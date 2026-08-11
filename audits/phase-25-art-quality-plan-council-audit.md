# Phase 25 art-quality implementation-plan council audit

## Status

- Target: committed plan draft `2900051` against base `9d44f0e6753bf5e6439037b10f5379c045749cc1`.
- Final specification: `docs/specs/2026-08-11-art-quality.md`.
- Plan: `docs/plans/2026-08-11-feat-halcyra-art-quality-program-plan.md`.
- Fable 5: `claude-fable-5`, `xhigh`, completed.
- Opus 5: `claude-opus-5`, `xhigh`, completed.
- Grok 4.5: `grok-4.5`, `high`, completed.
- Council result: complete.

The first council attempt was discarded because the Opus process exited with code `1`. It produced no valid council result. A new run used the same committed target and an exact two-file read boundary. All three requested reviewers completed that run. No model fallback was accepted.

Codex treated every finding as a hypothesis, compared it with the final specification, checked the current supported UI-scale constants where needed, and applied only confirmed in-scope corrections.

## Synthesized verdict

### 1. High: the hard prototype gate was weaker than the final specification

- Agreement: `3/3` — Fable 5, Opus 5, and Grok 4.5.
- Evidence: the final specification requires the exact eleven-item expansion gate at `docs/specs/2026-08-11-art-quality.md:668`. The draft substituted a different list. It omitted or weakened art-bible ownership, the exact named material set, roof base/edge/corner proof, tall-prop and multi-tile depth, complete atlas integrity, and prototype-art lifecycle coverage.
- Impact: broad cast and district art could start before the smallest prototype proved the required safety and quality contracts.
- Correction: plan section 9.5 now maps one-to-one to all eleven final-spec items at `docs/plans/2026-08-11-feat-halcyra-art-quality-program-plan.md:378`. It explicitly names warm sand, dune grass, villa floor, spa stone, and shallow water; adds the roof board; adds room, portal, tall-prop front/behind, and multi-tile depth proof; includes all atlas-integrity checks; and includes fresh start, compatible save load, resize, every zoom, all map transitions, and restart.

### 2. High: Phase 27 introduced runtime cost without its own packaged performance gate

- Agreement: `2/3` — Opus 5 and Grok 4.5.
- Evidence: the final runtime budget applies when the presentation path adds placements, bounds, or a static batch at `docs/specs/2026-08-11-art-quality.md:454`. The draft first measured maximum load in Phase 28, after architecture and art costs were mixed.
- Impact: a presentation or culling regression could merge before measurement, which would make the cause and rollback boundary unclear.
- Correction: Phase 27 now adds a same-package legacy/enhanced switch, runs the Phase 22 maximum-load camera, requires at least `60 FPS`, limits median frame-time regression to `10%`, and blocks visual authoring on failure at `docs/plans/2026-08-11-feat-halcyra-art-quality-program-plan.md:270` and `docs/plans/2026-08-11-feat-halcyra-art-quality-program-plan.md:293`. Phase 26 is now only a methodology and historical reference; it is not the cross-package performance oracle.

### 3. Medium: completed Tier A and Tier B art had no final scene-readability review

- Agreement: `2/3` — Fable 5 and Opus 5.
- Evidence: section 14.5 defines a six-question Tier A review and a four-part Tier B reduced gate at `docs/specs/2026-08-11-art-quality.md:570`. The draft applied the scored review only to the small prototype.
- Impact: later re-authoring could undo prototype readability and still merge.
- Correction: Phase 30 repeats the tracked six-question review on completed Sunward art at `docs/plans/2026-08-11-feat-halcyra-art-quality-program-plan.md:495`. Phase 31 requires one tracked reduced-gate record for every Tier B map at `docs/plans/2026-08-11-feat-halcyra-art-quality-program-plan.md:550`. Either failure blocks that phase merge.

### 4. Medium: portrait proof omitted the supported conversation-panel UI scales

- Agreement: `2/3` — Fable 5 and Grok 4.5.
- Evidence: the final specification requires portrait proof in the current dark conversation panel at every supported UI scale at `docs/specs/2026-08-11-art-quality.md:388`. The repository supports `1`, `1.25`, and `1.5`.
- Impact: world and portrait tokens could match while a portrait reduced transcript or input readability at a supported scale.
- Correction: Phase 28 adds three-character conversation-panel fixtures, Phase 29 adds the full-cast matrix, and Phase 32 repeats every portrait at all three scales. The first corrected requirement is at `docs/plans/2026-08-11-feat-halcyra-art-quality-program-plan.md:373`.

### 5. Medium: revision coupling and full-suite gates were incomplete

- Agreement: `1/3` for `artRevision` — Opus 5; `1/3` for full-suite coverage — Opus 5. Codex independently confirmed both from the final generator contract and the phase command blocks.
- Evidence: a generated pixel-hash change must have an approved art-revision change at `docs/specs/2026-08-11-art-quality.md:710`. The draft defined `artRevision` but did not require later authoring phases to bump it. The Phase 26, 28, 30, and 31 gates also omitted the full Jest suite while changing shared atlas, renderer-facing, or map-facing art.
- Impact: an accidental pixel drift could appear approved, and a cross-cutting regression could reach a later phase before detection.
- Correction: Phase 26 makes the revision/hash pair an enforced global build rule at `docs/plans/2026-08-11-feat-halcyra-art-quality-program-plan.md:181`. The Phase 26, 28, 30, and 31 gates now run `npm test -- --runInBand`.

## Rejected or absorbed claims

- No full Cartesian review matrix is required. The plan keeps named case IDs, covers every required value and named cross-case, and requires a machine-readable reason for a valid `N/A`.
- The decoded atlas memory limit does not need a second independent formula. The `1024x1024` RGBA cap and explicit Phase 28 integrity gate enforce about `4 MiB`.
- The active-interaction state was not missing after synthesis. It remains required by the final review-matrix manifest.
- Phase 26 and Phase 28 no longer use conflicting packages for the `10%` comparison. Every hard performance gate uses two modes from the same package.

## Applied plan changes

1. Replaced the prototype checklist with a one-to-one final-spec mapping.
2. Moved first maximum-load performance proof to Phase 27.
3. Added final Tier A and per-map Tier B scene-review records.
4. Added all supported conversation-panel UI scales for prototype, full cast, and final proof.
5. Added tall-prop front/behind, multi-tile depth-anchor, room-entrance, portal, and exact material proof.
6. Added `artRevision` and revisioned-hash coupling.
7. Added full-suite Jest gates to every cross-cutting art phase.

## Remaining step

Grok 4.5 must perform the requested high-reasoning closure audit of the corrected plan and this record. Phase 26 cannot start until that audit is clean and Phase 25 is merged.
