# Opus spec review: protagonist weighted wobble

Date: 2026-08-12
Model: Claude Opus through the logged-in Claude Code subscription
Target: `docs/specs/2026-08-12-protagonist-weighted-wobble.md`
Status: completed and reconciled

## Confirmed and applied

1. The protagonist must explicitly bypass the existing one-pixel lean, bounce, and shadow shift. Stable atlas pixels alone do not remove those runtime offsets.
2. Byte-identical protagonist frame pairs require a named exception to the existing lower-leg frame-difference art gate.
3. Pause must freeze the current angle and resume exactly. It must not force an upright snap.
4. The spec must include the bottom-pivot `RSXform` math and an optional character-only rotation field.
5. Same-direction retargeting and deterministic proof fields needed explicit requirements.

## Partially accepted

Opus proposed keying the wobble on horizontal translation so diagonal steps also wobble. The existing movement contract intentionally presents diagonals with front/rear art. This trial keeps diagonals upright and starts a new wobble only when a pure left/right-facing run begins. The spec now states this directly and adds coverage for mixed routes.

## Pivot decision

Opus noted that the current sprite translation places the legacy foot anchor at source row 27 while the requested doll-like pivot is source row 29. The trial keeps row 29 because it is the rounded body's physical bottom. The spec now documents the two-pixel offset, pins the transform formula, and leaves the shadow at the existing foot anchor.

## Coverage

Opus reviewed the focused spec, the existing natural-movement spec, and the current movement clock, path movement, atlas presentation, world-frame, and Skia scene paths. Codex verified each cited code path before revising the spec.
