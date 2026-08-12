---
title: "feat: Add the rounded black-haired protagonist and weighted wobble"
type: feat
date: 2026-08-12
status: implemented-verified-with-unrelated-suite-failures
source_spec: docs/specs/2026-08-12-protagonist-weighted-wobble.md
base_sha: 38cd2b7
---

# Add the rounded black-haired protagonist and weighted wobble

## 1. Outcome

Put the supplied rounded protagonist into the real game with black hair and four directional views. Keep one stable pose per direction. Move the protagonist continuously along the existing route without leg steps or vertical bounce.

For pure left and right runs, rotate the character around its bottom center with one strong forward lean, a smaller counter-wobble, and a short final settle. Up, down, and diagonal travel remain upright.

This is a protagonist-only trial. NPC art, gait, offsets, timing, pathfinding, reservations, committed tiles, saves, and simulation rules must not change.

## 2. Source order

Use these sources in order:

1. `docs/specs/2026-08-12-protagonist-weighted-wobble.md`
2. `audits/2026-08-12-protagonist-wobble-opus-spec-review.md`
3. `audits/2026-08-12-protagonist-wobble-grok-spec-review.md`
4. this implementation plan after its Grok audit
5. the current `codex/newlook` checkout at `38cd2b7`, including the user's existing uncommitted work

If implementation reveals a conflict with the reviewed spec, correct the spec or plan before widening the code change.

## 3. Repository findings

The existing design already supplies the right foundations:

- `MovementState` owns deterministic transient travel state.
- `advanceMovement()` computes exact sampled distance from the bounded movement delta.
- `beginSegment()` starts each tile segment, so a run accumulator must not reset there unconditionally.
- an active-segment retarget is deferred through `pendingTarget` and applied after the segment commits.
- diagonal steps deliberately use front/rear facing because `movementDirection()` resolves Y before X.
- `buildWorldFrameState()` owns per-character sprite choice and movement offsets.
- `WorldScene` already builds one transient character `Atlas` batch with `Skia.RSXform` transforms.
- the protagonist reference is authored as explicit `24x30` token grids and is already connected to the atlas builder.
- current art checks require leg and shoe differences for every frame pair; they need one exact protagonist exception while keeping all NPC gates.

No external library is needed. Use pure TypeScript, the existing movement clock, the existing atlas batch, and the existing browser and packaged proof paths.

## 4. Dirty-checkout safety

The checkout contains substantial unrelated work. Several feature files already contain user changes, especially `WorldScene.tsx`, `atlas.ts`, `build-world-atlas.ts`, `check-generated-art.ts`, generated atlas files, `package.json`, and Electron proof code.

Rules for this implementation:

1. Record the scoped pre-change diff for every overlapping file before editing it.
2. Patch only the named functions and tests. Do not restore a whole file from `HEAD`.
3. Keep generated-art changes limited to the protagonist cells and the current in-flight art baseline.
4. Do not stage, commit, push, switch branches, or clean the worktree unless the user asks.
5. Do not use a repo-wide dirty-tree check as a feature failure.
6. Run the generated-art cleanliness gate through a temporary Git index populated with only the required generated outputs. Never alter the user's real index to satisfy `art:check`.
7. If `art:check` still rejects unrelated work, run its functional sub-checks separately and report that limitation instead of staging other work.

## 5. Implementation slices

### Slice 1: make the supplied protagonist a stable four-view sprite

Files:

- modify `scripts/art/protagonist-reference.ts`
- modify `scripts/art/__tests__/protagonist-reference.test.ts`
- preserve the narrow protagonist integration in `scripts/art/build-world-atlas.ts`
- modify `scripts/art/check-generated-art.ts`
- modify `scripts/art/__tests__/prototype-art.test.ts`
- regenerate only the normal atlas outputs and current pixel baseline

Work:

1. Keep the supplied front, rear, left, and right token grids inside the existing `24x30` cell.
2. Use the black-haired edit as the visual source. Preserve the face, teal clothing, gold strap, outline, scale, and rounded base.
3. Remove `steppedFrame()`. Map each direction's second atlas cell directly to the same stable token grid as its first cell.
4. Assert complete byte equality for all four protagonist frame pairs.
5. Add one exact protagonist exception to the lower-leg and shoe difference gate.
6. Keep the lower-leg and shoe difference requirement for Linda, the generic resident, and every other NPC.
7. Regenerate `assets/generated/world-atlas.png`, `atlas-index.json`, and `atlas-report.json` through the existing builder.
8. Update the current in-flight pixel baseline only after the generated protagonist cells match the authored grids.

Tests:

- all protagonist cells stay exactly `24x30`;
- all four views retain opaque pixels and black hair;
- protagonist `front`, `rear`, `left`, and `right` frame pairs are byte-identical;
- representative NPC frame pairs still differ in the required foot rows;
- atlas generation remains deterministic.

Gate:

```sh
npx jest --runInBand --runTestsByPath \
  scripts/art/__tests__/protagonist-reference.test.ts \
  scripts/art/__tests__/prototype-art.test.ts \
  scripts/art/__tests__/atlas-generation.test.ts
npm run art:atlas
npm run art:review
```

### Slice 2: track one deterministic horizontal run distance

Files:

- modify `src/world/pathfinding/movement.ts`
- modify `src/world/__tests__/motion-clock.test.ts`
- modify `src/world/__tests__/pathfinding.test.ts`

State addition:

```ts
horizontalRunDistance: number;
```

Work:

1. Initialize the field to zero in `createMovementState()`.
2. Reset it on an immediate movement request, cancellation without a segment, teleport or portal reconciliation, entry to waiting or unreachable, and completed arrival. Set `horizontalRunDistance: 0` in both current waiting return sites: blocked before `beginSegment()` and blocked at segment commit.
3. In `beginSegment()`, derive the next direction once. Preserve the field only when the previous and next segments are the same pure `left` or `right` direction. Reset it for the first horizontal segment, a direction reversal, vertical travel, or a diagonal segment.
4. In `advanceMovement()`, add the same sampled `distance` used by `travelDistance`, but only while the active segment direction is pure left or right. On a completed pure-horizontal segment, replace the accumulated float with the exact cardinal boundary (`completedRunTiles * 32`) before returning. This prevents frame-split floating-point crumbs from producing a nonzero angle at `32`, `64`, or `96 px`.
5. Keep the field unchanged when speed is zero so pause freezes the presentation. Do not infer pause from movement status.
6. For an active-segment retarget, preserve current behavior until the segment commits.
7. For active cancellation, preserve the current distance and angle through the segment commit. Reset when `stopAfterSegment` takes effect. This avoids a mid-segment snap.
8. Add carry logic only inside the `pendingTarget` commit branch in `advanceMovement()`: snapshot completed distance and direction, call `requestMovement()`, inspect the returned path's first step, and restore only when both directions are the same pure left or right. Idle, unreachable, vertical, diagonal, and opposite results keep the normal zero reset.
9. Do not apply carry logic to `resumeTarget`, yield recovery, ordinary immediate requests, cancellation, waiting, unreachable, or arrival. Those flows always end at zero before any later run begins.
10. Do not persist the field in world state or saves. The shared field may exist on NPC movement records, but it must be inert: NPC paths, timing, frames, offsets, transforms, and rendered pixels stay unchanged.

Tests:

- first right and left runs start at zero and increase by sampled world distance;
- same-direction horizontal tile boundaries do not reset the field;
- completed one-, two-, and three-tile cardinal runs produce exact distances `32`, `64`, and `96` with strict equality;
- vertical, diagonal, reversal, waiting, unreachable, and arrival paths reset it;
- active cancellation carries through the final segment and resets at commit; cancellation without a segment resets immediately;
- blocked-before-start, blocked-at-commit, automatic replan, and yield/recovery start a fresh run;
- a pure-right run blocked at commit returns waiting with distance zero and restarts a later same-direction segment from zero;
- pause leaves the value unchanged;
- a real pending-target sequence carries it for same-direction continuation;
- a real pending-target sequence resets it when the next direction differs;
- committed tiles, timing, reservations, and route results match the existing behavior.

Gate:

```sh
npx jest --runInBand --runTestsByPath \
  src/world/__tests__/motion-clock.test.ts \
  src/world/__tests__/pathfinding.test.ts
```

### Slice 3: add a pure wobble curve and bottom-pivot transform

Files:

- add `src/render/protagonist-wobble.ts`
- add `src/render/__tests__/protagonist-wobble.test.ts`

Pure API:

```ts
protagonistWobbleDegrees(input): number
bottomPivotTransform(input): { scos: number; ssin: number; tx: number; ty: number }
```

Work:

1. Implement the reviewed distance curve with a `10 degree` initial amplitude and `96 px` settle distance.
2. Return zero unless the protagonist is actively moving in pure `left` or `right` travel.
3. Return zero under reduced motion.
4. Return exact numeric zero at distances `<= 0`, `32`, `64`, and `96+`. Do not rely on floating-point `sin(n * PI)` to produce exact zero.
5. Use the opposite sign for left and right travel.
6. Convert degrees to radians inside the transform helper.
7. Rotate around source point `(12,29)` using the reviewed `RSXform` formula.
8. Keep an explicit zero-angle branch that returns the existing `Skia.RSXform(zoom, 0, worldX * zoom, worldY * zoom)` values exactly.

Tests:

- correct left and right signs;
- first lean is larger than the counter-wobble and final settle;
- strict numeric zeros at `0`, `32`, `64`, and `96+` using exact assertions rather than tolerances;
- vertical, idle, waiting, unreachable, diagonal presentation, and reduced motion return zero;
- zero angle exactly matches the old translation;
- the transformed `(12,29)` point is invariant for sample positive and negative angles at zoom `1x`, `2x`, and `3x`.

Gate:

```sh
npx jest --runInBand --runTestsByPath src/render/__tests__/protagonist-wobble.test.ts
```

### Slice 4: render rotation only on the protagonist character batch

Files:

- modify `src/render/atlas.ts`
- modify `src/render/world-frame.ts`
- modify `src/render/WorldScene.tsx`
- modify `src/render/__tests__/atlas-bill.test.ts`
- modify `src/render/__tests__/world-frame.test.ts`

Work:

1. Make `movementPresentation('protagonist', ...)` return zero `leanX`, `bounceY`, and `shadowX` for all directions and both internal frame indexes.
2. Leave the NPC offset rules unchanged.
3. Add optional `angleDegrees` to transient `WorldCharacterPlacement` only.
4. Pass `horizontalRunDistance: runtime.movement.horizontalRunDistance` into the protagonist presentation input and include that raw field in the `worldFrame` `useMemo` dependency array. Do not rely on snapped foot movement or `walkFrame` to invalidate the angle.
5. Compute the angle from pure presentation state: direction, movement status, run distance, and reduced-motion mode.
6. Keep diagonal movement upright through the existing front/rear direction mapping.
7. Leave the shared translation-only `atlasData()` helper unchanged for floors, details, props, walls, roofs, and effects.
8. Add `characterAtlasData()` for character placements. Change the `characterAtlas` call site from `atlasData(characters, camera.zoom)` to this helper. Use the exact existing transform when angle is zero and the bottom-pivot transform only when a character has a nonzero angle.
9. Keep nearest-neighbor sampling and the existing integer zoom values.
10. Keep the shadow at its existing foot anchor. Do not rotate or shift it with the body.
11. Keep character depth ordering, selection, hit targets, and camera focus tied to the existing visible foot anchor.
12. Turning reduced motion on mid-run hides rotation but continues distance tracking. Turning it off resumes at the angle for the current distance without restarting the run.

Tests:

- all protagonist legacy offsets are zero;
- existing NPC offsets remain byte-for-byte unchanged;
- only the protagonist receives a nonzero angle;
- up, down, and diagonal routes are upright;
- reduced motion is upright while position stays continuous;
- pause freezes the exact angle, while a mid-run reduced-motion toggle hides and restores the distance-derived angle without a reset;
- static atlas data remains translation-only;
- zero-angle character transforms match their previous values exactly.
- a representative NPC placement, frame, offsets, and transform remain unchanged.

Gate:

```sh
npx jest --runInBand --runTestsByPath \
  src/render/__tests__/atlas-bill.test.ts \
  src/render/__tests__/world-frame.test.ts \
  src/render/__tests__/protagonist-wobble.test.ts
```

### Slice 5: expose deterministic evidence without changing simulation

Files:

- modify `src/render/movement-evidence.ts`
- modify `scripts/electron/natural-movement-report.ts`
- modify the existing smoke-only state in `src/render/WorldScene.tsx`
- modify `tests/electron/natural-movement-smoke.test.ts`
- modify the smallest existing Electron movement scenario only if required for missing cardinal proof

Work:

1. Add protagonist-only `horizontalRunDistance` and `protagonistWobbleDegrees` fields to deterministic presentation samples.
2. Derive both fields from real movement state. Do not accept caller-supplied summary booleans.
3. Add packaged assertions for exact tile-boundary zeros, sign, decay order, stable vertical travel, same-direction retarget carry, and different-direction reset.
4. Keep NPC trace schemas and movement assertions unchanged.
5. Reuse the existing smoke-mode guard. Add both fields to the smoke `world-movement-state` player sample, derived from the same pure wobble helper used by rendering. Do not expose test state in ordinary play.
6. Add the smallest explicit left, right, up, down, turn, interruption, and long-horizontal steps needed by the packaged scenario.
7. Bump the deterministic movement-trace and natural-movement report schema versions. Update strict schemas, builders, validators, and test fixtures together. Do not overwrite historical evidence artifacts.

Tests:

- two identical fixed-step traces have identical distance and angle samples;
- one-tile horizontal runs finish exactly upright;
- long runs reach zero and stay zero after `96 px`;
- vertical and reduced-motion traces remain at zero angle;
- packaged validation derives its verdict from recorded samples.

Gate:

```sh
npx jest --runInBand --runTestsByPath \
  src/render/__tests__/movement-evidence.test.ts \
  tests/electron/natural-movement-smoke.test.ts
```

## 6. Full verification

Run narrow tests first. Then run the existing whole-project gates.

```sh
npx jest --runInBand --runTestsByPath \
  scripts/art/__tests__/protagonist-reference.test.ts \
  scripts/art/__tests__/prototype-art.test.ts \
  scripts/art/__tests__/atlas-generation.test.ts \
  src/render/__tests__/atlas-bill.test.ts \
  src/render/__tests__/world-frame.test.ts \
  src/render/__tests__/protagonist-wobble.test.ts \
  src/world/__tests__/motion-clock.test.ts \
  src/world/__tests__/pathfinding.test.ts \
  tests/electron/natural-movement-smoke.test.ts

npm run art:atlas
npm run art:review
npm run check:boundaries
npm run typecheck
npm test
npm run export:web
npm run package:electron
npm run smoke:natural-movement
```

Run `npm run art:check` with a temporary `GIT_INDEX_FILE`: initialize it from `HEAD`, add only the requested generated atlas outputs and current baseline to that temporary index, run the check with the same environment variable, then discard only that temporary index. The user's real index must remain byte-for-byte unchanged. If the gate still rejects unrelated work, run its functional generation and pixel assertions directly and record the exact dirty-tree-only failure.

## 7. Visual review and tuning loop

Tests prove determinism and transform safety. They cannot decide whether the movement feels weighted.

1. Start the local web build from `codex/newlook` and open the real game.
2. Capture the supplied character idle in all four directions at `1x`, `2x`, and `3x`.
3. At `2x`, capture left and right ordered sequences near `0`, `16`, `32`, `48`, `64`, `80`, and `96 px`.
4. At `2x`, capture up, down, diagonal, vertical-to-horizontal turn, same-direction retarget, opposite-direction retarget, cancellation, blocked restart, and reduced-motion travel.
5. At `1x`, `2x`, and `3x`, capture representative forward-lean and counter-wobble pivot checks.
6. Use a short burst, contact sheet, or video for each movement sequence. Do not approve feel from one still image.
7. Inspect the bottom-center pivot, outline stability, nearest-neighbor edges, shadow position, route-end posture, and direction signs.
8. Compare the three lobes: strong initial forward lean, smaller counter-wobble, tiny final settle.
9. Change only the named amplitude or settle-distance constants when the observed motion is too weak, pendulum-like, jittery, or slow.
10. Rerun pure curve tests, render tests, and the same capture sequence after every tuning change.
11. Stop only when the protagonist reads as a rounded body with weight, returns upright without a snap, and all automated gates remain green.
12. Leave the verified local build running and report its URL so the user can test this branch.

## 8. Acceptance checklist

- [x] Black-haired supplied protagonist appears in the real game in all four directions.
- [x] Every protagonist direction uses one stable pose; no foot-step cycling is visible.
- [x] Up, down, diagonal, idle, waiting, unreachable, paused, and reduced-motion states behave exactly as specified.
- [x] Left and right use the correct forward sign and a decaying weighted wobble.
- [x] The wobble continues across same-direction tile boundaries and deferred retargets.
- [x] The wobble resets on turns, reversals, cancellation, portals, and new runs.
- [x] One-tile, two-tile, and three-tile boundaries end exactly upright.
- [x] The bottom-center pivot stays planted and the shadow stays centered at all three zoom levels.
- [x] NPC sprites and movement offsets are unchanged.
- [x] Static atlas transforms are unchanged.
- [x] Fixed-step and packaged traces record real distance and angle values.
- [x] Narrow tests, typecheck, boundaries, web export, desktop package, and packaged movement proof pass.
- [ ] The full dirty-branch suite is all green. It currently has eight unrelated failures in Sunward art, Linda schedule/save coordinates, and the first-hour golden.
- [x] Local visual captures pass the weighted-feel review after the tuning loop.
- [x] The local branch build is left ready for user testing.

## 10. Verification result

- Feature and focused regression tests: pass.
- Typecheck and import boundaries: pass.
- Web export and Electron package: pass.
- Packaged natural-movement smoke: pass with `119.99 FPS` against the required `55 FPS`.
- Browser motion: left and right reach about `7.1 degrees`, return to exact zero at horizontal tile boundaries, use a smaller `2.7 degree` counter-wobble, and finish with a sub-`0.5 degree` settle.
- Reduced motion: 112 packaged samples and the live browser run remain at zero angle while travel continues.
- Full suite: 622 tests pass and eight unrelated dirty-branch assertions fail. No failure touches the protagonist art, wobble curve, movement accumulator, renderer, or movement evidence.
- Strict art check: the new protagonist equality gate passes, then the existing NPC guard rejects `resident-02 front` because its lower-leg and shoe rows do not differ. That unrelated resident was not changed.

## 9. Non-goals

- no NPC art conversion;
- no new physics, spring, tween, or animation dependency;
- no vertical bob or vertical wobble;
- no change to movement speed, A-star, turn curves, collision, reservations, domain commands, saves, or map data;
- no broad renderer refactor;
- no commit, push, deployment, or cleanup of unrelated branch work.
