# Phase 18 Grok map-compiler audit

Date: 2026-08-10

Scope: Phase 18 map-v2 schema, compiler, density validation, location binding, start composition, route derivation, and content validation

Model and effort: Grok, `high`, read-only wrapper

## First pass

Verdict: `FINDINGS`

Grok reported five findings. Local inspection confirmed and fixed all five.

| Finding | Disposition |
|---|---|
| An intentional-open marker could fragment the empty-space mask and hide a large unmarked void. | Fixed. The density validator now finds maximal empty rectangles before it applies exemptions. An exemption is valid only when one intentional-open area fully covers the rectangle. |
| Building-shell validation used an area rectangle instead of the authored roof interior mask. | Fixed. The flood check now uses each building's exact roof mask, including L-shaped interiors. |
| The v2 catalog derived routes but discarded them instead of comparing them with the runtime compatibility table. | Fixed. Catalog construction now returns the derived route table and fails when it differs from the compatibility table. |
| The compiler silently removed blocked authored interaction approaches when at least one approach remained. | Fixed. Every authored approach must now be walkable. The compiler still resolves a deterministic usable approach at runtime. |
| A one-cell wall opening skipped axis validation, and a door did not prove reachable floor on both sides. | Fixed. Every opening has an explicit wall axis. Door compilation also requires route-reachable floor on both sides of the wall. |

Regression coverage was added for all five cases.

## Second pass

Scope: the five corrected findings only.

Verdict: `NO_CONFIRMED_FINDINGS`

Grok found no remaining defect in intentional-open validation, exact roof-mask shell checks, derived-route compatibility, authored interaction approaches, or wall-opening and door validation.

## Final disposition

Phase 18 is ready for its full repository gate and focused PR. It adds the v2 authoring and compiler foundation without changing production v1 map geometry, runtime collision, or save data.
