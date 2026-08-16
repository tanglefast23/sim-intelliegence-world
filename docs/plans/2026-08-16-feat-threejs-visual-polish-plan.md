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

1. **5.1 camera stability** first, and the real reason matters. Every committed
   baseline is a frozen Skia capture, and Skia is retired, so recapture can only
   refresh the candidate side. The snap moves pixels at fractional DPR, which
   permanently spends scaled-family threshold budget. Landing it first means the
   four later items spend what is left, rather than each discovering the shift
   separately.
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

**Gate.** The committed manifests cannot carry this gate: all 25 set
`compositingChanged: true`, which disables the per-pixel native path, and their
DPR 1 zoom 1 cameras are integer, so the snap is a no-op there anyway. The gate is
therefore a NEW pre-change-candidate against post-change-candidate manifest pair
at DPR `1.25` and `1.5`, with `compositingChanged: false`, which is exactly the
before-and-after the specification asks for. No mask loses contrast retention on
the committed corpus.

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

**Gate.** The calibration period reproduces the existing captures exactly, which
the committed corpus can show. The four-period claim needs a mechanism the corpus
does not have: no dawn, dusk or night manifests exist, and identity at the
calibration period means recapturing existing fixtures can never exercise the
other three. Either add per-period manifests that use the calibration-period
Three.js capture as baseline and gate only on per-mask contrast retention, since
grading changes every pixel and would fail the global-delta checks, or demote the
four-period claim to decoded inspection and say so. Do not leave it phrased as a
gate that has no runner.

### 4.4 Character rim light

- First verify the atlas carries transparent padding around every character cell.
  If it does not, stop and cut this item: the neighbour sample would read an
  adjacent sprite.
- Add a `character-rim` batch directly after `grounded-props-and-characters`,
  with its own atlas-sampling material.
- Build it from the character placements only, masked to texels whose upper-left
  neighbour is transparent.

**Gate.** Character masks keep contrast retention. World draw calls read 18.
Add `character-rim` to the hardcoded `atlasDrawCalls` id list first: it is a
five-entry literal, so a new atlas-sampling batch would go uncounted and the
"unchanged" reading would pass by omission while the true count is 6. The gate is
therefore atlas draw calls read 6, under the ceiling of 12.

### 4.5 Animated ground detail

- Displace tagged ground-detail vertices from the frame timestamp and tile
  coordinate, quantised in the shader to whole drawing-buffer pixels.
- Pin the phase under reduced motion.
- Add a focused test proving two frames built from the same timestamp are
  byte-identical, and that reduced motion equals the pinned phase.

**Gate.** Determinism test passes. Draw calls unchanged. Native readable-pixel
sets unchanged at the pinned phase.

## 5. Verification per item

Run after each item, not once at the end. The comparator is the point: without
it every gate phrased as "the comparator enforces" goes unmeasured.

```bash
npm run typecheck
npm run check:boundaries
npx jest --runInBand --no-cache
npm run package:mac:arm64
npm run smoke:electron
npm run qualify:renderer -- --mode parity \
  --manifest tests/fixtures/rendering/threejs-all-maps-v1.json \
  --output output/verification/visual-polish/<item>/parity.json
```

Re-record draw calls and `trianglesByBatch` after EVERY item, not only the item
that changed them. A later item can move a counter an earlier item established,
and nothing else would catch it.

The inspection-only properties, 5.2 banding and 5.3 rim separation, are checked
when their item lands and are not re-checked afterwards. That is a real limit of
this program and is stated rather than hidden.

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
