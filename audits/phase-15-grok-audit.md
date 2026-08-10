# Phase 15 Grok audit

Date: 2026-08-10

Model: Grok 4.5 subscription CLI

Mode: read-only, high effort, named evidence files

## Scope

The audit covered the Phase 15 RimWorld-relative scale, current map-density, collision, starting-camera, and desktop display-use measurements. Exact SI World claims were checked against the renderer, camera, atlas, initial state, production cast, map compiler, all four map JSON files, Electron window configuration, and committed Phase 14 screenshot dimensions.

The RimWorld screenshot was not included in the Grok evidence pack because its original local path was no longer present. Its values remain explicitly approximate visual bands in the measurement report.

## First audit findings

Grok reported five measurement defects. All were accepted or clarified with additional source evidence.

1. The field-of-view comparison used optional `1×` without stating that play starts at `2×`.
   - Fix: report all three fields of view and identify `2×` as the default.
2. The initial visible-density denominator used `1×` capacity instead of the actual `2×` start.
   - Fix: calculate the exact starting camera at `312,437`, its `169.5` cell-equivalent area, and its protagonist, three solid props, zero active NPCs, and zero effects.
3. The report's `34` NPC statement looked one too high when checked only against map spawns.
   - Clarification: the map has 33 NPC spawns plus the protagonist. `createInitialState` adds Linda's inactive boyfriend, producing 34 runtime NPC records plus the protagonist. The report now states both counts and sources.
4. The `3×6` bathroom did not fit the approximate reference room band, and the `16×16` roof interior was called fully walkable.
   - Fix: mark the bathroom as a below-band service-space exception. Rename the area to the interior footprint and record its 31 internal-wall cells. Six solid props occupy 2.34% of the full footprint or 2.67% of its 225 non-wall cells.
5. The `1280×688` Phase 14 screenshot size was mixed with source-level facts.
   - Fix: label it as artifact-derived platform evidence. Keep `1280×720` as the source-defined initial Electron window.

## Final audit

The post-fix Grok 4.5 audit returned `NO_CONFIRMED_FINDINGS`.

It verified:

- `35×19.375` cells at `1×`, `17.5×9.6875` at default `2×`, and about `11.67×6.46` at `3×`;
- the `312,437` initial camera and its visible protagonist, three solid props, zero active NPCs, and zero effects;
- 34 runtime NPC records plus the protagonist, including the inactive boyfriend at `25,28`;
- six villa props across 256 interior-footprint cells and 31 internal-wall cells;
- blocked-cell totals of `105`, `2`, `2`, and `580` across the four maps;
- the `1126×626` fixed-frame display percentages;
- the separation of character-to-cell scale from camera field of view;
- the decision to leave responsive behavior and density thresholds to Phase 16.

No game code or player-visible behavior changed in Phase 15.
