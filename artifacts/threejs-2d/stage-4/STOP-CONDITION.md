# Stage 4 stop condition — no-tone parity fails after the lighting move

Date: 2026-08-16
Branch retained: `codex/threejs-stage-4-lighting`
Plan section 16: "Stop the active stage and retain its branch when ... the
no-tone parity comparator fails."

## What was implemented

District shadows and light pools, the screen-space atmosphere wash, edge shades
and motes, and the destination/journal/failure feedback batches all moved onto
the Three.js path. The three React overlays now mount only for Skia, so the
feedback batches finally composite above lighting as the locked order requires.
ACES landed behind an unsaved `none|aces` override with a recorded exposure.

Unit evidence is green: 88 suites, 902 tests, typecheck, import boundaries, and
the new tone-mapping selector tests all pass. Both packaged smokes pass.

## The blocker

Rerunning the locked no-tone parity manifest against Skia fails:

- 14 of 25 fixtures fail;
- outside-mask changed-pixel ratio reaches `0.25794` against a native limit of `0.005`;
- frame mean absolute channel delta reaches `1.3119`;
- ratio above delta 32 stays at `0.001849`.

The last number matters. Nothing is structurally wrong: no sprite moved, no
batch is missing, no large colour error exists. The error is small, systematic,
and frame-wide, which is the signature of a compositing difference rather than a
drawing defect. The atmosphere wash covers every pixel at roughly `0.188` alpha,
so any per-pixel blend difference shifts the whole frame slightly.

## Why the gate was not adjusted

Plan rule 14 forbids weakening a threshold so a phase can pass, and the native
DPR 1 zoom 1 gates are locked by the specification. Widening them to absorb a
measured compositing difference would hide exactly the class of defect the gate
exists to catch.

## Next step for Stage 4

Find the compositing difference before re-running the gate. The Three.js quads
blend inside one WebGL framebuffer after `colorspace_fragment`, while the Skia
path composites separate browser layers. Confirm which space each blend happens
in, and match the Three.js overlay blend to the browser result. Isolate by
emptying the atmosphere batch alone and re-running parity: if the frame-wide
error disappears, the wash blend is the cause.
