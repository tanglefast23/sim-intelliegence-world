# Phase 16 Opus 5 and Grok review

Date: 2026-08-10

Target: `docs/specs/2026-08-10-world-readability-collision-responsive.md`

Status: complete; final Grok clean gate passed

## Review controls

- Opus ran read-only through the logged-in Claude subscription with `--model opus`.
- The structured usage result identified the actual model as `claude-opus-5`.
- Grok ran read-only through the logged-in Grok subscription with `grok-4.5` and high reasoning effort.
- Both reviewers received bounded local evidence. Neither reviewer could edit the repository.
- Codex checked each reported issue against the specification and relevant source before accepting it.

## Opus 5 findings and resolution

All five Opus findings were confirmed.

1. The save did not persist map layout revisions. The specification now requires world-state schema v6, per-map saved revisions, a v5 default of revision `0`, and a compatible content-version load path.
2. Saved schedule and transfer destinations were outside relocation coverage. The specification now validates and recovers schedule goals, schedule blocks, transfer entrances, transfer goals, and other saved destinations.
3. One visible object part could hide several solid footprint tiles. The specification now requires visible render-part coverage for every non-terrain solid tile and counts only visible parts toward detail coverage.
4. Automatic zoom used an undefined normalized-distance rule. The specification now gives the exact formula, resize behavior, and tie rule.
5. The existing frame-rate gate did not cover the larger responsive surface. The specification now adds a `2560×1440`, DPR `≥2`, selected `1×` maximum-load check with the rounded `60 FPS` threshold.

Two lower-severity risks were also closed: actor relocations cannot claim the same tile, and roof groups can represent non-rectangular shells.

## Grok 4.5 findings and resolution

The first Grok pass found five confirmed gaps.

1. Destination recovery had no `locationId` geometry authority. Map schema v2 now compiles explicit location bindings.
2. Starting composition had no deterministic pan or co-visible set. Sunward now declares a start anchor and required actors, details, and landmark areas.
3. The current map revision source was undefined. Every map v2 now owns a positive `layoutRevision` with explicit bump rules.
4. Density profiles and open-area exceptions had no schema fields. Every area now declares its own profile and optional intentional-open rectangles.
5. The `1280×720` row conflicted with fixed margins and a literal `40×22` field. Acceptance now records the exact result of the specified formula from the measured surface.

The second Grok pass found three confirmed recovery and responsive gaps.

1. Transfer entrance tiles did not recover from stable portal identity. The migration now rewrites them from `destinationEntranceId`.
2. Actor relocation could leave tile and `locationId` inconsistent. Actor search now stays inside the existing compiled location binding.
3. Start composition was tested at an unspecified surface. It is now required at every automatic-zoom matrix target, including both `1×` and `2×` results.

The third Grok pass found one confirmed transfer-origin gap. An approaching transfer stores its origin exit in the NPC `scheduleGoal`. The specification now rewrites that goal from `edgePortalId` and never sends it through location-binding recovery.

## Final clean gate

The final bounded Grok 4.5 audit reviewed the specification, state models, and active transfer movement. Result: `NO_CONFIRMED_FINDINGS`.

Its coverage confirmed that:

- `edgePortalId` rewrites the approaching NPC's travel `scheduleGoal`;
- `destinationEntranceId` rewrites the saved destination entrance tile;
- location bindings apply only to location-scoped goals;
- missing transfer, NPC, travel-goal, or portal identities fail without overwriting the old save.

No implementation claim is made in Phase 16. Implementation sequencing and executable proof belong to the next phase.
