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

**Measure.** Pan a fixed route at each supported DPR and zoom. No mask may change
its readable-pixel set between consecutive frames while the camera is stationary,
and the per-frame readable-pixel count must not oscillate by more than one pixel
while panning.

### 5.2 Dithered light pools

**Problem.** The three-ring pools are flat ellipses. At larger sizes their
boundaries band visibly, which reads as a rendering artefact rather than light.

**Change.** Replace the ring stack with a single quad per pool whose fragment
shader computes radial falloff and applies an ordered 4×4 Bayer dither at atlas
texel scale. Dithering is the pixel-art-native solution to banding: it keeps the
palette quantised instead of introducing smooth gradients that fight the art.

**Why Three.js.** A fragment shader can compute falloff per pixel. Skia would
have needed a pre-baked gradient texture per pool size.

**Measure.** Lamp centres stay brighter than their recorded unlit regions. Light
pool draw calls drop from three per pool to one. No banding: along a radial line
from each pool centre, luminance must decrease monotonically within a tolerance
of one quantisation step.

### 5.3 Character rim light

**Problem.** Characters read flat against lit floors, especially in interiors.

**Change.** Add an upper-left rim highlight derived from the atlas alpha
footprint, drawn as a one-texel offset copy of the character quad in the shadow
batch's slot, tinted by the district accent and masked to texels whose
upper-left neighbour is transparent.

**Why Three.js.** The shader can sample the atlas at a neighbouring texel and
discard interior pixels. Skia had no per-texel access during an atlas draw.

**Measure.** Every character mask must keep at least its current contrast
retention against its ring, and must gain measurable separation: the rim's
luminance against the adjacent floor must exceed the floor by at least the
readable threshold of 1.02.

### 5.4 Time-of-day grading

**Problem.** District tint is a flat colour multiply. Dawn, day, dusk and night
differ in hue but not in tonal shape.

**Change.** Apply a small per-period grading curve in the composite: lift shadows
slightly at dawn, deepen them at night, and cool or warm midtones. Implement as
three uniforms on the existing overlay material, not as a lookup texture, so
there is no new asset and no filtering question.

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
tile coordinate. Amplitude is at most one logical pixel, so pixel placement is
preserved. Reduced motion pins the phase, exactly as the VFX clock already does.

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
