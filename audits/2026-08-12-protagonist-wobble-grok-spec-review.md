# Grok 4.5 spec review: protagonist weighted wobble

Date: 2026-08-12
Model: Grok 4.5, high reasoning effort, through the logged-in grok.com subscription
Target: `docs/specs/2026-08-12-protagonist-weighted-wobble.md`
Status: completed and reconciled

## Confirmed and applied

1. The rendering contract now converts curve degrees to radians before calling `sin` and `cos` for `RSXform`.
2. Pending retarget carry now has an exact predicate and precedence relative to the normal `requestMovement` reset path.
3. A same-direction horizontal run now explicitly continues across tile segments without resetting at every `beginSegment`.
4. The standing natural-movement art gate now names the protagonist-only identical-frame exception. NPC frame-difference gates remain unchanged.
5. Acceptance tests now cover zero-angle legacy equivalence, pivot invariance at all zooms, and real pending-target carry/reset behavior.

## Coverage

Grok reviewed the revised trial spec against the standing natural-movement spec and the current movement state, motion clock, atlas presentation, world-frame placement, and Skia atlas batching code. Codex re-opened each cited path and confirmed all five findings before applying them.
