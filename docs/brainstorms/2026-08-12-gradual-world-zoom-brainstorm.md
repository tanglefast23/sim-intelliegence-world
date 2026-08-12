---
date: 2026-08-12
topic: gradual-world-zoom
---

# Gradual World Zoom

## What We're Building

Replace the three player-facing world-zoom presets with controlled zoom from
`100%` through `300%` in `10%` increments. The mouse wheel zooms around the
pointer. The visible control has decrease and increase buttons plus the exact
current percentage. The explicit choice persists across resize, map changes,
restarts, and compatible preference loads.

## Why This Approach

Arbitrary floating-point zoom offers no useful player control beyond a small
step size and makes persistence and tests unstable. DPR-aware steps keep more
scales pixel-perfect, but change the available choices between displays. Fixed
`10%` steps provide faster, predictable control on every supported display.

## Key Decisions

- Range: keep the existing `100%` to `300%` limits.
- Input step: change zoom by `10%` per wheel or button action.
- Compatibility: continue loading earlier saved values on `5%` boundaries.
- Input: wheel changes one step per rendered frame and stays pointer-anchored.
- Buttons: decrease and increase one step around the viewport center.
- Rendering: keep nearest-neighbor atlas sampling.
- Art QA: retain `1x`, `2x`, and `3x` as canonical crispness and evidence
  points. Fractional runtime scales can repeat or skip physical pixels.
- Persistence: extend the existing presentation preference contract without
  changing deterministic save or replay state.

## Open Questions

- None for this implementation.
