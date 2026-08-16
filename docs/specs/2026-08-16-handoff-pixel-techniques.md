---
title: Handoff pixel techniques 1, 4 and 7
type: feature
date: 2026-08-16
status: draft
baseline: recorded when the phase-0.0 commit lands; see Rollback
extends: docs/specs/2026-08-16-threejs-visual-polish.md
amends-evidence-contract-of: docs/specs/2026-08-16-threejs-visual-polish.md
---

# Handoff pixel techniques: integer low-res, authored object scale, stepped glow

Revision 4. Two rounds of review by Fable 5 and Grok 4.6, independently.
Round 1 confirmed every factual claim about the current code and found nine
defects in the measurement story. Round 2 confirmed those nine were fixed and both
reviewers then landed on the **same** remaining defect: the `rasterResampled`
selector covered one of the four delta families that clearing
`compositingChanged` arms, so techniques 7 and 1 could not have reported a pass
at all. Every correction is listed in "Further Notes" rather than quietly applied.

## Problem Statement

The 2D pixel-villa spike (`spikes/001-threejs-pixel-villa/scene-2d.js`) is the
handoff production was meant to reproduce. Ten techniques carried the look.
Seven landed. Three did not.

1. **Integer low-resolution rendering.** The spike rendered a fixed 298×298
   buffer at `setPixelRatio(1)` and let CSS upscale it with
   `image-rendering: pixelated`. Production calls `setPixelRatio(1)` but sizes
   the drawing buffer to `viewport × devicePixelRatio`
   (`src/render/three/coordinate-contract.ts:3`). At a fractional device pixel
   ratio the whole frame is rasterised on a fractional lattice: sprites, rotated
   sprites, primitive strokes and glow quads each land on it differently, so one
   frame mixes several effective resolutions.

4. **Authored object scale.** The spike drew planters and tables at 1.08, sofas
   at 1.12 and the protagonist at 1.22. Production carries a `scale` field on
   every placement, but only floors pass a value other than `1`
   (`src/render/world-frame.ts:448`). Props at `:496` and characters at `:694`
   omit it, so a sofa reads as the same visual weight as the floor beneath it.

7. **Stepped light-map glow.** The spike's glow texture was nested rectangles at
   increasing alpha sampled with `NearestFilter`: light falling off in discrete
   plateaus. Production generates a smooth eight-stop `createRadialGradient`
   sampled with `LinearFilter` (`src/render/three/world-renderer.ts:330`).

Behind those three sits the reason they cannot simply be implemented. The
evidence corpus that would measure them is substantially inert.

- **Mask identity has never been able to fail.** All 25 fixtures in the live
  collection set `baseline.masks` and `candidate.masks` to the same path, as do
  the 6 villa manifests and `zoom-sampling-v1.json`. Not drift: the deleted
  builder wrote both from one variable
  (`git show 31566b6^:scripts/qualification/build-threejs-all-map-fixtures.ts`).
  The check at `compare-renderer-frames.ts:395` has always compared a file to
  itself.
- **No mask emitter survives.** `alphaFootprint` now appears only in the
  comparator and its tests. The emitter died with the parity runners in
  `31566b6`, so both mask sides are frozen.
- **Technique 7's obvious gate measures nothing.** Exactly **one** `lightSamples`
  entry exists across all 25 live fixtures, on the frozen
  `villa-interior-roof-hidden`, and it samples a patio fire rather than a lamp.
  The loop at `compare-renderer-frames.ts:543` runs over empty arrays everywhere
  else.
- **Every baseline is a frozen Skia capture**, and all 25 carry
  `compositingChanged: true`. The live gate on every fixture is therefore the
  whole-frame RGB family — mean ≤ 1, RMS ≤ 3, large-changed ratio ≤ 0.002
  (`compare-renderer-frames.ts:515`) — measured against a renderer that no longer
  exists. Item 5.1 was implemented, measured and reverted for exactly this: mean
  `1.456` against a limit of `1` (`artifacts/visual-polish/RESULT.md`).
- **The frozen Skia captures are not protected.**
  `scripts/verification/evidence-output.ts:3` guards only `artifacts/phase-04`,
  `-14`, `-19`, `-22` and `-23`. `artifacts/threejs-2d/` is not on that list, so
  nothing stops a capture run from overwriting the only copy of the Skia-versus-
  Three.js evidence.

This is the class of defect `artifacts/visual-polish/EVIDENCE-GAP.md` recorded: a
gate that reports a pass while measuring nothing. It was found once in the image
path and fixed. It survives in the mask path, in the light samples, and in the
choice of reference.

## Solution

Re-point the evidence corpus at the renderer that ships, restore the mask and
light-sample sides to live measurements, protect the Skia history, then land the
three techniques, each behind a gate that can fail.

From the player's side: one coherent pixel lattice across the frame at every
display scale; furniture and people with weight against the floor; lamplight that
falls off in visible steps.

From the maintainer's side: a renderer change that damages readability fails a
command instead of passing one.

## User Stories

1. As a player on a 1.25 or 1.5 DPR display, I want the whole frame rasterised on
   one lattice, so sprites, strokes and glow do not each sit at a different
   effective resolution.
2. As a player, I want that lattice to be the logical-pixel grid the art was drawn
   on, so a texel is a texel everywhere before the display scales it.
3. As a player on a 1× or 2× display, I want today's frame byte-identical, so a
   fix for fractional scales costs me nothing.
4. As a player, I want the low-resolution buffer upscaled with nearest-neighbour
   sampling, so the upscale does not reintroduce the blur it exists to remove.
5. As a player, I want the visible world extent unchanged at the locked window
   sizes, so I see exactly as much of the map as before.
6. As a player, I want furniture to read as objects sitting on the floor, so a
   room's purpose is legible at a glance.
7. As a player, I want a sofa to read as heavier than a table and a table heavier
   than a planter, so scale carries meaning.
8. As a player, I want a scaled prop to keep its feet where they were, so nothing
   sinks into the floor or hovers above it.
9. As a player, I want a scaled prop's contact shadow to stay under its feet, so
   the shadow does not detach when the prop grows.
10. As a player, I want the protagonist to stay the most legible figure on screen
    when scaled, so presence never costs me clarity.
11. As a player, I want scaled props never to cover a doorway or route they did
    not cover before, so scale never blocks a path I can walk.
12. As a player, I want lamplight to fall off in discrete steps, so light belongs
    to the same picture as the sprites.
13. As a player, I want lamplight to stay as bright as it is today, so stepping it
    does not dim the rooms that were only just made to read as lit.
14. As a player, I want the district light pools to stay circular and coherent
    when the shared glow texture changes.
15. As a player, I want lamp centres to stay brighter than unlit floor, so a lit
    room still reads as lit.
16. As a player, I want glow to keep obeying walls and roofs, so the step change
    does not undo the clipping that already shipped.
17. As a player, I want none of this to cost frame rate.
18. As a maintainer, I want the comparator's reference to be a capture from the
    renderer that ships.
19. As a maintainer, I want the mask side of every comparison produced by the run
    under test, so mask identity is a check rather than a tautology.
20. As a maintainer, I want the restored emitter to reproduce every existing
    frozen mask byte for byte, so phase 0 changes the source of the masks without
    changing their meaning.
21. As a maintainer, I want a mask whose sprite silhouette moved to fail.
22. As a maintainer, I want real light samples authored into the live manifests,
    so "lamp centres stay bright" is an assertion rather than a sentence.
23. As a maintainer, I want the frozen Skia captures write-protected before any
    capture runs, so retiring them as a reference cannot destroy them.
24. As a maintainer, I want the six villa fixtures actually removed from the live
    collection, not merely omitted from a sentence.
25. As a maintainer, I want a deliberately damaged renderer to fail the refreshed
    comparison.
26. As a maintainer, I want each technique in its own commit behind its own
    measurement, so one can be reverted without unpicking the others.
27. As a maintainer, I want a technique that cannot show its measurement reverted
    rather than have its threshold softened.
28. As a maintainer, I want the pure geometry of each technique testable without a
    window.
29. As a maintainer, I want draw calls and GPU resource counts re-recorded after
    each technique.
30. As a maintainer, I want the residual ACES gap stated rather than closed
    quietly.

## Implementation Decisions

### Phase 0 — the evidence corpus. Ships first, alone.

No technique may land before this phase is green.

**0.0 Protect the Skia history first.** Add `artifacts/threejs-2d` to
`HISTORICAL_EVIDENCE_ROOTS` in `scripts/verification/evidence-output.ts:3`
before anything else in this program runs. The frozen Skia captures are the only
record of a comparison that can no longer be made, and today any capture run
could overwrite them. One line, and it comes first.

**The guard alone is not sufficient, so 0.1 finishes the job.**
`refresh-candidate-captures.ts:81` copies straight to `manifest.candidate.image`
and never calls `resolveEvidenceOutputRoot`, so it writes wherever the manifest
points — today, inside `artifacts/threejs-2d`. Phase 0.1 retargets the candidate
paths as well as the baseline paths, so that after re-baselining nothing in this
program writes into that tree at all.

**0.1 Re-baseline against Three.js.** A new script re-points each live manifest's
`baseline.image` at a fresh capture from the current renderer, written into a new
evidence root, and rewrites `sourceCommit` to the re-baseline commit. The frozen
Skia PNGs stay exactly where they are, now guarded by 0.0, unreferenced. They are
retired as a reference, not deleted.

`compositingChanged` flips to **`false`** on every re-baselined fixture. It was
set because a layer had moved from the browser into the renderer. Both sides now
come from the same compositing path, so leaving it true keeps the Skia-era
relaxations and throws away the precision the re-baseline buys: exact native
readable-pixel-set identity at `compare-renderer-frames.ts:446` and the mask-local
family at `:529`. Clearing it restores both.

From this commit the corpus measures drift from the shipping Three.js renderer,
not parity with Skia. That is stated in the commit message.

**0.2 Restore the mask emitter.** The capture writes a mask frame per fixture from
the frame it just rendered. The manifest then points `candidate.masks` at that
fresh file and `baseline.masks` at the copy taken during re-baselining.

The emitter is a **pure module in `src/render/`**, not a script, so it is
reachable from Jest. It takes the placement, the zoom, the scale and an
`alphaAt(sprite, x, y)` callback; the capture script supplies the callback by
reading `assets/generated/world-atlas.png`. The packaged capture only has
`WorldFrameState` and a PNG, so the atlas lookup must be injected rather than
imported.

The rule is **recovered, not invented** — the deleted `playerFootprint` and
`integerRect` from `31566b6^`:

```
offset        = (captureLogicalSize − state.viewport) / 2      // 0 at every locked case
topLeft       = offset + (worldX − camera.x) × zoom
logicalBounds = integerRect(topLeft, w × zoom × scale, h × zoom × scale)
hitBounds     = integerRect(logicalBounds.x − 4×zoom, logicalBounds.y − 2×zoom,
                            32×zoom, 32×zoom)                  // from the ROUNDED bounds
id            = `player-protagonist-${fixtureId}`
kind          = 'player'
frameId       = `${sprite}:${zoom}`

grid width  = logicalBounds.width      // the ROUNDED size, not w × zoom × scale
grid height = logicalBounds.height
sample the atlas alpha at floor(x / (zoom × scale)), floor(y / (zoom × scale))
  transparent                      -> '0'
  opaque, silhouetteOnly is false  -> '1'
  opaque, silhouetteOnly is true   -> '1' only when a 4-neighbour in atlas
                                      space is transparent, i.e. an edge texel
silhouetteOnly = (devicePixelRatio === 1 && zoom === 1)
```

**The grid is sized from the rounded bounds, and this is not a detail.** The
deleted builder wrote `Array.from({ length: source.height * zoom })`, which is
safe only for integer zoom. Adding `scale` breaks it: 30 × 1.22 = 36.6 gives a
grid of **36** rows while `integerRect` rounds the bounds to **37**, and
`MaskSchema` hard-fails when the footprint height does not equal the bounds
height (`compare-renderer-frames.ts:23`). Phase 0.2 plus technique 4b would emit
an invalid mask. Sizing the grid from `logicalBounds` and sampling with `floor`
removes the disagreement at the source.

`hitBounds` derives from the **rounded** `logicalBounds`, not the raw top-left,
which is what the deleted builder did. `offset` is zero at every locked case
because the capture matches the case viewport, but it is written down so nobody
has to rediscover it.

`scale` is the only behavioural addition, and it is what lets technique 4 emit a
correct footprint. Mask identity compares the whole object (`:395`), so every
field above must be emitted, not only the footprint.

**The migration check is the point of this item.** Against the unchanged
renderer the emitter must reproduce every frozen mask byte for byte. There are
three families in the corpus and the rule above must produce all three:

| Family | Fixtures | Shape |
|---|---|---|
| DPR 1, zoom 1 | **4** | 24×30, **76 set cells** — an outline, not a filled silhouette |
| DPR 1.25 / 1.5 / 2, zoom 1 | several | 24×30, **442 set cells** — filled silhouette |
| zoom 2 | some | 48×60, **1768** cells — nearest 2× of the filled 24×30 |
| zoom 3 | the rest | 72×90, **3978** cells — nearest 3× of the filled 24×30 |

The four native fixtures are `northwest-1280x720-dpr1-zoom1`,
`southeast-1920x1080-dpr1-zoom1`, `northwest-2560x1440-dpr1-zoom1` and
`fallback-circle-1280x720-dpr1-zoom1`. They matter twice over: they are the only
outline family, and they are the only fixtures that become `perPixelNative` once
phase 0.1 clears `compositingChanged`.

If the reproduction is not exact, phase 0.2 is wrong and stops. An emitter that
produced filled footprints everywhere would silently change what every
readable-coverage number in the corpus means.

**"Exact" means the parsed mask structures are deep-equal, not that the files are
byte-equal.** JSON key order and whitespace are not part of the contract, and a
formatting difference failing this check would be a false alarm that teaches
people to ignore it. The test parses both sides and compares the objects.

**0.3 Split the collection, in code.** The 6 `villa-*` fixtures sit inside
`threejs-all-maps-v1.json` through manifests under `threejs-stage-3-specialized/`,
and there is a separate `threejs-villa-v1.json` naming the same ids through
different paths. Both must be named.

They cannot stay in the live set: `compare-renderer-frames.ts:600` hard-fails
when a nested fixture's `sourceCommit` differs from its set's, and the re-baseline
rewrites 19 of the 25. Excluding them from the headline number is also not a
sentence — `:608` reports `passed` over every nested fixture, so this is a code
change.

The 19 refreshable fixtures form the live set at the re-baseline commit. The 6
villa fixtures move to their own frozen-history set that keeps its original
`sourceCommit`, is reported separately, and is excluded from the headline count.
A villa capture runner is out of scope.

**0.4 Author light samples.** Every live fixture containing a lamp or a district
pool gains a `lightSamples` entry naming a lit rectangle at the source and an
unlit rectangle away from it. Without this, technique 7 has no gate at all and
the parent spec's item 5.2 has none either. The rectangles are authored once from
the re-baselined captures and are part of phase 0's diff.

**The unlit rectangle must be clear of every light source, not merely dark
today.** Each lamp glow quad is 88×88 world pixels and each district pool is an
ellipse of its own radius. Technique 7's plateaus are wider than the current
gradient's visible falloff in places, so an "unlit" rectangle chosen just outside
today's visible glow can become lit later in the same program — which would flip
the sample's meaning without anyone editing it. Unlit rectangles are therefore
placed outside every glow box and pool ellipse in the frame, by geometry rather
than by eye.

**0.5 Prove the new reference is not vacuous.** The existing capture-path damage
tests extend to the re-baselined corpus: a refresh that touches nothing fails; a
damaged candidate image fails; a mask frame with an altered footprint fails; an
untouched fixture still passes.

Two further discriminating tests are added here, raised by the concurrent session
against `compare-renderer-frames.ts` and deferred to this phase:

- the `1.02` readable predicate is a coverage test, not a content-identity test,
  and no test distinguishes the two;
- deleting the scaled mean, RMS or mask-local branch leaves the existing pass
  tests green, so those branches are unguarded.

Both are tests, not behaviour changes.

### The gate every technique actually runs

Both reviewers established independently that **no technique can pass the
whole-frame RGB family**, and that this is arithmetic rather than tuning. Item
5.1 failed those limits with a far smaller change than any of these three.

Revision 1 conceded a post-landing re-baseline for technique 4b only. That was
wrong by omission. But per-technique re-baselining *alone* leaves nothing that can
fail, which is the vacuity this spec exists to kill. So the gate is both halves:

1. **Land the change, capture, compare against the immediately preceding
   baseline**, with the readability family fully enforced: live mask identity,
   contrast retention ≥ `0.9`, readable coverage ≥ `0.95`, the `1.05` baseline
   contrast floor, and the phase-0.4 light samples. This half can fail. Item 5.1
   failed exactly it, at `0.8967` retained contrast.
2. **Only if it passes, re-baseline**, so the next technique measures from here.
   The damage tests re-run against the new reference each time.

Where the RGB-delta families cannot hold, they are switched off **per fixture, by
name, and only after being measured**. A single manifest boolean
`rasterResampled` is added, defaulting to `false`.

**It reclassifies the fixture to the readability-only family.** This is the
correction round 2 forced, and it is the load-bearing sentence in this spec, so
it is written as a table rather than as prose. Clearing `compositingChanged` in
phase 0.1 arms four delta families, not one, and a selector covering only the
whole-frame family would leave technique 7 and technique 1 unable to report a
pass at all.

| Check | Line | With `rasterResampled` |
|---|---|---|
| Mask identity — bounds, hit bounds, footprint | `:395` | **on** |
| Baseline contrast floor `1.05` | `:425` | **on** |
| Contrast retention `0.9` | `:428` | **on** |
| Readable coverage | `:446` / `:450` | **on**, forced to the retention branch (`≥ 0.95`) rather than exact-set identity |
| Light samples | `:543` | **on** |
| Shadow samples | `:550` | **on** |
| Required-mask channel delta `≤ 8` | `:456` | off |
| Native outside-mask ratio `≤ 0.005` | `:486` | off |
| Scaled outside-mask ratio `≤ 0.12` | `:491` | off |
| Whole-frame mean / RMS / large-ratio | `:515` | off |
| Mask-local family | `:529` | off |

Every RGB-delta family goes off; every readability family stays on. The exact
readable-pixel-set identity branch at `:446` falls back to the `0.95` retention
branch, because a deliberate lattice or shading change moves pixels inside the
mask by design while readability is exactly what must survive.

**Only that one branch moves.** The "baseline has no readable pixels against its
ring" failure at `:444` stays live under the selector. It is the check that a
mask carries any signal at all, and a fixture that lost its signal entirely must
still fail however its raster changed.

Whether a given technique needs the selector, and on which fixtures, is a
measurement rather than an assumption. Each technique runs the comparison first
with the selector off and records the real numbers into
`artifacts/visual-polish/`. Only fixtures that actually exceed a family get the
selector. The reviewers disagreed about whether technique 7 trips the whole-frame
family; that is settled by running it, not by choosing a side here.

**This amends section 6 of the visual-polish spec**, which forbids new measurement
families. Four things in this spec are new and are named rather than smuggled:
the `rasterResampled` selector, byte-identity hashing for the unchanged DPR 1 and
DPR 2 fixtures, technique 4b's readable-pixel-count claim, and the glow ramp
table. The honest statement is that the old contract cannot hold for these three
techniques.

### Technique 7 — stepped light-map glow

Ships first among the techniques, because once phase 0.4 exists it has the
clearest failable gate and the smallest blast radius.

**Module:** `src/render/three/world-renderer.ts`, `generatedGlowTexture`.

**Decision.** The eight-stop smooth gradient becomes **discrete radial plateaus**
— concentric bands sampled with `NearestFilter` and no mipmaps. The ramp is an
exported pure table of `[radiusFraction, alpha]` pairs so its shape is testable
without a canvas.

**The last pair is explicitly `[1, 0]`.** Production's gradient reaches zero at
the rim, and the pools' fan rim sits exactly on that radius — the trap the comment
at `world-renderer.ts:338` records. An outermost plateau with any alpha left in it
would put a hard ring at the edge of every pool.

**Keep the spike's step count. Do not keep the spike's alphas.** The spike ran
0.04 to 0.12 (`scene-2d.js:127`). Production's centre stop is `1`
(`world-renderer.ts:332`). Shipping the spike's alphas would recreate the "glow
reads as nothing" bug that the additive-glow work fixed. Technique 7 quantises
production's existing brightness envelope into plateaus; it does not import the
spike's brightness.

**Radial, not nested squares.** This texture is the map for two batches
(`world-renderer.ts:421`, `:433`). `lamp-glow` samples it with axis-aligned quad
UVs over an 88×88 box (`:776`). `district-light-pools` samples it through
`addEllipse`'s **disc** UVs — a fan whose rim sits on the radius-0.5 circle
(`:196`), which the comment at `:338` already warns about. Nested squares under
disc UVs reach zero on the axes but cut hard on the diagonals: anisotropic
banding and a square edge inside every pool.

**The two consumers will still look different, and that is expected.** Quad UVs
show the plateaus as concentric squares clipped to the lamp box; disc UVs show
them as concentric rings. Radial plateaus make both correct; they do not make
both identical. Anyone comparing a lamp against a pool should expect that.

**What must survive.** The lamp-glow batch skips lamps under `roofedCells` and
clips the remaining glow to `shelterCells` with adjusted UVs, landed at
`5614f98`. Technique 7 replaces the texture only. The clipping, the roof skip and
the adjusted UVs stay — and those adjusted UVs are a second reason the ramp must
be radial, since a clipped quad samples an off-centre sub-rectangle.

**Measure.** The phase-0.4 light samples on every lamp-bearing and pool-bearing
fixture, plus a unit test that the ramp is monotonic, has exactly the authored
plateau count, and reaches zero at the rim. Banding is judged by decoded
inspection; no radial-monotonicity measurement exists and this spec does not add
one.

**Rejected alternative.** A second glow texture so pools keep a smooth falloff.
That spends the schema's texture ceiling of two
(`scripts/electron/run-renderer-capture.ts:29`) and leaves two visual languages
for light in one frame.

### Technique 4a — authored prop scale

**Module:** `src/render/world-frame.ts`, at `placement()` (line 313). The
renderer already multiplies `placement.scale` into its quad, so no renderer change
is needed.

**Decision.** A scale table keyed by sprite id: planters and tables `1.08`, sofas
`1.12`. Anything absent stays at `1`.

**The table names real atlas ids, and a test enforces that.** Production uses
`tile.flowering-market-planter` alongside `tile.fixture-planter`, and the spike's
key set does not cover it — a spike-only table would leave the southwest market
unscaled and make 4a look like a no-op there. A unit test asserts every key in
the table exists in `assets/generated/atlas-index.json`.

**Scale is applied about the bottom centre.** `addAtlasPlacement` maps the quad to
`worldX .. worldX + width × scale` with y growing down (`world-renderer.ts:207`,
`:114`), so a top-left anchor sinks the sprite's feet below the ground line.
Adjusting `worldX` by `−(scale−1) × width / 2` and `worldY` by
`−(scale−1) × height` keeps the feet and the horizontal centre fixed.

**Contact shadows are computed before the adjustment.** `propShadows` derives its
position from the prop's `worldY` (`world-frame.ts:385`, `worldY: bottom + 25`).
Shifting `worldY` upward moves the shadow with the origin instead of leaving it at
the feet, so the shadow detaches. The scale adjustment therefore happens after
`propShadows` reads the unscaled ground line. A test asserts the shadow's world
position is identical with and without the scale table.

**Two consequences accepted rather than solved.**

- Sofas and tables are two placements each (`tile.sofa-left`, `tile.sofa-right`),
  authored as adjacent tiles in `content/maps/northeast.json` and
  `southwest.json`. Bottom-centre scaling each part overlaps the join by a few
  pixels and grows into neighbour tiles. The spike did exactly this, so it is the
  intended look. The route-overlap test covers these pairs explicitly and defines
  the footprint as the scaled axis-aligned bounds, not the alpha silhouette.

**The cover predicate is tile-centre, and it has to be.** An unscaled prop's
bounds are one 32×32 tile, so *any* scale above `1` intersects its neighbours by
construction — a predicate of "intersects a door or route tile" would fail 4a
everywhere next to an aisle and would say nothing about playability. The test
therefore asks whether the scaled bounds cover a neighbouring tile's **centre**,
which is the point a walker actually occupies. A prop that grows a few pixels
past a tile edge passes; one that grows far enough to sit under the middle of a
door or route tile fails.

"Route tile" means the walkable set derived from the compiled map source, not a
hand-listed set of coordinates. Deriving it is the only way the test stays true
when a map changes.

One further consequence accepted rather than solved: `propShadows` widths are
sprite-keyed constants (`world-frame.ts:351`) and do not grow, so a scaled sofa's
contact shadow is slightly narrow.

**Measure.** Readability unchanged on every required mask, the light samples, and
no door or route tile newly covered.

### Technique 1 — integer low-resolution buffer

Ships third, not first. It is the largest whole-frame pixel change of the three
and the one most like item 5.1, so it goes after the two techniques that can be
measured without the `rasterResampled` selector.

**Module:** `src/render/three/coordinate-contract.ts`, plus the canvas CSS in
`src/render/ThreeWorldSurface.tsx:31`.

```
threeRenderScale(dpr)  = max(1, floor(dpr))            // 1 → 1, 1.25 → 1, 1.5 → 1, 2 → 2
threeDrawingBufferSize = viewport × threeRenderScale(dpr)
threeRasterViewport    = drawingBuffer / threeRenderScale(dpr)
```

**The third line is a required edit, not a restatement.** Today
`threeRasterViewport` divides by `devicePixelRatio`
(`coordinate-contract.ts:10`). Changing only the buffer size and leaving that
divisor shrinks a 2560×1440 DPR 1.25 camera to 2048×1152, moving every mask and
breaking story 5. Both functions change together or neither does.

`threeRasterViewport` feeds `threeCameraBounds` (`coordinate-contract.ts:20`), so
at the locked window sizes the visible world extent is identical before and after,
because `viewport × dpr` is an integer there.

**The extent is not unchanged at arbitrary window sizes, and the existing test
proves it.** `src/render/__tests__/three-world-renderer.test.ts:19` locks
`threeRasterViewport(1411×871, 1.25)` at `1410.4×870.4`, the truncation the Skia
baseline had. After this change it becomes `1411×871`. That test must be updated
with the reason, and story 5 is scoped to the locked window sizes rather than to
every window size. The change is an improvement — the raster viewport stops
losing a fraction of a pixel — but it is a change, and claiming otherwise would
be false.

At DPR 1 and DPR 2 the buffer is byte-identical to today. Only DPR 1.25 and 1.5
change: 4 fixtures each.

`image-rendering: pixelated` goes on the **raw canvas created at
`ThreeWorldSurface.tsx:31`**, not on the React Native host `View` at `:77`.
`AtlasSprite` already sets it for HUD sprites (`src/ui/AtlasSprite.tsx:43`); the
world canvas does not.

**What this technique claims, and what it does not.** It does **not** put every
art texel on a whole number of device pixels. It cannot: with the extent pinned, a
1× buffer upscaled ×1.25 gives a 1,1,1,2 device-pixel cadence — the same cadence
the Problem Statement complains about. What it buys is that the *whole frame* now
rasterises on one lattice and is resampled once, uniformly, by the display,
instead of sprites, strokes and glow each landing on a fractional grid
independently. That is judged by decoded inspection recorded in
`artifacts/visual-polish/`. The readability gates pass before and after, so they
cannot judge whether this technique achieved anything; saying otherwise would be
another gate that measures nothing.

**One invariant to pin, because it survives only by accident.**
`compare-renderer-frames.ts:366` requires the image to be `round(viewport × DPR)`.
That still holds only because captures come from `webContents.capturePage`
(`electron/main/index.ts:145`), which reads the composited window at device scale
— including the CSS upscale — not the drawing buffer. **Do not change that
check**, and do not "improve" the capture to read the canvas buffer: either would
break every fractional-DPR fixture with a hard throw. This is written as a comment
into both files.

**Enforcing "unchanged at DPR 1 and DPR 2."** The comparator cannot prove it:
`nativeRaster` is only `dpr === 1 && zoom === 1` (`:384`), so DPR 2 never uses
native limits, and even the strictest family tolerates channel deltas. Byte
identity is asserted directly instead, by hashing the DPR 1 and DPR 2 candidate
PNGs against their baselines in the capture-path test. `rasterResampled` is set
only on the eight fractional-DPR fixtures, and only after their real numbers are
recorded.

**Zoom sampling is unaffected.** `zoom-sampling-v1.json` is a DPR 1 comparator
self-test, and the live zoom crops run only at `devicePixelRatio === 1`
(`electron/main/index.ts:1005`). Technique 1 does not change the DPR 1 buffer.

**Rejected alternative.** Snapping the camera to whole device pixels was item 5.1
and was reverted. It treated the symptom at the camera and left the lattice
fractional.

### Technique 4b — authored character scale

Ships last. It is the only item that changes the size of a gameplay-legibility
element, and the only one that moves a required mask.

**Decision.** Characters scale at `1.22`.

**Scale is applied about the placement pivot, not the axis-aligned bounds.** The
protagonist is 24×30 and its wobble pivot is `{x: 12, y: 29}`
(`src/render/protagonist-wobble.ts:5`), while `addAtlasPlacement` rotates about
`(worldX + pivot.x × scale, worldY + pivot.y × scale)` (`world-renderer.ts:213`).
A bounds-based adjustment and a pivot-based one cannot both be exact unless the
pivot is exactly bottom centre, which it is not.

Pivot-invariant scaling is chosen, because keeping the rotation centre correct
matters more than a sub-pixel foot line, and because moving the pivot to `{12, 30}`
would change the shipped wobble and its locked tests.

**The drift budget is world-space, and converting it to device pixels needs
zoom.** At scale 1.22 the foot line drifts `(30 − 29) × 0.22 = 0.22` **logical**
pixels. Screen drift is `0.22 × zoom`; device drift is `0.22 × zoom × dpr`. The
worst locked pair is zoom 3 at DPR 2, which is `1.32` device pixels — not the
sub-half-pixel this spec previously claimed. So the unit test asserts the
world-space drift is `0.22` logical pixels and no more, and the per-fixture device
consequence is recorded rather than bounded by a number that only held at zoom 1.
If decoded inspection shows the foot line reading wrong at zoom 3, the fallback is
moving the pivot to `{12, 30}` and re-locking the wobble tests. That fallback is
named now so it is a decision rather than a surprise.

**Scope.** The lookup is by **actor kind**, not by sprite id: every character
placement scales, whatever its atlas key, so the table does not have to enumerate
every `character.*` entry. Props stay keyed by sprite id. Only the protagonist
carries a required mask, so only the protagonist has a per-character readability
gate; NPC scale is covered by the whole-frame comparison alone. That is a fact of
the corpus, not a new hole.

**The ring must be rebuilt from the union of the two mask bounds first.** Round 3
found that revision 4's acceptance criteria read a spoiled number. The comparator
samples the mask foreground on the candidate image, but it builds the ring
rectangle from `baselineMask.logicalBounds` and then deletes only the baseline
footprint (`:402`–`:417`). 4b grows the sprite about 6.4 logical pixels upward
against a 2-pixel ring, so the scaled silhouette fills its own ring:
`candidateRing` becomes sprite rather than floor, `candidateContrast` collapses
toward `1`, and `candidateReadablePixels` falls — all for a reason the change did
not cause.

The fix is a few lines in the comparator, and it is smaller than the three options
round 3 offered. The ring rectangle and the interior rect deleted from it derive
from the **union** of the baseline and candidate mask bounds instead of the
baseline bounds alone. The cross-mask footprint deletion at `:414` is unioned too:
it removes only the *baseline* footprints of the other required masks, so on a
multi-mask fixture a neighbour that grew would leave a fringe inside this mask's
ring — the same defect, one mask over. That case is moot today, because the only
multi-mask fixture is frozen history, but it costs three lines to close.

The outside-mask counting at `:475`–`:484` stays on the baseline-only set. Those
families measure change against the baseline, which is what they are for.

For every fixture whose mask does not move, the union equals the baseline bounds
and nothing changes — provable by re-running the corpus and requiring
byte-identical reports, which is part of this item's diff, run after phase 0.2 so
the masks being unioned are live output. For 4b, the ring sits outside the larger
silhouette and measures floor, which is what a ring is for.

This is a **third** comparator change and it amends the two named in Out of Scope.
It is taken rather than a 4b-only flag or a duplicated measurement script, because
the union is simply more correct: any future change that grows a mask would
otherwise spoil its own ring the same way, silently.

**With the ring corrected, 4b has a real gate rather than a report diff.**
Acceptance is:

- `candidateContrast` stays at or above the `1.05` readable floor, and contrast
  retention at `:428` holds at or above `0.9` — this is now a genuine measurement
  and is expected to pass;
- the protagonist's `candidateReadablePixels` does not fall below the pre-4b run;
- the scaled figure covers no door or route tile centre it did not cover before.

**4b runs with `rasterResampled` on, and that is what makes its failure set
sayable.** This spec named the set wrongly twice, so the reasoning is recorded.
With the selector off, `:456` fires on all four native fixtures with certainty —
it measures `maximumChannelDelta` over the *baseline* footprint, and rescaling the
sprite rewrites its interior far past 8 counts — and `:529` probably fires on the
other 15 for the same reason. Neither is damage. Both are the mask interior being
redrawn, which is precisely what 4b is.

With the selector on, `:456`, `:486`, `:491`, `:515` and `:529` are off and `:446`
falls back to `:450`. The expected failure set is then uniform:

| Line | Check | When |
|---|---|---|
| `:395` | mask identity | always — the footprint grows by design |
| `:450` | readable-coverage retention overlap | always — the pixel indices move |

`:428` contrast retention stays live and is **not** in that set. If it fires, 4b
damaged readability and is reverted. That is the whole reason to prefer the
selector here: one true sentence about what fails, and one check that can still
stop the item.

Those three lines and the failing verdict are recorded in
`artifacts/visual-polish/` alongside the numbers. A green run would mean the
silhouette did not move, which would mean 4b did not happen.

**Separable.** 4b may be cut without touching 4a, 7 or 1.

**Content or code.** The scale table is TypeScript in `src/render`, not
`content/`. It is a presentation constant tied to atlas sprite ids, in the same
class as `LAMP_SPRITE_IDS`, and it never reaches the domain or world rings.

### The tension between technique 1 and technique 4, owned

Scales of 1.08 to 1.22 are non-integer texel scales — the same "photo-editor
resize" texture technique 1's Problem Statement condemns. The spike did both
deliberately. Technique 1 governs the frame's rasterisation lattice; technique 4
is an authored art decision about object weight, applied on that lattice. The
tension is real and is named here rather than left implicit in two contradicting
rationales.

### What no item may do

Every hard constraint from `docs/specs/2026-08-16-threejs-visual-polish.md`
section 3 applies unchanged: gameplay clarity outranks decoration; nearest
sampling holds; atlas draw calls stay at or under 12 and all world rendering at or
under 24; the renderer stays presentation-only with no clock and no randomness of
its own; no renderer state reaches saves or preferences.

The locked rule holds: an item that cannot show its measurement is reverted, not
softened.

## Testing Decisions

A good test here asserts external behaviour: the numbers the renderer produces and
the pixels it draws, never the shape of the code. Item 5.1 is the cautionary prior
art — five unit tests passed while the change broke a readability floor, because
all five tested the transform and none tested a frame. So every technique carries
a headless test of its pure function *and* a pixel measurement, and the pixel
measurement decides.

**Seams, highest first.** One new module, no new seam.

| Seam | Kind | Covers | Prior art |
|---|---|---|---|
| `qualify:renderer` over the re-baselined corpus | pixel | every technique | `scripts/qualification/__tests__/compare-renderer-frames.test.ts` |
| `capture:renderer` → `capture:refresh` damage tests | pixel path | phase 0, byte identity | `scripts/qualification/__tests__/capture-path.test.ts` |
| `src/render/three/coordinate-contract.ts` | pure | technique 1 | `src/render/__tests__/three-world-renderer.test.ts` |
| `src/render/world-frame.ts` | pure | techniques 4a and 4b | `src/render/__tests__/world-frame.test.ts` |
| the mask emitter module in `src/render/` | pure | phase 0.2 | new; injected `alphaAt` keeps it headless |

Technique 7 needs one reachable point rather than a new seam: the plateau ramp is
exported as a pure table, because the Jest environment has no canvas and
`generatedGlowTexture` cannot run there.

**Modules under test.**

- `coordinate-contract`: render scale is `1` at DPR 1, 1.25 and 1.5 and `2` at DPR
  2; the drawing buffer is always an integer multiple of the viewport; camera
  bounds and visible extent are unchanged at every locked window size and zoom;
  the odd-window case at `three-world-renderer.test.ts:19` is updated to
  `1411×871` with its reason.
- `world-frame`: a sprite in the table renders at its authored size; one absent
  renders at `1`; every table key exists in the atlas index; the bottom-centre
  anchor is invariant under scale; prop shadow world positions are identical with
  and without the table; a scaled prop covers no door or route tile it did not
  cover before, including the two-tile sofa and table pairs.
- the character pivot: pivot-invariant scaling keeps the world-space foot drift at
  `0.22` logical pixels, with the per-fixture device consequence recorded rather
  than asserted, because it scales with zoom.
- `tests/fixtures/rendering/world-frame-v1.json`: 4a and 4b move the locked frame
  hashes, currently `4c8b8ce2` and `033d052c` (`world-frame.test.ts:4`, `:73`).
  Updating them is part of each item's diff, with the reason, not incidental
  churn.
- the glow ramp: monotonic, exactly the authored plateau count, zero at the rim,
  and a centre alpha matching production's current brightness rather than the
  spike's.
- the mask emitter: against the unchanged renderer it reproduces all three frozen
  families byte for byte — the 76-cell DPR 1 zoom 1 outline, the 442-cell filled
  silhouette, and the 2×/3× zoom expansions — including `frameId`, `hitBounds`
  and `id`; a scaled character emits scaled bounds with `Math.round`.

**Pixel measurements, per technique.**

- Technique 7: light samples pass on every lamp-bearing and pool-bearing fixture;
  pools stay circular by decoded inspection; the roof skip and shelter clipping
  still hold; the whole-frame numbers are recorded before any selector is set.
- Technique 4a: readability unchanged on every required mask; no door or route
  tile newly covered; shadows still under their props.
- Technique 1: DPR 1 and DPR 2 candidates hash equal to their baselines; the eight
  fractional-DPR fixtures hold contrast retention ≥ `0.9` and readable coverage
  ≥ `0.95` with their recorded numbers and `rasterResampled: true`. The hash check
  is meaningful only on technique 1's first-half run — after its re-baseline the
  hashes are trivially equal, so it is asserted there and nowhere else.
- Technique 4b: the run reports `passed: false` by construction. Acceptance is the
  report diff described above, and the two expected failure lines are recorded.

**Where inspection evidence lands.** Decoded-inspection claims for techniques 1
and 7 are recorded in `artifacts/visual-polish/`, beside `RESULT.md`, with the
decoded crops. An inspection claim with no recorded artefact does not count.

**Every capture is taken from the hidden, game-muted packaged window**, per
`AGENTS.md` and `CLAUDE.md`. No test here may open a visible window, take
foreground focus, or play audio.

## Out of Scope

- **The ACES gate.** Production runs ACES; the capture pins `toneMapping: none`
  because the locked manifests are no-tone, and the enhanced ACES manifest set no
  longer exists. Re-baselining does not close that gap. Anything visible only
  under the ACES curve still has no pixel gate. Named, not fixed.
- **A villa capture runner**, and therefore reviving the six frozen villa
  fixtures.
- **The four remaining visual-polish items** — 5.2 dithered pools, 5.3 rim light,
  5.4 grading, 5.5 ground wave. Technique 7 touches the same glow texture as 5.2
  and is deliberately the smaller change; phase 0.4 gives 5.2 the light samples it
  already assumed it had.
- **Item 5.1**, the camera-origin snap. It stays reverted.
- **The seven handoff techniques already implemented.**
- **Comparator behaviour changes beyond three**: the `rasterResampled` selector,
  the fixture-set split, and the union-of-bounds ring for technique 4b.
  Everything else added to that file is tests. The third was added in round 3 and
  is justified where it is specified.
- Any change to simulation, saves, maps, input, audio, content, or the atlas.

## Further Notes

**What review changed.** Recorded because the corrections are the same class of
defect the spec exists to close, and hiding them would repeat the mistake at one
remove. Both reviewers confirmed all four factual claims about the current code;
everything below is a defect in the plan, not in the diagnosis.

- Technique 7's stated gate gated **nothing**: one light sample exists across 25
  fixtures, on a frozen fixture, sampling a patio fire rather than a lamp. Phase
  0.4 now authors them. *(Both reviewers.)*
- The stepped ramp was specified as nested squares, copied from the spike without
  tracing the pools' disc UVs, in a spec claiming to have traced them. Radial now.
  *(Both.)*
- The spike's step alphas run 0.04–0.12 against production's centre stop of 1.
  Shipping them would recreate the "glow reads as nothing" bug. Step count kept,
  alphas not. *(Grok.)*
- The whole-frame RGB family cannot pass for **any** technique, not just 4b.
  *(Both.)* Whether each technique needs the selector is now measured rather than
  assumed, because the reviewers disagreed about technique 7.
- `threeRasterViewport` divides by `devicePixelRatio` today. Revision 2 wrote the
  new formula as though it were already true; changing only the buffer size would
  shrink every fractional-DPR camera. *(Grok.)*
- `artifacts/threejs-2d/` is **not** write-protected. Revision 2 claimed it was.
  Phase 0.0 now adds the guard before anything runs. *(Grok.)*
- Excluding the villa fixtures needs a code change at
  `compare-renderer-frames.ts:608`, not a sentence. *(Grok.)*
- Technique 1's headline claim was arithmetically false at fractional DPR, and the
  "extent unchanged at every DPR" claim is false for odd window sizes — the
  existing test at `three-world-renderer.test.ts:19` proves it. *(Fable, then
  Grok with the test.)*
- Phase 0.2's footprint rule would have produced filled silhouettes where the
  frozen DPR 1 masks are outlines. The real rule is recovered from `31566b6^`, and
  the emitter must also emit `frameId`, `hitBounds` and `id`. *(Fable, then Grok
  on the fields and the three families.)*
- 4b cannot keep both the axis-aligned foot line and the wobble pivot. Pivot-
  invariant scaling is chosen and the 0.22 px cost is tested. *(Grok; Fable had
  called it negligible.)*
- 4a's `worldY` shift would detach prop contact shadows. *(Grok; Fable had called
  it undersizing.)*
- The scale table must name real atlas ids, or the market planter goes unscaled.
  *(Grok.)*
- Phase 0.3 collided with the `sourceCommit` invariant at `:600`. *(Fable.)*
- `compositingChanged` should flip to `false` at re-baseline. *(Fable.)*
- The corpus is 25 fixtures, not 19. *(Author, before review.)*
- Ordering changed from `1 → 7 → 4a → 4b` to `7 → 4a → 1 → 4b`. Revision 1's
  rationale assumed threshold budget carries between techniques; it does not. The
  real reason to order is risk: 7 and 4a may be measurable without the selector,
  and technique 1 is the item most like 5.1. *(Grok.)*

**What round 2 changed.** Both reviewers verified the round-1 fixes against the
code and confirmed them, including replaying the recovered `playerFootprint` on
the current atlas to reproduce all four frozen mask families exactly. One
load-bearing defect and six smaller ones remained.

- **The selector covered one family of four.** Clearing `compositingChanged` arms
  native `:456` and `:486`, scaled `:491` and `:529`, and the exact-identity
  branch at `:446` — none of which `rasterResampled` touched. Technique 7 repaints
  district pools on every map, tens of thousands of pixels against a 4,608-pixel
  budget at 1280×720, so it could not have passed a native fixture. The selector
  now reclassifies the fixture to the readability-only family, spelled out as a
  table. *(Both reviewers, independently — the strongest signal this review
  produced.)*
- **4b's run fails by construction** at `:395` and `:450`, so its acceptance is a
  diff of recorded measurement fields, not the run's verdict. The comparator
  computes candidate contrast and coverage against the candidate mask, which
  supports that better than revision 3 claimed. *(Both.)*
- **The scaled mask grid disagreed with its own bounds.** 30 × 1.22 gives a
  36-row grid against 37-row rounded bounds, which `MaskSchema` rejects. The grid
  is now sized from `logicalBounds`. *(Grok.)*
- **The 4b drift budget ignored zoom.** Device drift is `0.22 × zoom × dpr`, so
  the worst locked pair is `1.32` device pixels, not `0.44`. The budget is now
  world-space and the device consequence recorded. *(Grok.)*
- **4a's cover predicate failed by construction**: any scale above 1 intersects a
  neighbouring tile. It is tile-centre now. *(Grok.)*
- **Phase 0.0's guard was partial.** `refresh-candidate-captures.ts:81` writes
  wherever the manifest points, so 0.1 retargets candidate paths too. *(Grok.)*
- Two errors of fact: the native family has **4** fixtures, not 2 *(Fable)*, and
  the topLeft/hitBounds formulas were missing from the recovered rule *(Grok)*.
- The rollback target went stale twice during review. It is now the parent of the
  phase-0.0 commit rather than a hash. *(Both.)*

**What round 3 changed.** Fable approved revision 4 outright, with six
implementation residuals, all of which are now written into the text: the `:444`
no-readable-signal failure stays live under the selector; unlit rectangles are
placed outside every glow box and pool ellipse by geometry; the emitter migration
check compares parsed structures rather than file bytes; the ramp's last pair is
explicitly `[1, 0]`; route tiles come from a derived walkable set; and the frame
hashes and HEAD are re-checked at land time.

Grok found one more defect, in the fix itself. Revision 4's 4b acceptance read
`candidateContrast` and `candidateReadablePixels`, but the comparator builds the
ring from the **baseline** mask bounds, so a grown silhouette fills its own ring
and spoils both numbers. Revision 4 also named the expected failure set wrongly:
`:446` fires on the four native fixtures rather than `:450`, and `:428` would have
fired too. The union-of-bounds ring fixes the cause; the failure set is now a
table. This is the third comparator change and it was not in the plan before
round 3.

**Review status at the round cap.** Fable approved revision 4. Grok approved
phase 0, technique 7, technique 4a and technique 1 as implementable, and held
technique 4b. The 4b fix above answers that hold but was written after the final
round, so it is the one part of this spec no reviewer has seen. 4b ships last, so
it goes through the implementation-plan review before any of it is written.

**Concurrency.** Another session is working in this worktree. The claim and the
reply are in `artifacts/visual-polish/HANDOFF-CLAIM.md`. Three of its notes are
folded in: the deferred comparator tests (phase 0.5), the glow clipping technique
7 must preserve, and `tests/fixtures/rendering/world-frame-v1.json`, whose locked
hashes moved to `4c8b8ce2` and `033d052c` and which this work rebases over.

**Ordering.** Phase 0, then technique 7, then 4a, then 1, then 4b.

**Rollback.** Each item is one commit behind its own measurement, and each ends
with its own re-baseline, so reverting an item also reverts the baseline it wrote.

**The program's rollback target is the parent of the phase-0.0 commit, recorded
when that commit lands.** It is deliberately not a hash written in advance. This
worktree is shared and moving: the target was `d4a1a24` in revision 1, `33609af`
in revision 3, and is `9c2f8e2` as this line is written, with another session's UI
fix (`f51c709`) among the commits in between. Reverting to a hash chosen earlier
would destroy work that is not part of this program. A hash written into a spec in
a shared worktree is stale the moment it is written; the parent of a known commit
is not. For the same reason, the locked frame hashes in
`tests/fixtures/rendering/world-frame-v1.json` and the value of HEAD are both
re-checked when phase 0.0 lands rather than taken from this document.

**Publishing.** The repository has no configured issue tracker, so this spec lands
in `docs/specs/` per the convention in `CLAUDE.md`.
