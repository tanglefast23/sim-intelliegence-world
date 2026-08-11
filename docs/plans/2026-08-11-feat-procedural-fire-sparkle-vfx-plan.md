---
title: "feat: Add procedural fire and sparkle VFX"
type: feat
date: 2026-08-11
status: implemented-verified
branch: codex/skia-procedural-vfx
spec: docs/specs/2026-08-11-skia-procedural-vfx.md
audit: audits/2026-08-11-skia-procedural-vfx-spec-council-audit.md
---

# Add procedural fire and sparkle VFX

## Overview

Replace the current simple fire and sparkle circles with deterministic, pixel-first procedural Skia marks at the six existing authored map anchors. Keep the current world layer order, map schema, simulation, save schema, presentation preferences, and character atlas unchanged.

This is the first production VFX vertical slice. It proves stable recipe geometry, a pause-aware ambient clock, batched Skia drawing, reduced motion, circle rollback, native `1x` readability, and packaged performance before weather or event VFX begins.

## Research summary

- Current maps already contain two `fire` and four `sparkle` anchors validated by `src/world/maps/schema.ts:181` and authored in `scripts/content/build-map-v2.ts:380`, `scripts/content/build-map-v2.ts:442`, `scripts/content/build-map-v2.ts:468`, and `scripts/content/build-map-v2.ts:503`.
- `WorldScene` already culls visible effect anchors and renders them in the existing `effect` layer at `src/render/WorldScene.tsx:813` and `src/render/WorldScene.tsx:903`.
- Stable length-prefixed tuple hashing already exists at `src/world/presentation/material-selection.ts:31`.
- Operating-system reduced motion already resolves through `src/application/accessibility.ts:35`.
- The installed `@shopify/react-native-skia` 2.6.2 provides `usePathValue`, and React Native Reanimated provides frame callbacks and shared values.
- Existing art-mode comparison requires both modes to stay at or above `60 FPS`, enhanced median frame time to stay within `10%`, and no more than one added static atlas batch (`scripts/electron/art-mode-performance.ts:16`).
- No `docs/solutions/`, repository `AGENTS.md`, repository `CLAUDE.md`, or repository `README.md` exists. The adjacent art, movement, responsive, and save specifications are the relevant local guidance.

External framework research is not required. The installed package source and existing repository patterns define the needed API and constraints.

## Locked rules

1. Use React Native Skia only. Do not add Three.js, another canvas, or another camera.
2. Do not modify domain events, domain state, reducers, RNG, save data, map schemas, or presentation-preference schemas.
3. Use only the six existing authored `fire | sparkle` points.
4. Keep `WORLD_LAYER_ORDER` and the single character `Atlas` unchanged.
5. Add a non-persisted `circle | procedural` VFX-only qualification switch. Keep enhanced ground art fixed in both runs. The current simple circles are the rollback and comparison path.
6. Use `stableTupleHash()` with `vfxRevision`, map ID, effect ID, kind, tile anchor, and recipe ID. Do not use `Math.random()` or wall-clock reads in pure VFX modules.
7. Advance ambient age from explicit bounded elapsed time. Clamp each delta to `50 ms`. Freeze age when `effectiveSpeed()` is `0` or during application suspension.
8. World speed `1` and `2` use the same real presentation rate. Speed `0`, conversation pause tokens, and transition pause tokens freeze ambient age. Journal or relationship panels without a pause token do not freeze it.
9. Use one stable renderer component and a fixed small number of batched Skia path nodes. Do not create one React component per flame lick, ember, ray, or satellite.
10. Reduced motion uses static, readable primary marks. It does not briefly show full motion on first paint.
11. The primary fire and sparkle shapes must be readable at native `1x` without blur.
12. The `effect` draw count remains the number of visible authored anchors. Keep the strict responsive evidence schema unchanged and publish separate strict VFX evidence.
13. New game, load, renderer remount, and map entry start at deterministic age `0` for that map. Camera pan, zoom, resize, culling, panel changes, and reduced-motion changes do not reset age.
14. Cull by complete declared effect bounds, not only the anchor. One invalid recipe falls back to the current circle for that emitter; it cannot remove other emitters or blank the canvas.

## Player-visible behavior

### Fire

- Keep the exact patio and bar anchors.
- Draw a hard warm core and a darker/orange stepped outer lick.
- Use at most a few sparse ember pixels inside a small bounded area.
- Use a restrained hard-edged halo or expanded low-alpha mark; no full-screen or wall-crossing shader.
- Standard motion changes the flame shape at a deliberate stepped pixel-art rate.
- Reduced motion uses one static seeded flame silhouette and no ember travel.

### Sparkle

- Keep the exact beach, club, mall, and harbor anchors.
- Draw a crisp cross or diamond primary mark.
- Add sparse seeded satellite pixels or short rays inside a small bounded area.
- Standard motion uses a slow stepped pulse. It must not flicker faster than three changes per second.
- Reduced motion uses one static seeded primary mark with no satellite travel.

### State changes

- Pause: geometry stays byte-identical while effective speed is `0`.
- Resume: age continues from the frozen value; the first delta is clamped.
- Zoom, pan, or resize: placement changes with the camera, but seed and phase do not reset.
- Map transition: use the destination map's authored anchors and semantic seeds; do not retain source-map geometry.
- New game, load, renderer remount, and map entry: start the current map at deterministic presentation age `0`.
- Culling and re-entry: keep the map age; an emitter that re-enters the viewport samples the current phase and does not restart.
- Application suspension: submit `0 ms` on the first resumed frame, then clamp later submitted deltas to `50 ms`.
- Circle mode: render the current circles exactly and run no procedural driver work.

## Technical design

### Pure recipe modules

Create focused platform-free modules under `src/render/vfx/`:

- `types.ts` — immutable recipe, seeded parameters, clock, geometry, and diagnostic types.
- `seed.ts` — calls the existing `stableTupleHash()` and expands a seed into bounded recipe parameters without random state.
- `clock.ts` — advances a presentation age from explicit delta and running/suspended flags with the `50 ms` clamp.
- `procedural-effects.ts` — builds deterministic fire and sparkle primitives for a semantic effect and sampled elapsed time.
- `evidence.ts` — strict version-1 VFX evidence with mode, age step, visible/culled emitters, primitive counts, update rate, reduced motion, and VFX revision.

Pure geometry uses world-pixel coordinates around the tile center. It returns bounded line/rect/path primitives and primitive counts. It does not import React, React Native, Skia, Reanimated, the DOM, domain reducers, or wall-clock APIs.

### Skia renderer

Create `src/render/vfx/ProceduralMapEffects.tsx`:

- receive visible authored effects, map ID, zoom, camera translation, reduced-motion state, and effective running state;
- keep elapsed presentation age in one Reanimated shared value updated by one frame callback;
- use `usePathValue` or an equivalent shared-path hook to rebuild a fixed set of fire and sparkle paths below parent React state;
- clamp frame delta before adding it to age;
- stop updating in circle mode by not mounting this component;
- return a fixed small set of Skia path nodes grouped in the existing effect pass;
- attach no pointer or accessibility target because VFX is not the only signal for game state.

The first frame after a frame-callback suspension submits `0 ms`. Later deltas clamp to `50 ms`. The worklet-side path formula must match the pure sampled geometry contract. If sharing the same function is not safe under the Reanimated worklet compiler, keep a small worklet renderer and compare its named samples against pure fixtures. Do not duplicate semantic decisions.

### WorldScene integration

Change the current smoke-mode configuration and `src/render/WorldScene.tsx` only at existing qualification/effect seams:

- keep `visibleEffects` culling;
- add a non-persisted `SI_WORLD_VFX_MODE=circle|procedural` bridge value beside the current art-mode smoke setting;
- keep enhanced ground art fixed while VFX mode changes;
- keep current circles when VFX mode is `circle`;
- render `ProceduralMapEffects` when VFX mode is `procedural`;
- pass `effectiveSpeed(runtime.worldState.clock) > 0`, reduced motion, a map-entry identity, map ID, camera zoom, and the existing camera translation; do not use raw selected speed;
- reset shared ambient age and last-frame state to `0` when the map-entry identity changes; camera, visibility, and UI changes do not change that identity;
- replace anchor-only visibility with complete effect-bounds intersection while retaining a bounded culling margin;
- preserve `drawCounts.effect === visibleEffects.length` as the existing logical authored-item count, not as a Skia node count;
- preserve `staticBatchCount` and every non-effect world draw count;
- publish separate strict `world-vfx-state` evidence without changing responsive evidence schema version `1`.

Procedural mode uses hybrid failure isolation. Validate and sample each visible emitter before batching. Omit only invalid emitter IDs from procedural paths and render those IDs through the existing circle branch. Other procedural emitters continue. Record failed IDs in bounded development evidence.

Add one package fixture that centers and captures all six exact anchors in both VFX modes:

- `northwest_residential`: `patio-fire` at `27,32` and `beach-sparkle` at `50,40`;
- `northeast_downtown`: `club-sparkle` at `19,11` and `bar-fire` at `45,34`;
- `southwest_commercial`: `mall-sparkle` at `17,16`;
- `southeast_docks`: `harbor-light` at `42,29`.

## Implementation tasks

### 1. Deterministic contracts

- [x] Add `src/render/vfx/types.ts` with immutable input, clock, geometry, and diagnostic types.
- [x] Add `src/render/vfx/seed.ts` using the existing length-prefixed stable tuple hash.
- [x] Add `src/render/vfx/clock.ts` with explicit delta, `50 ms` clamp, pause, resume, and suspension behavior.
- [x] Add `src/render/vfx/procedural-effects.ts` with bounded fire and sparkle sample geometry.
- [x] Add `src/render/vfx/evidence.ts` with a separate strict version-1 VFX evidence record.
- [x] Add a unit fixture for the exact six-anchor catalogue.
- [x] Add unit tests for exact seed output, sample geometry at `0`, `50`, `250`, `500`, and `1,000 ms`, full bounds, primitive ceilings, pause/resume, reduced motion, and absence of runtime randomness.
- [x] Add pure assertions that distinct standard-motion steps are at least `333 ms` apart and fire/sparkle primary silhouettes differ without color.

### 2. Batched Skia component

- [x] Add `src/render/vfx/ProceduralMapEffects.tsx` with one shared ambient clock and fixed batched path families.
- [x] Keep first-paint reduced motion static.
- [x] Add a structural renderer test that rejects per-primitive React mapping, timers, `Math.random()`, and wall-clock reads.
- [x] Verify that path updates stop while paused, first resume submits `0 ms`, and circle mode does not mount the procedural component.
- [x] Verify that render-node count stays constant as visible-emitter count changes.

### 3. WorldScene integration

- [x] Replace only the enhanced effect circles in `src/render/WorldScene.tsx`.
- [x] Add the non-persisted VFX-only circle/procedural switch while keeping enhanced ground art fixed.
- [x] Keep existing circles as per-emitter fallback and replace anchor-only culling with full-effect bounds.
- [x] Preserve `WORLD_LAYER_ORDER`, character atlas batching, responsive evidence schema, and non-effect draw counts.
- [x] Add integration or structural tests for VFX mode, camera placement, zoom, speed `0/1/2`, panels, conversation/transition pause tokens, suspension, reduced motion, culling/re-entry, map replacement, load, and remount.
- [x] Prove map-entry identity resets destination geometry to the exact age-`0` fixture without retaining source-map paths.
- [x] Prove one invalid emitter uses its circle fallback while valid emitters remain procedural.

### 4. Live and packaged proof

- [x] Run targeted VFX, world-frame, presentation, and VFX-mode performance unit tests.
- [x] Run import-boundary checks, typecheck, content checks, and the full Jest suite.
- [x] Export and package Electron from the feature branch.
- [x] Add a package fixture that centers and captures all six authored anchors.
- [x] Add `scripts/electron/vfx-mode-performance.ts` and focused tests for the `60 FPS` and `1.10x` VFX-only gates.
- [x] Add `scripts/electron/run-procedural-vfx-package-smoke.ts` and `tests/electron/procedural-vfx-smoke.test.ts` for six-anchor and maximum-load proof.
- [x] Capture procedural and circle fire/sparkle frames with enhanced ground art fixed at `1x`, `2x`, and `3x` with matching map, camera, window, and DPR inputs.
- [x] Capture standard, reduced-motion, paused, and resumed states.
- [x] Generate grayscale or luminance-only `1x` proof and fail when fire and sparkle primary silhouettes are not distinguishable.
- [x] Run the packaged VFX-only comparison with maximum load.
- [x] Record real FPS, median frame ratio, draw counts, package provenance, and any unrun Windows evidence.
- [x] Update each completed checkbox in this plan.

## Acceptance criteria

### Functional

- [x] All two fire and four sparkle anchors render at their existing authored positions.
- [x] Enhanced fire and sparkle are visibly procedural and remain subordinate to characters and interaction UI.
- [x] Circle mode renders the prior fallback with enhanced ground art unchanged.
- [x] Pause freezes geometry and resume does not jump by more than one clamped step.
- [x] Zoom, pan, resize, panel, conversation, culling/re-entry, and reduced-motion changes do not reset or misplace effects.
- [x] New game, load, renderer remount, and map entry use deterministic age `0` and remove old-map geometry before destination drawing.
- [x] Reduced motion is static from first paint and preserves the primary mark.

### Determinism and safety

- [x] Identical map/effect/recipe/time/reduced-motion inputs return identical geometry bytes.
- [x] Different effect IDs produce stable distinct phases without using frame order.
- [x] No VFX code reads `Math.random()`, `Date`, `performance.now()`, domain RNG, or save state.
- [x] Domain command traces and final `WorldState` are unchanged between circle and procedural VFX modes.
- [x] No world-save, map-schema, preference-schema, event-schema, or layout-revision change exists.

### Rendering and performance

- [x] Primary marks are crisp and readable at native `1x`.
- [x] The current seven-layer order and single character atlas are unchanged.
- [x] Enhanced mode uses a fixed small number of batched path nodes and no per-primitive React component.
- [x] Responsive evidence keeps all existing strict fields; separate VFX evidence reports mode, age step, visible/culled emitters, primitive counts, update rate, reduced motion, and VFX revision.
- [x] `drawCounts.effect` remains the logical visible authored-anchor count; VFX evidence separately records actual fixed render-node counts.
- [x] Circle and procedural packaged maximum-load runs with enhanced ground art fixed each report at least rounded `60 FPS`.
- [x] Procedural median frame time is no more than `1.10x` the matching circle run.
- [x] The enhanced path adds no static atlas batch and causes no recurring allocation spike attributable to ordinary fire/sparkle animation.

### Accessibility and visual review

- [x] No effect changes more than three times per second in reduced-risk standard motion.
- [x] Pure tests prove successive distinct standard-motion geometry steps are at least `333 ms` apart.
- [x] Reduced motion has no traveling ember or satellite animation.
- [x] Fire and sparkle primary silhouettes remain distinguishable in unit geometry and packaged grayscale proof.
- [x] Effects do not obscure faces, doors, routes, HUD text, conversation text, focus rings, or pointer targets.
- [x] Every screenshot records commit, package, map, camera, zoom, DPR, window size, art mode, reduced-motion mode, and VFX revision.

## Risks and controls

| Risk | Control |
|---|---|
| Reanimated worklet cannot call the shared pure recipe | Keep semantic seed/parameters pure, keep the worklet formula small, and compare named samples in tests |
| Pixel animation looks noisy | Limit standard motion to a stepped rate and review native `1x` before package expansion |
| Parent React rerenders each frame | Keep age in one shared value inside `ProceduralMapEffects`; do not call parent state setters |
| Phase resets on UI changes | Do not key the renderer by camera, panel, or conversation state; test all three transitions |
| Art-mode comparison hides VFX cost | Add a VFX-only non-persisted switch and keep enhanced ground art fixed in both runs |
| Edge culling cuts a flame or halo | Declare complete recipe bounds and test partial viewport overlap |
| One bad recipe blanks all effects | Fall back to the current circle for only that emitter |
| Dynamic paths exceed performance gate | Reduce secondary embers/rays first; preserve the hard primary mark |
| Circle rollback drifts | Keep the existing circle branch unchanged and compare both modes in the same package |

## Explicit deferrals

- Rain, splashes, wet shimmer, neon, smoke, dust, foam, wakes, paper, leaves, new electrical conditions, and heat distortion.
- Runtime shaders, material capability metadata, and compiler-owned outdoor/water/light masks.
- Event-ledger cursor, event anchors, Linda violence, police, social, quest, evidence, stress, and intoxication VFX.
- Character-interleaved depth effects and atlas splitting.
- VFX preference persistence and settings UI.
- Any world-save, domain event, gameplay weather, damage, stealth, collision, or AI change.

## Verification commands

Run from the VFX worktree:

```bash
npm ci
npm test -- --runInBand --runTestsByPath src/render/vfx/__tests__/clock.test.ts src/render/vfx/__tests__/procedural-effects.test.ts src/render/__tests__/world-frame.test.ts src/world/presentation/__tests__/art-presentation.test.ts scripts/electron/__tests__/vfx-mode-performance.test.ts tests/electron/procedural-vfx-smoke.test.ts
npm run check:boundaries
npm run typecheck
npm run content:check
npm test -- --runInBand
npm run package:electron
npx tsx scripts/electron/run-procedural-vfx-package-smoke.ts --compare-vfx-modes --include-maximum-load --qualification --output-root artifacts/phase-31/procedural-vfx
npm run smoke:electron
```

Run `npm run verify` after targeted and packaged checks pass. Report Windows package proof separately if it cannot run on this macOS host.

## Implementation evidence

Implemented and verified on macOS arm64 on 2026-08-11.

- The packaged renderer uses one platform `requestAnimationFrame` driver to update a Reanimated shared age. The initial Reanimated frame-callback prototype stayed at age step `0` in the packaged web renderer, so it was replaced after the live smoke gate caught the defect.
- Continuous age updates do not rebuild paths. Seven fixed batched Skia paths read a sampled shared age that changes only every `334 ms`.
- Sparkle uses one dark batched backing cross under its bright primary cross. This was added after native `1x` and `3x` review showed weak contrast on the beach ground.
- `npm run verify` passed with 60 suites and 483 tests, plus package, world, natural-movement, responsive, high-DPI, presentation-restart, and save-migration smoke runs.
- Final procedural-VFX package smoke captured 82 PNG files: six anchors at three zooms across four mode/motion combinations, paused/resumed proof, and two grayscale proofs.
- Circle standard: rounded `120 FPS`, `8.3 ms` median frame time, one visible circle node at the maximum-load anchor.
- Procedural standard: rounded `120 FPS`, `8.3 ms` median frame time, seven fixed path nodes, age step `3` before pause, age step `3` after pause and immediate resume.
- Procedural-to-circle median ratio: `1.0x`; required maximum: `1.1x`.
- Matched package inputs: enhanced presentation `c366a71c`, content `1280x720`, DPR `2`, and the same package payload.
- Evidence report: `output/verification/procedural-vfx/procedural-vfx-package-report.json`.
- The report records checked-out base commit `b962213e1aab506fdef70bc674d7f802cd0290f5`, source hash `c3e4bed6f06e1b18c48126e32f6f08d6e62033c66513d88c2cdc8f5c44189fcd` for the then-current uncommitted implementation, and package payload provenance. The final evidence source hash in the generated report is authoritative if later edits change this plan text.
- Windows package and visual proof were not run on this macOS host. No Windows-only behavior was claimed.
