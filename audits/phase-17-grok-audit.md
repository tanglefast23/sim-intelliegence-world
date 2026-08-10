# Phase 17 Grok implementation-plan audit

Date: 2026-08-10

Plan: `docs/plans/2026-08-10-feat-world-readability-responsive-collision-plan.md`

Model and effort: Grok, `high`, read-only wrapper

## First pass

Verdict: `FINDINGS`

Grok reported five findings. Local inspection confirmed all five.

| Severity | Finding | Disposition |
|---|---|---|
| critical | The old order merged final v2 map geometry before save layout recovery. Existing saves could load into new solids. | Fixed. Phase 19 now adds atlas capability without changing geometry. Phase 20 atomically merges final maps, runtime collision, state v6, and load-time recovery. A cutover test blocks revision changes without recovery. |
| high | Recovery was described mainly as v5-to-v6 migration, so a stale v6 save after a future layout change could skip relocation. | Fixed. Every accepted save runs layout-revision comparison. Missing, zero, or lower revisions use the same pure recovery transaction before state is returned. |
| high | The inactive-NPC row used a destination binding instead of the NPC's current `locationId` binding. | Fixed. Active and inactive actor positions can relocate only inside their current compiled location binding. Goal and transfer fields use their separate identities. |
| high | Phase 22 required responsive evidence fields that Phase 21 did not expose through one readiness authority. | Fixed. Phase 21 now adds a stable active-canvas ID and one readiness DTO with surface, coverage, DPR, backing, zoom, UI, camera, minimum sizes, panel/input rectangles, roof state, and overflow. |
| medium | Actor relocation did not explicitly reject reserved portal, interaction, and staging cells. | Fixed. Phase 20 now requires the exclusion algorithm and fixtures while preserving exact portal-identity recovery. |

## Second pass

Scope: the five corrected findings only.

Verdict: `NO_CONFIRMED_FINDINGS`

Grok found no remaining mismatch or new contradiction caused by the fixes.

## Final disposition

The implementation plan is ready to merge. It keeps every merged `main` compatible with supported saves and preserves the required Grok-audit, focused-PR, green-CI, squash-merge, and exact-SHA protocol for Phases 18 through 22.
