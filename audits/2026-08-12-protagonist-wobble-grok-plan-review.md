---
title: Grok Review of Protagonist Weighted Wobble Plan
date: 2026-08-12
reviewer: Grok 4.5 via grok-audit
effort: high
verdict: findings-reconciled
---

# Grok plan review

Grok audited the final feature plan, reviewed spec, and current movement and render call sites before implementation. It returned five concrete findings. All five were verified against the checkout and applied to the plan.

## Findings and disposition

1. High: incremental floating-point distance did not guarantee exact `32`, `64`, and `96 px` boundaries.
   - Applied: completed pure-horizontal segments now snap the presentation accumulator to the exact cardinal boundary. Strict movement tests cover all three values.
2. High: pending-target carry could leak into `resumeTarget` or yield recovery.
   - Applied: carry exists only inside the pending-target commit branch after normal replanning. Resume, yield, waiting, unreachable, cancellation, arrival, and immediate requests do not restore distance.
3. High: both existing waiting return sites must explicitly reset the field.
   - Applied: the plan names blocked-before-start and blocked-at-commit sites and requires a recovery regression test.
4. High: the live angle could freeze if the frame memo depended only on snapped foot position and walk frame.
   - Applied: raw `horizontalRunDistance` must enter the protagonist presentation and the `worldFrame` memo dependency list.
5. Medium: the character transform and smoke evidence call sites were too easy to miss.
   - Applied: the plan explicitly changes `characterAtlas` to `characterAtlasData()` and adds distance and angle to the smoke player sample from the same pure helper.

## Audit boundary

The run was read-only and tool-free. It inspected:

- `docs/plans/2026-08-12-feat-protagonist-weighted-wobble-plan.md`
- `docs/specs/2026-08-12-protagonist-weighted-wobble.md`
- `src/world/pathfinding/movement.ts`
- `src/render/atlas.ts`
- `src/render/world-frame.ts`
- `src/render/WorldScene.tsx`

It did not independently re-open every Slice 1 art file. Local repository research and the focused art tests cover that slice.
