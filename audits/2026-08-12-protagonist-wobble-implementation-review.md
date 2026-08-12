---
title: Protagonist Weighted Wobble Implementation Review
date: 2026-08-12
status: passed-with-unrelated-branch-failures
---

# Implementation review

## Verdict

The protagonist trial is ready for local playtesting. The implementation is deterministic, protagonist-only at render time, and visually reads as a rounded body with weight. No feature defect remained after the test, package, and visual review loop.

## Code review

- `horizontalRunDistance` uses the existing bounded sampled movement distance. It has no wall-clock animation path and is not saved.
- Same-direction tile segments and deferred retargets carry the run. Turns, reversals, waiting, unreachable routes, recovery, arrival, portals, and new requests reset it.
- Active cancellation keeps the current angle until its segment commits, then resets without a snap.
- Completed horizontal segments use exact `32 px` boundaries, preventing floating-point residue at `32`, `64`, and `96 px`.
- The pure curve returns literal zero for non-horizontal states, reduced motion, tile boundaries, and settled travel.
- Rotation is consumed only by `characterAtlasData()`. Static atlas batches keep their old translation-only helper.
- The zero-angle character transform uses the exact legacy `RSXform` call.
- The protagonist's legacy lean, bounce, and shadow offsets are zero. NPC presentation logic is unchanged.
- Only protagonist frame pairs are byte-identical. The strict NPC foot-difference guard remains active.
- Trace and package schemas were versioned together and record real run distance and angle values.

## Visual review

- `1x`: the black-haired silhouette and direction remain readable.
- `2x`: the initial lean is clear, the counter-wobble is smaller, and the final settle is subtle.
- `3x`: the bottom-center pivot stays planted inside the stationary selection ring.
- Up and down travel float with zero rotation and no protagonist bounce.
- Reduced-motion horizontal travel stays upright while distance continues.

The retained tuning is `10 degree` amplitude over `96 px`. The observed sampled peak is about `7.1 degrees`. More amplitude looked likely to read as a pendulum; less would hide the initial weight at `1x`.

## Evidence

- `artifacts/phase-24/art-quality/protagonist-wobble/characters-3x.png`
- `artifacts/phase-25/protagonist-wobble/right-2x-three-lobes.png`
- `artifacts/phase-25/protagonist-wobble/left-3x-initial-lean-centered.png`
- `artifacts/phase-25/protagonist-wobble/up-2x-float.png`
- `artifacts/phase-25/protagonist-wobble/down-2x-float.png`
- `artifacts/phase-25/protagonist-wobble/left-long-2x.webm`
- `output/verification/natural-movement/natural-movement-report.json`

## Unrelated branch failures preserved

The full suite reports 622 passing tests and eight failures caused by existing dirty work:

- stale Phase 30 Sunward geometry, art revision, wall hash, and art-bible assertions;
- Linda schedule and transfer coordinate drift in save, social-system, and simulation tests;
- a first-hour golden revision mismatch.

The strict art check also rejects the existing `resident-02 front` foot-frame pair. The protagonist exception remains narrow and does not bypass this NPC failure.
