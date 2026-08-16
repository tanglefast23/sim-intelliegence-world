---
title: Three.js visual polish
type: feature
date: 2026-08-16
spec: docs/specs/2026-08-16-threejs-visual-polish.md
baseline: 23586ec
---

# Three.js visual polish implementation plan

## 1. Outcome

Ship the five polish items in the approved specification, each as its own commit
behind its own measurement, on top of the merged and CI-green port at `23586ec`.

## 2. Locked rules

1. Presentation only. No change to simulation, saves, maps, input, audio, content.
2. Every animated value derives from the controller-sampled timestamp in the frame.
3. Atlas draw calls stay at or under 12. All world rendering stays at or under 24.
4. Nearest-neighbour sampling and whole-pixel placement survive every item.
5. No render target, no post-processing pass, no second renderer.
6. An item that cannot show its stated measurement is reverted, not softened.
7. No item weakens an existing gate to make itself pass.

## 3. Order and why

The order is chosen so each item lands on a stable base:

1. **5.1 camera stability** first. It changes the projection matrix, so every
   later capture depends on it. Landing it first means one recapture, not five.
2. **5.2 dithered pools** next. It only touches the `district-light-pools`
   batch and needs no new material.
3. **5.4 grading** third. It touches every material's fragment shader, so it
   must land before the two items that add or change shading.
4. **5.3 rim light** fourth. It adds a batch and a material, taking the world
   from 17 to 18 draw calls.
5. **5.5 ground wave** last. It is the only vertex-stage change and the easiest
   to revert if the texel-stability measurement moves.

## 4. Per-item tasks

### 4.1 Camera stability

- Snap the orthographic camera bounds to whole drawing-buffer pixels when
  building the projection matrix. Leave the logical camera in the frame untouched.
- Add a focused test proving the snap is idempotent and that a logical camera
  differing by less than one device pixel produces an identical matrix.
- Recapture the specialized and all-map fixtures.

**Gate.** Native frames keep the exact readable-pixel-set identity the comparator
already enforces. No mask loses contrast retention.

### 4.2 Dithered light pools

- Replace the three ellipse fans per pool with one quad carrying the pool centre
  and radius.
- Compute radial falloff in the fragment shader and apply an ordered 4x4 Bayer
  dither at atlas texel scale.
- Record `trianglesByBatch['district-light-pools']` before and after.

**Gate.** Lamp centres stay brighter than their recorded unlit regions. Draw
calls unchanged at one for that batch. Triangle count drops. Banding judged by
decoded inspection and stated as inspection, not as a gate.

### 4.3 Time-of-day grading

- Add shared grading uniforms and apply them inside each material's fragment
  shader before the tone-mapping include.
- Make the curve identity at the recorded calibration period so existing captures
  stay valid.
- Add a focused test proving identity at the calibration period.

**Gate.** Required-mask contrast retention holds in all four periods. The
calibration period reproduces the existing captures exactly.

### 4.4 Character rim light

- First verify the atlas carries transparent padding around every character cell.
  If it does not, stop and cut this item: the neighbour sample would read an
  adjacent sprite.
- Add a `character-rim` batch directly after `grounded-props-and-characters`,
  with its own atlas-sampling material.
- Build it from the character placements only, masked to texels whose upper-left
  neighbour is transparent.

**Gate.** Character masks keep contrast retention. World draw calls read 18,
atlas draw calls unchanged, both under their ceilings.

### 4.5 Animated ground detail

- Displace tagged ground-detail vertices from the frame timestamp and tile
  coordinate, quantised in the shader to whole drawing-buffer pixels.
- Pin the phase under reduced motion.
- Add a focused test proving two frames built from the same timestamp are
  byte-identical, and that reduced motion equals the pinned phase.

**Gate.** Determinism test passes. Draw calls unchanged. Native readable-pixel
sets unchanged at the pinned phase.

## 5. Verification per item

Run after each item, not once at the end:

```bash
npm run typecheck
npm run check:boundaries
npx jest --runInBand --no-cache
```

Then package and capture:

```bash
npm run package:mac:arm64
npm run smoke:electron
```

Every packaged run stays hidden and game-muted.

## 6. Closeout

- One Fable read-only audit of the whole program before the final commit. Opus
  writes this code, so Opus does not audit it.
- One Grok 4.6 attempt at the very end. If it cannot run once, skip it and record
  why.
- Fix only findings that are verified locally.
- Commit each item separately, then push the branch.

## 7. Stop conditions

Stop and revert the current item when:

- any atlas draw call exceeds 12 or world rendering exceeds 24;
- a required mask loses contrast retention or readable coverage;
- a determinism test fails;
- maximum-load FPS drops below rounded 60;
- an item needs a render target or a second renderer to work.

## 8. Rollback

Each item is one commit. Reverting an item must not disturb another. The whole
program reverts to `23586ec`.
