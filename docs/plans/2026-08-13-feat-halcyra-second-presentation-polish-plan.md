---
title: "feat: Deliver Halcyra's second presentation polish"
type: feat
date: 2026-08-13
status: proposed
base_sha: 44dc266f79417ef77eb63affb83904e3a3be7281
---

# Deliver Halcyra's second presentation polish

## 1. Outcome

Make Halcyra feel like a finished 2D social simulation without adding detail for its own sake.

The pass will:

- make Sunward read as a compact resort at native `1x`;
- put real simulated people at jobs, counters, benches, and social anchors;
- give every district a clear building grammar and one focal place;
- keep the world visible during conversations;
- correct daytime neon and attach local light to authored fixtures;
- add restrained ambience, footsteps, interface sounds, and later music;
- preserve deterministic movement, saves, content, and the flat atlas runtime.

The renderer, art bible, tile sizes, and character pipeline stay unchanged.

## 2. Source synthesis

This plan synthesizes four independent reviews:

1. `.claude/worktrees/halcyra-art-bible-review-444525/docs/plans/2026-08-13-halcyra-quality-gap-improvement-plan.md`
2. `.claude/worktrees/halcyra-art-bible-review-aa8f68/docs/plans/2026-08-13-halcyra-aaa-presentation-improvement-plan.md`
3. `docs/art/2026-08-13-presentation-improvement.md`
4. `docs/art/halcyra-visual-improvement-program.md`

The score differences come from different review scopes.

- `3.5/10` used a literal AAA product comparison.
- `4.5/10` scored the whole game against the best 2D simulation games.
- `5/10` scored the game against a finished RimWorld-like island.
- `5.9/10` scored only visible presentation from controlled screenshots.
- The earlier `9.4/10` scored compliance inside a narrow art pass.

The useful baseline is about `5/10` against the actual finished-game target.

Do not use a numeric score as an implementation gate. Use the observable gates in this plan.

### 2.1 Adopt

All four reviews agree on the main diagnosis.

**Purposeful composition and visible activity matter more than new texture.**

Adopt these findings:

- Compose Sunward before expanding the atlas.
- Make rooms and outdoor spaces show one clear use.
- Use existing props in small, purposeful groups.
- Put named people at their authored jobs.
- Stop ambient residents from standing in grid rows.
- Give Saffron, Neon, and Greywake different spatial grammar.
- Keep neon and night light local.
- Keep the world visible during conversation.
- Add sound after the visual and simulation spaces settle.
- Review every change at native `1x` first.

### 2.2 Narrow

These ideas help, but need a smaller implementation.

- Keep the strong intro. Fix its time and framing mismatch only.
- Add nine roof cells, not twelve. Sunward already owns three.
- Add roof families only after Sunward passes its composition gate.
- Reuse existing prop cells before changing atlas category limits.
- Show exact quest and relationship receipts. Do not add a general alert stack.
- Use current schedules and movement. Do not build another jobs system.
- Improve attached shadows only where screenshots prove a gap.
- Use one small state-linked pose only if placement cannot show the activity.

### 2.3 Reject or defer

Do not include these items in this pass:

- 3D, perspective tilt, painted art, or larger characters;
- a renderer rewrite or a second lighting engine;
- forty new prop sprites or a raised landmark cap;
- another density validator;
- a full intro rebuild;
- new needs, mood simulation, or a RimWorld-style alert system;
- weather, critters, footprints, persistent clutter, or procedural clutter;
- new quests, new interiors, title menus, or save-slot redesign;
- camera auto-follow;
- another character redraw;
- conversation expression work, selection markers, or journal pins already on `main`.

## 3. Locked contracts

Preserve these contracts:

- fully 2D rendering;
- `32x32` world tiles;
- `24x30` world-character cells;
- `24x29` portraits;
- native `1x`, `2x`, and `3x` zoom;
- nearest-neighbor sampling and whole-pixel placement;
- one deterministic flat atlas;
- current collision, movement, transfer, and interaction rules;
- current local-model conversation transaction;
- typed conversation input and current prompt suggestions;
- current expression, selection, journal, and district-label systems;
- no audible, focused, or visible Electron test automation.

This plan creates one explicit exception to the earlier Tier B art restriction.

The exception covers:

- authored ground regions and prop placements;
- explicit terrain, wall, door, building, and roof metadata;
- map-specific `layoutRevision` changes;
- nine district roof cells.

Every geometry change must include save recovery and reachability proof.

## 4. Current facts that shape the plan

### 4.1 The atlas is not a blank budget

`assets/generated/atlas-report.json` currently reports:

- `609` cells;
- `3/32` roof cells;
- `62/64` object and landmark cells;
- `72.15%` forecast raw-area use;
- a `75%` raw-area forecast guard.

The packed `97.6%` number describes the current packed rectangle. It is not free atlas capacity.

Reuse current prop art. Spend at most nine new cells on roofs, then measure again.

### 4.2 Existing systems already cover much of the work

Reuse:

- map objects, interactions, areas, density profiles, and primary routes;
- active NPC schedules and pathfinding;
- generated work tiles for named residents;
- character rest, talk, reaction, joy, and upset frames;
- prop, character, wall, and roof-edge shadows;
- district atmosphere and local-light overlays;
- `expo-audio` and the vocal-cue preload pattern;
- responsive side-sheet sizing;
- the persisted event ledger for consequence receipts.

### 4.3 Current root causes

The main map builder still creates prototype behavior:

- `RESIDENT_POSITIONS` creates visible grid rows.
- Production schedules reuse one tile for every daily block.
- Named people have generated work tiles, but schedules ignore them.
- Only Sunward has building and roof metadata.
- Every roof uses `DEFAULT_ROOF_RECIPE`.
- Neon effects render without a time gate.
- District light pools use fixed coordinates.
- `commitPlayerTile` maps every roofed tile to `protagonist_villa`.
- Conversation covers the world with a centered dark overlay.
- The intro says `17:30`; the initial state starts at `08:00`.

## 5. Implementation order

Each phase ends with its own acceptance gate.

Do not begin the next visual phase while the current gate fails.

## 6. Phase 0: restore trustworthy evidence

### 6.1 Purpose

Make the packaged smoke prove the current interface without showing or sounding the Electron window.

### 6.2 Files

Modify:

- `electron/main/index.ts`
- `tests/electron/package-smoke.test.ts`
- focused smoke helpers or tests only when the shared driver needs them.

### 6.3 Work

1. Open Settings before querying the hidden zoom control.
2. Find the current Talk button by its accessible action, not removed IDs.
3. Create smoke windows with `show: false`.
4. Set `backgroundThrottling: false` before loading the renderer.
5. Add Chromium's `--mute-audio` switch before Electron becomes ready.
6. Call `webContents.setAudioMuted(true)` before renderer content loads.
7. Keep screenshot capture hidden with `stayHidden: true`.
8. Normalize whitespace before testing the multiline arrival title.
9. Prove the ferry is visible and cannot be boarded. Do not require stale copy.
10. Prove relationship field labels and the rendered stage value. Do not require the word `STAGE`.
11. Decode every captured PNG before reporting success.
12. Close every Electron process after success or failure.

### 6.4 Daytime neon regression

Use `worldAtmosphere()` to exclude `neon` map effects during dawn and day.

Apply the same period rule to visible-effect evidence.

Do not redesign district lighting in this phase.

### 6.5 Gate

- Every package-smoke boolean passes.
- Electron stays hidden and muted.
- Day and dawn show no neon effect emitters.
- Existing historical evidence remains byte-identical.
- New captures use a dated output folder.

## 7. Phase 1: first-play continuity and Sunward composition

### 7.1 Purpose

Make the first playable district read as a compact resort at native `1x`.

### 7.2 Files

Modify:

- `src/application/NewGameFlow.tsx`
- `src/domain/state/initial-state.ts` only if a shared start-time constant is needed;
- `scripts/content/build-map-v2.ts`
- generated `content/maps/northwest.json`
- generated `src/domain/state/generated-layout.ts`
- generated `src/world/transfers/generated-routes.ts` only if content generation changes it;
- `src/world/__tests__/map-v2.test.ts`
- `src/world/__tests__/layout-recovery.test.ts`
- `src/application/__tests__/new-game-flow.test.ts`.

### 7.3 Intro continuity

1. Make the arrival label match the real `08:00` start.
2. Keep the current copy, name form, cast silhouettes, and backdrop structure.
3. Adjust the backdrop light only enough to read as the same morning.
4. End the intro on the same Sunward focal direction as first play.

Do not rebuild the intro from world tiles. It is already one of the strongest surfaces.

### 7.4 Map revisions

Replace the single global layout revision with four explicit map revision values.

This lets each district migrate only when its geometry changes.

Bump Northwest for this phase.

### 7.5 Sunward hero route

Use the existing atlas kit in `scripts/content/build-map-v2.ts`.

1. Create one readable route from the villa through the patio, spa, market, and beach.
2. Keep main lanes two to four tiles wide.
3. Recompose the villa social room around one sofa group and one table group.
4. Recompose the patio around the existing fountain.
5. Recompose the market into two or three short stall groups.
6. Group trees and planters into edges and courtyards.
7. Replace the beach's empty edge with existing warm sand and shallow water cells.
8. Mark non-walkable water through explicit terrain solids.
9. Keep quiet lawn and sand between purposeful groups.
10. Remove any exterior prop that appears on a visible roof.

Do not move the villa's outer shell or interior walls in the first pass.

Furniture grouping should prove whether wall changes are actually needed.

If one room still fails at `1x`, move only that room's divider in a separate revisioned slice.

### 7.6 Safety rules

Keep these tiles clear:

- east and south portals;
- all staging tiles;
- all actor spawns;
- all interaction approaches;
- the villa entrance route;
- the first-play camera anchor.

Run layout recovery against an old save placed on every changed solid or region edge.

### 7.7 Gate

At native `1x`:

- the first view and intro describe the same morning;
- the villa, patio, market, spa, and beach form one readable route;
- water is visible from the public beach;
- one villa room explains its use without a label;
- the patio reads as a social room;
- the fountain is the focal landmark;
- no prop appears on a visible roof;
- no portal, spawn, door, or interaction becomes blocked;
- an old save recovers deterministically.

Stop here and compare before touching another district.

## 8. Phase 2: make people occupy the island

### 8.1 Purpose

Show real simulation state through people using authored places.

### 8.2 Files

Modify:

- `scripts/content/build-map-v2.ts`
- `src/domain/state/production-cast.ts`
- `src/domain/state/initial-state.ts`
- `src/world/schedules/schedule.ts` only if one shared selection rule is missing;
- `src/world/schedules/simulation.ts` only if the existing movement path cannot express the authored blocks;
- the smallest required state migration files;
- `src/world/__tests__/active-schedules.test.ts`
- `src/world/__tests__/movement-reservations.test.ts`
- `src/world/__tests__/layout-recovery.test.ts`
- `src/application/__tests__/first-hour.test.ts`.

### 8.3 Authored schedules

1. Use each named resident's existing `work` tile during working hours.
2. Give each named resident distinct home, work, social, and evening blocks.
3. Place work destinations beside current counters, desks, doors, or service props.
4. Initialize the `08:00` new game from the active schedule block. Do not wait for the first later milestone.
5. Mark residents on the active map `active_local` and residents on other maps `inactive`.
6. Assign ambient residents across all four districts.
7. Give each ambient resident two or three existing prop-adjacent hubs.
8. Keep all destinations as ordinary schedule blocks.
9. Use current pathfinding and transfer code.
10. Keep inactive-map movement deterministic.
11. Keep every visible resident backed by real world state.

Do not add a job entity, task queue, crowd generator, or background actor layer.

### 8.4 Save migration

Production schedules are stored in saves.

Add one versioned migration that replaces old production schedule definitions with the new authored blocks.

The migration must:

- preserve clock, relationships, memories, invitations, quests, and event history;
- recover current NPC presence and active goals through the map layout migration;
- preserve any invitation-owned goal;
- leave unrelated NPC records unchanged;
- be idempotent;
- write a valid migrated save before replacing the source.

Do not silently make this a new-game-only improvement.

### 8.5 Activity presentation

Position and facing should carry the activity first.

Reuse the current idle, talk, and reaction motion.

Add one tiny state-linked pose only if a native `1x` crop still cannot show the activity.

### 8.6 Gate

- At `08:00`, named workers appear at believable job anchors.
- At noon and evening, the same people move to different authored hubs.
- Ambient residents no longer form edge or grid rows.
- A street crop shows one real person using a prop.
- A hero crop shows several real state-backed people during ordinary hours.
- No two actors reserve the same destination.
- Every Talk approach remains reachable.
- No selectable actor is hidden beneath a visible roof.
- Reloaded and migrated saves produce the same schedule result.

## 9. Phase 3: author the other district spaces

### 9.1 Purpose

Give every district one spatial identity, one focal place, and several authored simulation rooms.

Use existing prop art first.

Complete and accept one district before starting the next.

### 9.2 Shared roof groundwork

Before adding any new roof group:

1. Replace the hardcoded `protagonist_villa` result in `src/application/runtime/world-runtime.ts`.
2. Resolve location ownership from the compiled building and location bindings.
3. Generalize the hidden-roof accessibility label in `src/render/WorldScene.tsx`.
4. Exclude actors under visible roofs from hit testing and selection.
5. Validate that building interiors and roof ownership never overlap another building.
6. Prove outside, door, inside, and outside reachability for every shell.

Add focused coverage in:

- `src/application/runtime/__tests__/world-runtime.test.ts` or the nearest existing runtime test;
- `src/world/__tests__/map-v2.test.ts`;
- `src/world/__tests__/map.test.ts`;
- `src/render/__tests__/world-frame.test.ts`.

### 9.3 Map-specific roof recipes

Extend the current recipe source and generated runtime recipe once.

Modify:

- `assets/source/art/roof-recipes.json`
- `scripts/art/art-manifest.ts`
- `src/world/presentation/recipes.ts`
- `src/world/presentation/art-presentation.ts`
- `assets/source/tiles/environment.json`
- generated atlas, index, report, recipes, and pixel baseline;
- `src/world/presentation/__tests__/art-presentation.test.ts`.

Keep Sunward's three roof cells.

Add exactly three cells for each remaining district:

- Saffron canopy and warm market roof;
- Neon dark service roof with a restrained sign edge;
- Greywake heavy civic or warehouse roof.

Select recipes by map ID. Do not add a runtime art system.

Re-run the atlas forecast after each three-cell family.

Do not raise the object and landmark cap in this phase.

### 9.4 Saffron Bazaar

1. Make Sunset Courtyard the dominant focal place.
2. Group stalls into short rows around clear customer lanes.
3. Use existing awnings and counters to frame shop entrances.
4. Separate customer space from one delivery edge.
5. Put sellers, buyers, and diners at matching schedule hubs.
6. Remove evenly spread ground marks that do not explain use.
7. Add roof and building metadata only to completed shells.

### 9.5 Neon Crescent

1. Replace four identical hall readings with two or three distinct street fronts.
2. Give each venue one readable sign and one worn entrance.
3. Keep walls and pavement mostly neutral.
4. Remove the floor-confetti look.
5. Form short queues and guarded thresholds from real residents.
6. Keep a service alley and a hidden-service entrance.
7. Add small local light pools only after fixture placement is final.
8. Add roof and building metadata only to completed shells.

### 9.6 Greywake Harbor

1. Preserve heavy rectangles and wide operational lanes.
2. Separate the ferry route from the cargo route.
3. Group existing crates, bollards, benches, counters, and cargo by task.
4. Use the crane, ferry face, or warehouse frontage as the focal mass.
5. Put workers at cargo anchors and passengers at terminal anchors.
6. Keep the water calm and the pier readable.
7. Add roof and building metadata only to completed shells.

### 9.7 Per-district gate

Each district must pass before the next starts.

- A HUD-free `1x` crop is identifiable within two seconds.
- One focal place dominates the crop.
- Two to four prop groups explain how the place works.
- One clear route crosses the crop.
- At least one real person uses the place.
- Entrances read at `1x`.
- Roofs hide on entry and restore on exit.
- Actors under visible roofs cannot be selected.
- Old saves keep a valid district, location, and walkable tile.
- Atlas forecast remains inside every guard.

## 10. Phase 4: make conversation feel like a meeting

### 10.1 Purpose

Reduce the debug-transcript feel while preserving free conversation and deterministic consequences.

### 10.2 Files

Modify:

- `src/ui/ConversationPanel.tsx`
- `src/render/responsive-layout.ts`
- `src/ui/SelectedCharacterCard.tsx`
- `src/ui/selected-character.ts`
- `src/ui/JournalPanel.tsx`
- `src/render/WorldScene.tsx`
- focused UI and conversation tests.

### 10.3 Work

1. Dock conversation as a side sheet on wide desktop surfaces.
2. Keep the current compact modal on small surfaces.
3. Keep the world visible and preserve the selected person's position.
4. Keep the current portrait expressions and prompt suggestions.
5. Show the public job and one player-known fact.
6. Never expose private biography as a known fact.
7. Replace technical model status copy with player-facing waiting copy.
8. Keep a short recent transcript and the current typed input.
9. Use the existing portrait or talk motion during first-token wait.
10. Collapse the protagonist's self card when no special action needs it.
11. Keep full detail for selected residents and active events.
12. Raise a shared `uiMetrics` text size only where the desktop screenshot gate proves it is too small.

### 10.4 Consequence receipts

Read the existing persisted `linda-quest-resolved` event from `eventLedger`.

Show its exact:

- reason;
- relationship deltas;
- faction delta;
- reward;
- health and time changes;
- police transition.

Render the receipt in the Journal and immediate result plate.

Do not add a new event feed, needs system, or consequence store.

### 10.5 Gate

- The world remains visible during desktop conversation.
- The speaker's face, name, public job, and current activity read immediately.
- Typed input and suggestions still work.
- Rest, joy, and upset expressions still respond to returned emotion.
- Technical model copy is absent from the player surface.
- A resolved quest shows exact persisted changes after reload.
- `1280x720` and `1600x900` keep readable text and world context.

## 11. Phase 5: quiet light and audio polish

### 11.1 Purpose

Add atmosphere only after authored spaces and fixture positions stop moving.

### 11.2 Map-driven local light

Modify:

- `src/render/district-lighting.ts`
- `src/render/DistrictLightingOverlay.tsx`
- `src/render/WorldScene.tsx`
- `src/render/__tests__/district-lighting.test.ts`.

Work:

1. Derive light emitters from compiled lamp, neon, fire, and sign parts.
2. Use an explicit sprite allowlist.
3. Do not treat every sign as a lamp.
4. Keep pools off during dawn and day.
5. Use small pools during dusk and night.
6. Hide interior pools while their roof is visible.
7. Preserve the upper-left light direction.
8. Keep existing prop and wall grounding shadows.

Do not add shaders, bloom, weather, or a new lighting data model.

### 11.3 Audio foundation

Reuse `expo-audio` and the existing vocal-cue lifecycle.

Modify:

- `src/application/presentation/preferences.ts`
- `src/application/DesktopBridge.ts`
- `electron/persistence/presentation-preferences.ts`
- `electron/persistence/presentation-preferences-ipc.ts`
- `src/audio/vocal-cues.ts` or one small sibling world-audio module;
- `src/ui/Hud.tsx`
- `src/render/WorldScene.tsx`
- focused audio policy and preference tests.

Add:

- a persisted master mute;
- separate ambience, effects, and music levels;
- user-gesture startup;
- one district ambience loop at a time;
- material footsteps from compiled ground ownership;
- quiet interface, door, save, and consequence cues;
- app-hidden pause;
- duplicate-loop prevention;
- district and time crossfades.

Add music only after ambience looping, mute, lifecycle, and crossfades pass.

Preserve meaningful audio captions without repeating ambience captions every loop.

### 11.4 Required audio assets

**Halcyra Core Audio Pack**

- Four seamless district ambience loops.
- Four footstep materials with three variations each.
- Soft click, confirm, panel open, panel close, door, save, and consequence cues.
- Five seamless music loops: menu plus four districts.
- No spoken words.
- Mono short effects. Stereo ambience and music.
- Provide lossless masters and exact loop points.

District direction:

- Sunward: surf, palms, distant neighborhood life.
- Neon: traffic wash, distant bass, glass, and electrical hum.
- Saffron: soft market murmur, cloth, dishes, and movement.
- Greywake: gulls, rope strain, hull creaks, and water.

### 11.5 Gate

- Day and dawn have no local neon pools.
- Dusk and night pools align with visible fixtures.
- Roofs block hidden interior light.
- Master mute persists across restart.
- No loop starts before user input.
- Only one district ambience loop plays.
- Hiding the app pauses loops.
- Footsteps match the compiled ground material.
- Crossfades never cut or double-play.
- Smoke automation remains inaudible.

## 12. Verification plan

### 12.1 Focused checks after every map slice

Run:

```bash
npm run content:check
npm run validate:content
npm run art:check
npm run typecheck
npm test -- --runInBand
```

Add focused tests beside changed systems before the full suite.

### 12.2 Build checks

Run:

```bash
npm run export:web
npm run test:electron:unit
npm run package:electron
```

Run `npm run verify:ci-build` before final packaged qualification.

### 12.3 Screenshot acceptance

Use the current headless web harness routes.

Do not run `npm run dev:harness` for routine proof.

For each accepted district, capture:

- the same camera and time before and after;
- one HUD-free native `1x` hero view;
- one `3x` crop of a door, face, and focal place;
- one room whose furniture explains its use;
- one street where a real person uses a prop;
- `1280x720` and `1600x900` UI views;
- day, dusk, and night lighting evidence where relevant.

Check every hero view in color and grayscale.

Ask:

1. Can the district be named within two seconds?
2. Can the main route be found within two seconds?
3. Can the important person or event be found within two seconds?
4. Is the place's use clear without its label?
5. Does the view still have quiet space?

Reject a view that still reads as four boxes or an empty yard.

### 12.4 Final packaged check

Run the repaired hidden and muted packaged smoke.

Then prove:

- new game;
- Sunward first play;
- all four districts;
- roof entry and restore for every district;
- one full schedule day;
- conversation and exact consequence receipt;
- restart with migrated save;
- mute and audio lifecycle;
- no focused, visible, or audible Electron window.

## 13. Delivery slices

Keep each change reviewable.

1. Trust gate and daytime neon.
2. Intro continuity and Sunward composition.
3. Schedule migration and occupied Sunward proof.
4. Saffron composition and roof.
5. Neon composition and roof.
6. Greywake composition and roof.
7. Conversation and consequence receipt.
8. Map-driven light and audio foundation.
9. Music and final qualification.

Do not merge a slice with a failed native `1x` gate.

## 14. Definition of done

This program is complete when:

- all four districts pass the same native `1x` review;
- the first playable view matches the intro's time and promise;
- rooms and outdoor spaces show clear uses;
- named people work at their authored businesses;
- ambient residents move among real prop anchors;
- no resident grid remains;
- district identity comes from mass, routes, and use, not palette alone;
- every completed shell owns working roof metadata and a district recipe;
- conversation keeps the world visible and shows exact consequences;
- local light follows fixtures and time;
- audio respects mute, lifecycle, captions, and district changes;
- old saves migrate safely;
- headless and hidden packaged evidence passes;
- no rejected system or style expansion entered the diff.
