---
title: Three.js visual polish
type: feature
date: 2026-08-16
status: draft
baseline: 23586ec
supersedes-renderer-sections-of: docs/specs/2026-08-14-threejs-2d-renderer-port.md
---

# Three.js visual polish specification

## 1. Decision

The Three.js 2D renderer is now the only renderer. This specification raises its
finish from correct to excellent, using capabilities that were impractical under
Skia's immediate-mode canvas.

It changes presentation only. It does not touch simulation, saves, maps, input,
audio, or content.

## 2. What the port already delivers

These are the baseline, not the goal.

- One `WebGLRenderer`, one orthographic camera, one world-atlas texture, one
  generated glow texture, and a bounded shared material set.
- Seventeen explicitly ordered composite batches with sorting disabled, depth
  testing off, and depth writing off.
- ACES tone mapping with a recorded exposure.
- Flat district lighting: shadow casters, three-ring light pools, shelter shade.
- Screen-space atmosphere: wash, four edge shades, five drifting motes.
- Nearest-neighbour atlas sampling with no mipmaps at every supported DPR.

## 3. Hard constraints

These outrank every visual ambition in this document. A polish item that
threatens one of them is cut, not negotiated.

1. **Gameplay clarity.** Room purpose, people, routes, doors and activity stay
   more readable than decoration.
2. **Pixel-art readability.** Nearest-neighbour sampling, whole-pixel placement,
   no blurring of atlas texels at any supported DPR or zoom.
3. **Performance.** Rounded 60 FPS at maximum load. Atlas rendering stays at or
   under 12 draw calls and all world rendering at or under 24.
4. **Deterministic simulation.** The renderer stays presentation-only. It never
   advances time, mutates world state, or introduces randomness. Every animated
   value derives from the controller-sampled timestamp already in the frame.
5. **No renderer state in saves or preferences.**

## 4. Non-goals

- No post-processing chain, bloom pass, depth of field, or render-target stack.
- No dynamic lights, shadow maps, or normal maps.
- No 3D geometry, perspective camera, or isometric projection.
- No new content, maps, props, or characters.
- No second renderer and no player-facing renderer switch.

## 5. The polish items

Each item names what it changes, why Three.js makes it practical, and how it is
measured. Items are independent so any one can be cut without unpicking another.

### 5.1 Sub-texel camera stability

**Problem.** At fractional zoom the camera lands between texels, so a sprite's
sampled texel can flip between frames while the player pans. The port proved no
blur, but it did not prove temporal stability.

**Change.** Snap the orthographic camera to whole drawing-buffer pixels before
building the projection matrix, keeping the logical camera untouched so input and
saves are unaffected.

**Why Three.js.** The projection matrix is ours to shape. Skia's canvas transform
was applied per draw call.

**Measure.** Capture a stationary camera at each supported DPR and zoom, before
and after the change, and require the exact readable-pixel-set identity the
comparator already enforces on native frames. Panning stability is the intent but
is NOT claimed as evidence: the comparator compares one baseline against one
candidate of the same fixture and hard-fails when a mask's bounds move, so it
cannot compare consecutive frames of a pan. Any panning claim would need a new
measurement family, which section 6 forbids.

### 5.2 Dithered light pools

**Problem.** The three-ring pools are flat ellipses. At larger sizes their
boundaries band visibly, which reads as a rendering artefact rather than light.

**Change.** Replace the ring stack with a single quad per pool whose fragment
shader computes radial falloff and applies an ordered 4×4 Bayer dither at atlas
texel scale. Dithering is the pixel-art-native solution to banding: it keeps the
palette quantised instead of introducing smooth gradients that fight the art.

**Why Three.js.** A fragment shader can compute falloff per pixel. Skia would
have needed a pre-baked gradient texture per pool size.

**Measure.** Lamp centres stay brighter than their recorded unlit regions, which
is exactly what the comparator's light samples already assert. Draw calls are
unchanged at one: every pool already builds into the single `district-light-pools`
batch, so there is no draw call to save. The saving is geometry, recorded as a
drop in that batch's `trianglesByBatch` count from three ellipse fans per pool to
one quad. Banding is judged by decoded inspection of the native captures, not by a
comparator gate, because no radial-monotonicity measurement exists.

### 5.3 Character rim light

**Problem.** Characters read flat against lit floors, especially in interiors.

**Change.** Add an upper-left rim highlight in a dedicated batch with its own
atlas-sampling material, inserted directly after
`grounded-props-and-characters`. It cannot reuse a shadow batch: both shadow
batches use the untextured primitive material, and their geometry carries
placeholder UVs, so switching them to atlas sampling would corrupt what they
already draw. It also cannot copy a character quad, because characters are
interleaved with props in one geometry. The rim batch therefore rebuilds only the
character placements, and masks to texels whose upper-left neighbour is
transparent.

This costs one additional draw call, taking the world from 17 to 18, which stays
under the ceiling of 24. The atlas must be verified to carry transparent padding
around every character cell, or the neighbour sample can read an adjacent
sprite.

**Why Three.js.** The shader can sample the atlas at a neighbouring texel and
discard interior pixels. Skia had no per-texel access during an atlas draw.

**Measure.** Every character mask keeps at least its current contrast retention
against its ring, which the comparator already gates. Draw calls are recorded at
18 and atlas draw calls unchanged. The rim's separation from the adjacent floor
is judged by decoded inspection, not by a gate: the comparator's readable
threshold applies to mask pixels against their own ring median, not to arbitrary
adjacent regions.

### 5.4 Time-of-day grading

**Problem.** District tint is a flat colour multiply. Dawn, day, dusk and night
differ in hue but not in tonal shape.

**Change.** Apply a small per-period grading curve as shared uniforms inside each
material's fragment shader, before the tone-mapping include. It cannot live on the
atmosphere batch: that batch is one alpha-blended quad, and fixed-function
blending can only apply a per-channel affine transform to what is beneath it,
which cannot lift shadows while separately cooling midtones. Reading composited
pixels would need a render target, which section 4 forbids. Atmosphere also
renders beneath the three feedback batches, so grading applied there would miss
them entirely.

**Why Three.js.** Uniform-driven grading costs nothing per frame. Skia would have
needed a colour filter per draw.

**Measure.** Required-mask contrast retention stays at or above the existing
floor in all four periods. The grading must be identity at the recorded
calibration period, so existing captures remain valid.

### 5.5 Animated ground detail

**Problem.** Water, foliage and banners are static. The world reads as a
photograph rather than a place.

**Change.** Displace tagged ground-detail vertices with a small deterministic
wave, computed in the vertex shader from the controller-sampled timestamp and the
tile coordinate. The displacement is quantised in the shader to whole
drawing-buffer pixels, so it is a discrete step rather than a glide. That
quantisation is the defence of hard constraint 2: a continuous sub-pixel wave
would sweep vertices through fractional positions and change which texel each
device pixel samples mid-swing, which is exactly the instability item 5.1 exists
to remove. Reduced motion pins the phase, as the VFX clock already does.

**Why Three.js.** Vertex displacement is free on the GPU and needs no CPU work
per tile. Skia would have rebuilt geometry per frame.

**Measure.** The animation must be a pure function of the frame timestamp: two
frames built from the same timestamp must produce byte-identical output. Reduced
motion must produce output identical to a pinned phase. Draw calls unchanged.

## 6. Evidence contract

Every item reuses the existing comparator and its measurements. No new
measurement family is introduced.

- Readable coverage, contrast retention, mask identity and the `1.05` baseline
  contrast floor apply unchanged.
- Where an item's intent cannot be expressed in those terms, it is judged by
  decoded inspection of the native captures and said so plainly, rather than
  described as a gate it does not have. Items 5.2 and 5.3 both rely on this.
- Frames whose layer ownership or shading changes carry `compositingChanged`, so
  they qualify under the raster-neutral RGB family already approved for moved
  layers.
- Draw calls and GPU resource counts are recorded before and after each item.
- Every capture is taken from the hidden, game-muted packaged window.

An item that cannot show its measurement is not shipped.

## 7. Acceptance

- [ ] Every hard constraint in section 3 still holds, each with a measurement.
- [ ] Each shipped item shows its own measurement from section 5.
- [ ] Rounded 60 FPS at maximum load, and no repeated frame above `50 ms` during
      pan, zoom or map entry.
- [ ] Atlas draw calls at or under 12, all world rendering at or under 24.
- [ ] Determinism: identical frame timestamps produce byte-identical output.
- [ ] No change to simulation, saves, maps, input, audio or content.
- [ ] The packaged app still reports `rendererKind: threejs-2d` and
      `webgl2Ready: true` on every supported platform.

## 8. Rollback

Each item is a separate commit behind its own measurement. Reverting one item
must not disturb another. The whole program reverts to `23586ec`, which is the
merged and CI-green port.
