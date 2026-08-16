---
title: Handoff pixel techniques 1, 4 and 7
type: feature
date: 2026-08-16
status: draft
baseline: d4a1a24
extends: docs/specs/2026-08-16-threejs-visual-polish.md
---

# Handoff pixel techniques: integer low-res, authored object scale, stepped glow

## Problem Statement

The 2D pixel-villa spike (`spikes/001-threejs-pixel-villa/scene-2d.js`) is the
handoff that production was meant to reproduce. Ten techniques carried the look.
Seven landed. Three did not, and the player sees the difference:

1. **Integer low-resolution rendering.** The spike rendered a fixed 298×298
   buffer at `setPixelRatio(1)` and let CSS upscale it with
   `image-rendering: pixelated`. Production calls `setPixelRatio(1)` but sizes
   the drawing buffer to `viewport × devicePixelRatio`
   (`src/render/three/coordinate-contract.ts`), which is full resolution, not
   low resolution at an integer step. On a 1.25 or 1.5 DPR display one world
   texel covers a fractional number of device pixels, so a nominally
   nearest-neighbour sprite lands on an uneven lattice: some texels are 1 device
   pixel wide and their neighbours are 2. The art reads as a pixel-art image that
   has been resized by a photo editor rather than as pixel art.

4. **Authored object scale.** The spike drew furniture at 1.08, sofas at 1.12 and
   the protagonist at 1.22, so objects had presence against the tile grid.
   Production carries a `scale` field on every placement, but only floors ever
   pass a value other than `1` (`src/render/world-frame.ts:447`). Every prop and
   every character draws at exactly its authored pixel size, so a sofa reads as
   the same visual weight as the floor tile beneath it.

7. **Stepped light-map glow.** The spike's glow texture was four nested
   rectangles at increasing alpha, sampled with `NearestFilter`: light that falls
   off in discrete plateaus, which is how pixel art depicts light. Production
   generates a smooth `createRadialGradient` with eight stops and samples it with
   `LinearFilter` (`src/render/three/world-renderer.ts:320`). The falloff is
   continuous, so it introduces a smooth gradient into a quantised image — the
   exact artefact the art direction avoids everywhere else.

Behind those three sits a fourth problem, which is why they cannot simply be
implemented. The evidence corpus that would measure them is partly inert:

- Every one of the 19 live manifests sets `baseline.masks` and `candidate.masks`
  to **the same path**. The comparator's mask-identity check
  (`compare-renderer-frames.ts:395`) therefore compares a file to itself and
  cannot fail.
- Nothing in the repository emits a mask frame any more. The emitter went with
  the parity runners in Stage 7. Both mask sides are frozen committed JSON, so
  the alpha footprint no longer tracks what the renderer draws. A change that
  moves a sprite's silhouette leaves the mask behind, and readable coverage then
  measures a region the sprite has partly vacated — while still reporting a pass.
- Every baseline image is a frozen Skia capture that can never be re-taken. All
  19 fixtures carry `compositingChanged: true`, so the whole-frame RGB family
  (mean absolute delta ≤ 1, RMS ≤ 3, large-changed ratio ≤ 0.002) is the live
  gate on every one of them, measured against a reference from a renderer that
  no longer exists. Item 5.1 was implemented, measured and reverted for exactly
  this reason. All three techniques here repaint more pixels than 5.1 did.

This is the same class of defect `artifacts/visual-polish/EVIDENCE-GAP.md`
recorded: a gate that reports a pass while measuring nothing. It was found once
in the image path and fixed. It survives in the mask path and in the choice of
reference.

## Solution

Re-point the evidence corpus at the renderer that actually ships, restore the
mask side to a live measurement, and then land the three techniques, each behind
a gate that can fail.

From the player's side:

- Sprites sit on a whole-pixel lattice at every supported display scale, so the
  art looks the same shape on a 1.25 DPR laptop as on a 1× monitor.
- Furniture and people have weight against the floor instead of reading as
  another layer of tiles.
- Lamplight falls off in visible steps, in the same visual language as the
  sprites it lights.

From the maintainer's side, a renderer change that damages readability fails a
command, rather than passing one.

## User Stories

1. As a player on a 1.25 DPR laptop, I want each art texel drawn at a whole
   number of device pixels, so that the sprites look like the pixel art the
   artist drew rather than a resized photograph.
2. As a player on a 1.5 DPR display, I want the same lattice guarantee, so that
   my display scale is not a second art direction.
3. As a player on a 1× or 2× display, I want today's frame unchanged, so that a
   fix for fractional scales costs me nothing.
4. As a player, I want the low-resolution buffer upscaled with nearest-neighbour
   sampling, so that the upscale does not reintroduce the blur it exists to
   remove.
5. As a player, I want the visible world extent unchanged by the buffer change,
   so that I can see exactly as much of the map as before.
6. As a player, I want furniture to read as objects sitting on the floor, so
   that a room's purpose is legible at a glance.
7. As a player, I want a sofa to read as heavier than a table and a table
   heavier than a planter, so that scale carries meaning instead of being
   uniform decoration.
8. As a player, I want a scaled prop to keep its feet where they were, so that
   nothing appears to hover or sink into the floor.
9. As a player, I want the protagonist to remain the most legible figure on
   screen when scaled, so that presence never costs me clarity.
10. As a player, I want scaled props never to overlap a doorway or route that
    they did not overlap before, so that scale never blocks a path I can walk.
11. As a player, I want lamplight to fall off in discrete steps, so that light
    belongs to the same picture as the sprites.
12. As a player, I want the stepped glow to keep lamp centres brighter than
    unlit floor, so that a lit room still reads as lit.
13. As a player, I want the district light pools to remain coherent when the
    shared glow texture changes, so that one fix does not degrade another light
    source.
14. As a player, I want none of this to cost frame rate, so that the world still
    runs at a rounded 60 FPS under maximum load.
15. As a maintainer, I want the comparator's reference to be a capture from the
    renderer that ships, so that a measurement describes the current program
    rather than a retired one.
16. As a maintainer, I want the mask side of every comparison to be produced by
    the run under test, so that mask identity is a check rather than a tautology.
17. As a maintainer, I want a mask whose sprite silhouette changed to fail, so
    that a silently-moved sprite cannot pass by measuring stale pixels.
18. As a maintainer, I want the frozen Skia captures kept and labelled as
    history, so that retiring them as a reference does not destroy the record.
19. As a maintainer, I want the six villa fixtures excluded from the headline
    pass count by name, so that a reported total never includes a self-comparison.
20. As a maintainer, I want a deliberately damaged renderer to fail the refreshed
    comparison, so that the new reference cannot be vacuous in the way the old
    one was.
21. As a maintainer, I want each technique in its own commit behind its own
    measurement, so that one can be reverted without unpicking the others.
22. As a maintainer, I want a technique that cannot show its measurement to be
    reverted rather than have its threshold softened, so that the locked rule
    from the visual-polish program still holds.
23. As a maintainer, I want the pure geometry of each technique testable without
    a window, so that most of the work is verifiable under Jest.
24. As a maintainer, I want the draw-call and GPU-resource ceilings re-recorded
    after each technique, so that polish never buys itself performance headroom
    it did not have.
25. As a maintainer, I want no renderer state to reach saves or preferences, so
    that presentation stays presentation.
26. As a maintainer, I want the residual ACES gap stated rather than closed
    quietly, so that nobody later mistakes the no-tone corpus for full coverage.

## Implementation Decisions

### Phase 0 — the evidence corpus. Ships first, alone.

No technique may land before this phase is green, because until it is, none of
them can produce a failing measurement.

**0.1 Re-baseline against Three.js.** A new script re-points the 19 live
manifests' `baseline.image` at a fresh capture taken from the current renderer
into a new evidence root, and rewrites each manifest's `sourceCommit` to the
re-baseline commit. The frozen Skia PNGs stay exactly where they are, under the
write-protected historical evidence root, unreferenced. They are retired as a
reference, not deleted; `artifacts/visual-polish/` records that the comparison
they encode can no longer be made.

The consequence is deliberate and must be stated in the diff: from this commit
onward the corpus measures *drift from the shipping Three.js renderer*, not
parity with Skia. The whole-frame RGB family resets to near zero, which is what
restores the budget item 5.1 exhausted.

**0.2 Restore the mask emitter.** The capture run writes a mask frame per
fixture from the live frame it just rendered, and the manifest points
`candidate.masks` at that fresh file while `baseline.masks` points at the copy
taken during re-baselining. Two distinct paths, so mask identity becomes a real
comparison.

The mask frame is derived from data already in `WorldFrameState`: for each
required mask, the placement's logical bounds after scale and pivot, and an
alpha footprint read from the atlas cell the placement names. No new content and
no new source of truth — the emitter reads the same frame the renderer draws.

This is the load-bearing prerequisite for technique 4. Without it, scaling a
character leaves a 24×30 mask over a 29×37 sprite and the readable-coverage
measurement silently changes what it is measuring.

**0.3 Declare the six villa fixtures.** `threejs-villa-v1.json` covers six
fixtures whose capture runner was retired. They cannot be refreshed or
re-baselined. They are reported in their own section with the reason, and are
excluded from the headline pass count. A villa capture runner is out of scope.

**0.4 Prove the new reference is not vacuous.** The existing capture-path damage
tests are extended to the re-baselined corpus: a refresh that touches nothing
fails; a damaged candidate image fails; a mask frame whose footprint was altered
fails; and an untouched fixture still passes, so the damage tests mean something.

### Technique 1 — integer low-resolution buffer

**Module:** `src/render/three/coordinate-contract.ts`, with a CSS change on the
world canvas in `src/render/ThreeWorldSurface.tsx`.

**Decision.** The drawing buffer is sized at an integer multiple of the logical
viewport rather than at the device pixel ratio. The integer render scale is
`max(1, floor(devicePixelRatio))`, and the browser upscales the result to the
window with `image-rendering: pixelated`.

```
renderScale(dpr)          = max(1, floor(dpr))          // 1 → 1, 1.25 → 1, 1.5 → 1, 2 → 2
threeDrawingBufferSize    = viewport × renderScale(dpr) // was viewport × dpr
threeRasterViewport       = drawingBuffer / renderScale // unchanged: still the logical viewport
```

`threeRasterViewport` feeds `threeCameraBounds`, so the visible world extent is
identical before and after. That is what keeps every mask's logical bounds where
they were, which is why technique 1 does not depend on phase 0.2.

At DPR 1 and DPR 2 the buffer is byte-identical to today, so those fixtures must
not move at all. Only DPR 1.25 and 1.5 change — which is precisely the fixture
family that failed item 5.1, and precisely why phase 0 has to come first.

`image-rendering: pixelated` is applied to the world canvas only. The existing
`AtlasSprite` already uses it for HUD sprites; the world canvas never did.

**Interface change.** `threeDrawingBufferSize(viewport, devicePixelRatio)` keeps
its signature. A `threeRenderScale(devicePixelRatio)` export is added because it
is the value the tests and the evidence record need to name.

**Rejected alternative.** Rounding the camera to whole device pixels was item
5.1 and was reverted. It treated the symptom at the camera while leaving the
lattice fractional. Sizing the buffer to an integer removes the fractional
lattice itself, so the snap has nothing left to correct.

### Technique 4 — authored object scale

**Module:** `src/render/world-frame.ts`. The renderer already multiplies
`placement.scale` into its quad, so no renderer change is needed.

**Decision.** A scale table keyed by sprite id, with the spike's authored
values: planters and tables `1.08`, sofas `1.12`, characters `1.22`. Anything
absent from the table stays at `1`.

Scale is applied about the **bottom centre** of the sprite, not its top-left
origin. `addAtlasPlacement` anchors at `worldX`/`worldY` with a pivot, so a naive
scale grows the sprite down and to the right and lifts its feet off the floor.
The placement's `worldX` and `worldY` are adjusted so that `worldY + height` and
the horizontal centre are invariant under scale. This is what story 8 asks for
and it is a correctness requirement, not a refinement.

**Split into two sub-items, and they ship in this order.**

- **4a, props.** Planters, tables and sofas. Props do not carry required masks,
  so the gate is the whole-frame family against the re-baselined reference plus
  the unchanged readability of the character masks nearby.
- **4b, characters.** The `1.22` protagonist scale. This changes a required
  mask's silhouette by construction, so it cannot pass mask identity against a
  pre-change baseline, and its gate is instead: the live mask emitter produces
  the new footprint; the character's readable pixel count against its own ring
  does not fall; contrast retention against the new baseline holds; and the
  scaled figure does not newly overlap a door or route tile.

4b is separable and may be cut on its own. It is the only item in this spec that
changes the size of a gameplay-legibility element, so it carries the highest bar.

**Content or code.** The table is TypeScript in `src/render`, not
`content/`. It is a presentation constant tied to atlas sprite ids, in the same
class as `LAMP_SPRITE_IDS`, and it never reaches the domain or world rings.

### Technique 7 — stepped light-map glow

**Module:** `src/render/three/world-renderer.ts`, `generatedGlowTexture`.

**Decision.** The eight-stop smooth radial gradient is replaced by the handoff's
stepped construction: nested squares at increasing alpha, sampled with
`NearestFilter` and `generateMipmaps: false`, so each plateau reads as a discrete
band. The spike's four steps are kept as the authored ramp, expressed as a pure
exported table of `[inset, alpha]` pairs so the shape is testable without a
canvas.

**The shared-texture consequence, stated up front.** This texture is the map for
both the `lamp-glow` batch and the `district-light-pools` batch — `addEllipse`
emits radial UVs onto the same disc. Changing it changes both. The pools'
existing gate is the comparator's light samples, which must continue to pass, and
the pools' three-ring stack sits on top of the new texture rather than being
replaced by it. Item 5.2 of the visual-polish spec proposed replacing that ring
stack with a shader; it is untouched here and remains unshipped.

**Rejected alternative.** Introducing a second glow texture so pools keep the
smooth falloff. That buys one more texture against a schema ceiling of two, and
it would leave two different visual languages for light in the same frame.

### What no item may do

Every hard constraint from `docs/specs/2026-08-16-threejs-visual-polish.md`
section 3 applies unchanged: gameplay clarity outranks decoration; nearest
sampling and whole-pixel placement hold; atlas draw calls stay at or under 12 and
all world rendering at or under 24; the renderer stays presentation-only with no
clock and no randomness of its own; no renderer state reaches saves or
preferences.

The locked rule from the same program also holds without amendment: an item that
cannot show its measurement is reverted, not softened.

## Testing Decisions

A good test here asserts external behaviour: the numbers the renderer produces
and the pixels it draws, never the shape of the code that produces them. Item
5.1 is the cautionary prior art — five unit tests passed while the change broke a
readability floor, because all five tested the transform and none tested a frame.
So every technique carries both a headless test of its pure function and a pixel
measurement, and the pixel measurement is the one that decides.

**Seams, highest first.** No new seam is introduced. All four already exist:

| Seam | Kind | Covers | Prior art |
|---|---|---|---|
| `qualify:renderer` over the re-baselined corpus | pixel | every technique | `scripts/qualification/__tests__/compare-renderer-frames.test.ts` |
| `capture:renderer` → `capture:refresh` damage tests | pixel path | phase 0 | `scripts/qualification/__tests__/capture-path.test.ts` |
| `src/render/three/coordinate-contract.ts` | pure | technique 1 | `src/render/__tests__/three-world-renderer.test.ts` |
| `src/render/world-frame.ts` | pure | technique 4 | `src/render/__tests__/world-frame.test.ts` |

Technique 7 needs a fifth reachable point rather than a new seam: the step ramp
is exported as a pure table, because the Jest environment has no canvas and
`generatedGlowTexture` cannot run there. The test asserts the ramp is monotonic,
has exactly the authored number of plateaus, and reaches zero at the rim.

**Modules under test.**

- `coordinate-contract`: render scale is `1` at DPR 1, 1.25 and 1.5, and `2` at
  DPR 2; the drawing buffer is always an integer multiple of the viewport; the
  raster viewport, and therefore the camera bounds and visible world extent, are
  unchanged at every supported DPR.
- `world-frame`: a sprite in the scale table renders at its authored size; one
  absent renders at `1`; the bottom-centre anchor is invariant under scale; a
  scaled prop's tile footprint does not newly cover a door or route tile.
- the glow ramp, as above.
- the mask emitter: a frame with a scaled character emits a footprint matching
  the scaled bounds; a frame with an unscaled character emits the footprint the
  frozen fixture already records, which is the migration check that phase 0.2 did
  not change the meaning of the corpus.

**Pixel measurements, per technique.**

- Technique 1: DPR 1 and DPR 2 fixtures must be byte-identical to the
  re-baselined reference — a non-zero delta there means the change leaked outside
  fractional scales. DPR 1.25 and 1.5 fixtures must hold contrast retention at or
  above `0.9` and readable coverage at or above `0.95`.
- Technique 4a: whole-frame family against the re-baselined reference, plus
  unchanged readability on every required mask.
- Technique 4b: the mask footprint changes by design, so the claim is a readable
  pixel count that does not fall and a contrast retention at or above `0.9`
  against a reference re-baselined immediately before the change. Stated plainly:
  after 4b lands, the corpus is re-baselined again, so 4b's own pixels are not
  re-gated afterwards. That is a weaker gate than the others and it is named as
  such rather than described as equivalent.
- Technique 7: every fixture carrying a lamp must keep its light samples passing,
  which is a real assertion the comparator already makes on the candidate image.
  Banding is judged by decoded inspection, because no radial-monotonicity
  measurement exists and this spec does not add one.

**Every capture is taken from the hidden, game-muted packaged window**, per
`AGENTS.md` and `CLAUDE.md`. No test in this spec may open a visible window,
take foreground focus, or play audio.

## Out of Scope

- **The ACES gate.** Production runs ACES; the capture pins `toneMapping: none`
  because the locked manifests are no-tone. The enhanced ACES manifest set no
  longer exists. Re-baselining does not close that gap, and this spec does not
  reopen it. Anything visible only under the ACES curve still has no pixel gate,
  and that remains the named residual hole.
- **A villa capture runner**, and therefore reviving the six frozen villa
  fixtures.
- **The four remaining visual-polish items** — 5.2 dithered pools, 5.3 rim
  light, 5.4 grading, 5.5 ground wave. Technique 7 touches the same glow texture
  as 5.2 and is deliberately the smaller change.
- **Item 5.1**, the camera-origin snap. It stays reverted; technique 1 removes
  the fractional lattice it tried to correct.
- **The seven handoff techniques already implemented** — orthographic camera,
  atlas sprites with nearest sampling, varied floor tiles, silhouette shadows,
  edge occlusion, explicit layer order, and the colour pipeline.
- Any change to simulation, saves, maps, input, audio, content, or the atlas.
- Any post-processing chain, render target, dynamic light or 3D geometry.

## Further Notes

**The two vacuities found while writing this.** Both are recorded here because
they are the reason phase 0 exists, and both are the same defect
`EVIDENCE-GAP.md` named in the image path:

- `baseline.masks` and `candidate.masks` are the same file in all 19 manifests,
  so mask identity has never been able to fail.
- No mask emitter survives in the repository, so both mask sides are frozen and
  the alpha footprint has stopped tracking the renderer.

Neither was hidden; neither had been looked for. A gate is worth its cost only
when someone has checked it can fail.

**Ordering is not negotiable.** Phase 0, then technique 1, then 7, then 4a, then
4b. Techniques 1 and 7 do not move any mask, so they are measurable against the
re-baselined reference with the mask side merely restored. Technique 4 moves
silhouettes and depends on 0.2 being real. Landing 4 first would spend the
re-baselined budget before the cheaper items could use it.

**Rollback.** Each item is one commit behind its own measurement. Reverting one
must not disturb another. The re-baseline commit is the exception: reverting it
returns the corpus to the frozen Skia reference and re-blocks every technique, so
it is reverted only by abandoning the program. The whole program reverts to
`d4a1a24`.

**Publishing.** The repository has no configured issue tracker, so this spec
lands in `docs/specs/` per the convention in `CLAUDE.md`, alongside the
visual-polish spec it extends.
