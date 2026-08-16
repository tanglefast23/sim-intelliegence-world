---
title: Handoff pixel techniques 1, 4 and 7
type: feature
date: 2026-08-16
spec: docs/specs/2026-08-16-handoff-pixel-techniques.md
baseline: recorded when commit 0.0 lands; see the spec's Rollback section
---

# Handoff pixel techniques implementation plan

Revision 3, after two rounds of plan review by Fable 5 and Grok 4.6. Fable
approved revision 2. Grok held it on two defects — a mask-only promote that
cannot go green, and a 0.3 throw test that would have been red on arrival — both
fixed here and both verified against the code first.

## 1. Outcome

Ship handoff techniques 7, 4a, 1 and 4b from
`spikes/001-threejs-pixel-villa/scene-2d.js`, each as its own commit behind its
own measurement, on top of an evidence corpus that can fail.

Nothing in section 5 starts until section 4 is green.

## 2. Locked rules

1. Presentation only. No change to simulation, saves, maps, input, audio,
   content or the atlas.
2. Atlas draw calls stay at or under 12. All world rendering stays at or under
   24. GPU textures stay at or under 2.
3. Nearest-neighbour sampling survives every commit.
4. An item that cannot show its stated measurement is reverted, not softened.
5. No item weakens an existing gate to make itself pass.
6. Every capture runs hidden and game-muted. No visible window, no foreground
   focus, no audio, per `AGENTS.md` and `CLAUDE.md`.
7. This worktree is shared. Stage by path. Never `git add -A`. Re-read
   `artifacts/visual-polish/HANDOFF-CLAIM.md` immediately before each commit
   **and immediately before 0.1**, which freezes whatever the renderer is at that
   moment.
8. **`npm run package:electron` runs before every capture**, from the commit
   under test. `capture:renderer` drives a packaged executable
   (`run-renderer-capture.ts:108`), so a stale package silently measures old code.
9. `src/render/mask-frame.ts` is never imported from the live renderer path. The
   `alphaAt` callback stays injected, so no `pngjs` or `node:fs` reaches the Expo
   bundle.

## 3. Order

`0 → 7 → 4a → 1 → 4b`, chosen by risk. Threshold budget does not carry between
items — each re-baselines behind itself — so the order is about which item is
most like the reverted 5.1, not about spending a budget.

Inside phase 0 the order is `0.0 → 0.3 → 0.1 → 0.2 → 0.4 → 0.5 → 0.6`.

**0.3 precedes 0.1 for a hard reason.** Re-baselining rewrites `sourceCommit` on
the live manifests, and `compare-renderer-frames.ts:600` **throws** rather than
failing when a nested fixture disagrees with its set. Rewrite the set's SHA and
the six villa rows throw; leave it and the nineteen live rows throw. Splitting
first gives 0.1 a set whose rows it can rewrite coherently.

## 4. Phase 0 — the evidence corpus

Seven commits.

### 0.0 Guard the Skia history

- Add `artifacts/threejs-2d` to `HISTORICAL_EVIDENCE_ROOTS` in
  `scripts/verification/evidence-output.ts:3`.
- Record the parent commit SHA in `artifacts/visual-polish/RESULT.md`, in this
  same commit. It is this program's rollback target and needs a home.
- Re-read `world-frame-v1.json`'s locked hashes and HEAD; both moved during
  review.

**Verify:** extend the existing guard test at
`tests/electron/package-smoke.test.ts:79` — the `resolveEvidenceOutputRoot`
immutability suite, which is exactly this seam. Do **not** write
`npx jest scripts/verification`: `jest.config.js:5` matches only `__tests__`
directories and `scripts/verification/__tests__` does not exist, so jest exits
with "No tests found" rather than running anything.

**Known limit, closed by 0.1, not by this commit.** The guard works through
`resolveEvidenceOutputRoot`. `refresh-candidate-captures.ts:81` never calls it and
copies straight to `manifest.candidate.image`. Until 0.1 retargets those paths, a
refresh can still write inside `artifacts/threejs-2d`. **Do not run
`capture:refresh` between 0.0 and 0.1.**

### 0.3 Split the collection

**There are two different villa collections, not one, and they hold different
evidence.** Plan review caught this; both were verified before writing it down:

| Collection | Set SHA | Images |
|---|---|---|
| `threejs-stage-3-specialized/` — the 6 rows inside the live set | `6ec433dd` (**same as the live set**) | `stage-6/captures/specialized/` |
| `threejs-villa/` via `threejs-villa-v1.json` | `701a8fd0` | `stage-2/captures/` |

- Move the six `villa-*` rows out of `threejs-all-maps-v1.json` into a frozen
  set that keeps `6ec433dd`. Name in the commit which of the two collections is
  the surviving frozen record and which is superseded; do not leave two
  half-referenced sets behind.
- Add the headline command that reports 19 live and 6 frozen separately.
  Changing `:608` alone is not that command — `:608` already reports what its
  file contains.

**Verify:** the headline command reports 19 live passing and 6 frozen listed
separately, against the still-frozen corpus.

**The throw test must use a `threejs-villa/` manifest, not a stage-3 row.** A
stage-3 row carries `6ec433dd`, which already matches the live set, so putting one
back does **not** throw and the test would be red on arrival. A `threejs-villa/`
manifest carries `701a8fd0` and does throw at `:600`. Revision 2 of this plan had
it wrong.

### 0.1 Re-baseline against Three.js

New script `scripts/qualification/rebaseline-renderer-captures.ts`, wired as
`npm run capture:rebaseline`. **The step order inside it is load-bearing:**

1. **Retarget first.** Rewrite `baseline.image` *and* `candidate.image` on the 19
   live manifests to a new evidence root outside `artifacts/threejs-2d`.
   Retargeting before any copy is what stops a refresh from overwriting the
   Skia-era files.
2. Copy the fresh capture bytes onto the **baseline** path. `capture:refresh`
   never writes a baseline (`refresh-candidate-captures.ts:76`), so this script
   must.
3. Rewrite `sourceCommit` on the 19 fixture manifests **and on the live set
   manifest**. `:600` compares nested against set, so one side alone throws.
   The value is the capture run's `testedCommit`, as the deleted builder used
   (`git show 31566b6^:scripts/qualification/build-threejs-all-map-fixtures.ts`).
   A manifest cannot contain the hash of the commit that adds it.
4. Set `compositingChanged: false` on every re-baselined fixture.

The frozen Skia PNGs stay in place, unreferenced.

**Verify**, in this order:

```bash
npm run package:electron
npm run capture:renderer
npm run capture:rebaseline
npm run capture:refresh
npm run qualify:renderer -- --mode parity --manifest tests/fixtures/rendering/threejs-all-maps-v1.json --output output/verification/visual-polish/rebaseline.json
```

Bare `npm run qualify:renderer` exits 1: `--mode`, `--manifest` and `--output` are
all required (`compare-renderer-frames.ts:650`). Record the numbers — at or near
zero is the restored budget.

### 0.1b The promote path

`capture:rebaseline` is retarget-first and is a **one-time** migration. After 0.1
the manifests already point at the new root, so re-running it to "re-baseline"
after a technique is the wrong tool.

Add `npm run capture:promote`, used after techniques 7, 4a, 1 and 4b:

1. Copy the latest candidate **image** onto `baseline.image`.
2. Copy the latest candidate **mask** onto `baseline.masks` — from 0.2 onward
   these are distinct files, and after 4b the mask is the only record of the new
   silhouette.
3. Rewrite `sourceCommit` on the 19 fixtures **and** the live set.
4. No retargeting. The paths are already correct.

**Image and mask promote together, always.** Promoting the mask alone is not a
smaller version of promoting both — it is a broken comparison. `maskPixels` at
`:398` applies the **baseline mask** to the **baseline image**, so a scaled mask
over an unscaled figure puts floor inside the footprint, `baselineVisible` at
`:400` mixes figure with floor, `baselineContrast` at `:420` collapses, and
`:425` fires across the standing corpus. Revision 2 of this plan specified a
mask-only promote for 4b and would have gone red for that reason.

**Verify:** promoting with no candidate change leaves reports identical; a
promote after a real change makes the next comparison green; a mask-only promote
is impossible because the script does both or neither.

### 0.2 Restore the mask emitter, and wire both sides

- New pure module `src/render/mask-frame.ts`, taking the placement, zoom, scale
  and an injected `alphaAt(sprite, x, y)`. The capture script supplies the
  callback from `assets/generated/world-atlas.png`.
- Implement the recovered rule from `31566b6^` exactly: `offset`, `topLeft`,
  `hitBounds` from the **rounded** bounds, `frameId`, `kind`, `id`.
- **Size the grid from `logicalBounds`**, not `h × zoom × scale`. 30 × 1.22 gives
  36 rows against 37 rounded bounds and `MaskSchema:23` rejects that.
- **Then wire it.** The capture writes a mask frame per fixture; the 19 live
  manifests get `candidate.masks` pointed at the fresh file and `baseline.masks`
  at the re-baseline copy. Without this the two paths stay identical and `:395`
  remains the tautology this whole phase exists to remove — and 0.5's altered-
  footprint test would have nothing to bite on.
- Generate **both** sides from the same emitter, so key order matches. `:395`
  compares `JSON.stringify` output.

**Verify — the gate on the phase, in two parts.**

1. Against the unchanged renderer the emitter reproduces all four frozen
   families: 76-cell outlines on the four native fixtures, 442-cell filled
   silhouettes at fractional and 2× DPR, 1768 at zoom 2, 3978 at zoom 3. Compare
   **parsed structures**, not file bytes. If any differ, stop.
2. Then write the 19 mask pairs and run the 0.1 qualify command. `:395` must
   still pass. A Jest match against the frozen families proves the emitter is
   right; it does **not** prove the live manifests stopped pointing both sides at
   one file, which is the vacuity this commit exists to remove.

### 0.4 Author light samples

- Add a `lightSamples` entry to every live fixture with a lamp or a district
  pool. One exists in the whole corpus today, on a frozen fixture, and it samples
  a patio fire.
- Place each unlit rectangle outside every glow quad's 88×88 box and every pool
  ellipse, by geometry. Technique 7 widens the plateaus, so a rectangle chosen by
  eye can become lit later and flip the sample's meaning.

**Verify:** the qualify command passes with the samples live, and a deliberately
darkened lamp centre fails them.

### 0.5 Prove the reference is not vacuous

- Extend the capture-path damage tests: a refresh that touches nothing fails; a
  damaged candidate fails; a mask frame with an altered footprint fails; an
  untouched fixture still passes.
- Add the two discriminating tests the concurrent session deferred: the `1.02`
  readable predicate is a coverage test rather than content identity, and
  deleting the scaled mean, RMS or mask-local branch is currently invisible to
  the suite.

**Verify:** each new test fails when its target is broken.

### 0.6 Add the `rasterResampled` selector

- One manifest boolean on `ComparisonManifestFields`, declared
  **`z.boolean().default(false)`**. The object is `.strict()`
  (`compare-renderer-frames.ts:38`), so a required field breaks every existing
  fixture including `zoom-sampling-v1.json`.
- Implement the spec's table: `:456`, `:486`, `:491`, `:515`, `:529` off;
  `:395`, `:425`, `:428`, `:450`, `:543`, `:550` on; `:446` falls back to `:450`.
- `:444`, the no-readable-signal failure, stays live.

**Verify:** a unit test per named line, on and off, plus the whole corpus
unchanged with the flag unset everywhere.

## 5. The techniques

### 5.1 Technique 7 — stepped light-map glow

- Export a pure ramp table of `[radiusFraction, alpha]` from `world-renderer.ts`.
  Last pair explicitly `[1, 0]`.
- Keep production's brightness envelope, centre alpha `1`. Do not import the
  spike's 0.04–0.12 alphas.
- Rebuild `generatedGlowTexture` as concentric radial plateaus, `NearestFilter`,
  no mipmaps.
- Leave the lamp-glow clipping, the `roofedCells` skip and the adjusted UVs from
  `5614f98` untouched.

**Verify:** ramp unit test (monotonic, exact plateau count, zero at rim);
`package:electron`, capture, then run **the 0.1 qualify command** with the
selector **off** first, recording the real numbers; light samples pass on every lamp-bearing and
pool-bearing fixture; a decoded pool crop recorded in `artifacts/visual-polish/`.
Only then set the selector on fixtures that actually tripped a family, and run
`capture:promote`.

### 5.2 Technique 4a — authored prop scale

- Scale table keyed by sprite id: planters and tables `1.08`, sofas `1.12`.
  Include `tile.flowering-market-planter`, not only the spike's keys.
- **Gate the bottom-centre shift on the prop table, never on `scale !== 1`.**
  `placement()` already receives a non-1 `scale` for multi-tile floors
  (`world-frame.ts:448`); shifting those would move the ground.
- **`scale` and the shift are assigned in different places.** `scale` itself goes
  through `placement()` from the table, which is fine. The *shift* cannot:
  `propShadows` is called at `world-frame.ts:841` over all props, after every
  `placement()` call, and derives from `worldY` (`:385`). So build props with
  their scale, compute `propShadows` from that unshifted list, then apply the
  shift to table hits. Plan review caught this as a direct contradiction in
  revision 1.
- **Applying the shift maps to new objects.** The static placement lists are
  `deepFreeze`d and cached (`world-frame.ts:517`), so mutating in place throws in
  strict mode. It self-reports, but it is a pointless surprise to walk into.

**Verify:** unit tests that every table key exists in `atlas-index.json`; that
shadow world positions are identical with and without the table; that no
neighbouring door or route **tile centre** is newly covered, including the
two-tile sofa and table pairs; updated `world-frame-v1.json` hashes with the
reason. Then package, capture, run the 0.1 qualify command with the selector off
first, then `capture:promote`.

### 5.3 Technique 1 — integer low-resolution buffer

- Add `threeRenderScale(dpr) = max(1, floor(dpr))`.
- `threeDrawingBufferSize = viewport × threeRenderScale(dpr)`.
- **Change `threeRasterViewport` to divide by `threeRenderScale`**, not by
  `devicePixelRatio`. Both change together, or every fractional-DPR camera
  shrinks.
- `image-rendering: pixelated` on the raw canvas at `ThreeWorldSurface.tsx:31`,
  not the React Native `View` at `:77`.
- **Update `three-world-renderer.test.ts:16` and `:17` as well as `:19`.** Line 16
  locks `threeDrawingBufferSize(1411×871, 1.25)` at `1763×1088`, which becomes
  `1411×871`. Naming only `:19` leaves the suite red.
- Comment in `coordinate-contract.ts` and the capture script: the `viewport × DPR`
  check at `:366` survives only because captures come from
  `webContents.capturePage`. Do not "fix" either.

**Verify:** unit tests for the render scale at all four DPRs and unchanged camera
bounds at the locked window sizes. Hash the DPR 1 and DPR 2 candidate PNGs
against their baselines — meaningful only on this first-half run. Then run the 0.1 qualify
command with the selector off first; the eight fractional-DPR fixtures must hold contrast
retention `≥ 0.9` and readable coverage `≥ 0.95`. Decoded inspection recorded.
Then `capture:promote`.

### 5.4 Technique 4b — authored character scale

Ships alone, last, and may be cut without touching anything above.

#### The ring change, stated as three distinct sets

Plan review found revision 1's single sentence covered three different pixel sets
and could be implemented three wrong ways. It is now explicit.

| Set | Lines | Change |
|---|---|---|
| Ring outer rect | `:402`–`:411` | built from the union of **this** mask's baseline and candidate `logicalBounds` |
| Interior delete | `:415`–`:417` | deletes that **same union AABB** |
| Ring-local cross-mask delete | `:414` | **two** deletes: the existing `requiredPixels` loop stays, **plus** a new delete of the other required masks' *candidate* footprints |
| `requiredPixels` itself | `:389`–`:392` | **unchanged** |

The `:414` loop is an addition, never a replacement. Drop the existing baseline
loop and a neighbouring mask that shrinks or moves leaves its old silhouette in
this mask's ring, which can trip `:425` — the same defect, mirrored. The live 19
are single-mask so 4b does not need the new loop at all; it is there so the next
multi-mask fixture is not a trap.

`requiredPixels` stays baseline footprints, because `:473`–`:493` and `:509`–`:540`
reuse it. Stated precisely: under equal masks a global union would still be
set-identical, so the no-op itself would survive. What it would break is the
meaning of `outsideMaskPixelCount` and `maskLocal` under *unequal* masks — the
native outline family's body would become "inside mask" for those families. That
is a semantic change to two families this program is not touching, which is reason
enough to keep the union ring-local.

The interior delete is not redundant with `:414`. Native footprints are 76-cell
**outlines**, so `requiredPixels` leaves the body inside the ring; the AABB delete
removes it. `compare-renderer-frames.test.ts:138` locks that behaviour.

Changing only the outer rect leaves the grown band between the old AABB and the
union AABB inside the ring — the original spoiler, untouched by a larger frame.

#### Consequence to record before writing code

After the union, one ring object is still sampled on **both** images (`:418`),
so the **baseline** contrast and readable predicate now use the farther ring too:
about 8 logical pixels out at zoom 1, about 22 at zoom 3. Furniture or a scaled
NPC sitting in that farther ring can push `baselineContrast` below `1.05` and trip
`:425`. That is a real possibility, not a theoretical one, and the numbers are
recorded before 4b is judged. Union protects a mask from **itself**, not from a
grown neighbour: NPCs scale too and are not required masks.

#### Two proofs, and neither substitutes for the other

- **No-op:** run the **old** comparator and the **new** comparator over the
  **same** images and masks, and require identical reports. Do not try to prove
  it by recapturing — capture noise fails a byte-compare and proves nothing.
- **Grown mask:** a unit test where the candidate bounds grow, the floor is still
  floor, and `candidateContrast` and `candidateReadablePixels` do **not** collapse.
  This is the proof that answers the review hold. The no-op only exercises the
  equal-bounds path, so without this test the incomplete edit passes both proofs.
  Follow the synthetic-fixture prior art already in
  `scripts/qualification/__tests__/compare-renderer-frames.test.ts` rather than
  inventing a harness.

4b does not start until both exist.

#### The change

- Scale characters at `1.22`, looked up by **actor kind**.
- Apply it in the character mapper at `world-frame.ts:693`, about
  `PROTAGONIST_WOBBLE_PIVOT` — **not** through 4a's shift in `placement()`, which
  is AABB-based and would fight the pivot rule.

#### Measurement

Run with `rasterResampled` **on**. With it off, `:456` fires on all four native
fixtures with certainty — it measures `maximumChannelDelta` over the *baseline*
footprint, and rescaling rewrites the sprite interior far past 8 counts — and
`:529` probably fires on the other 15. Neither is damage.

**`:395` is the only required failure.** Revision 1 also listed `:450`; that is
wrong. `:450` is set **overlap** (`:438`–`:453`), so extra candidate pixels do not
count against it, and a grown footprint that still covers most old readable pixels
can stay above `0.95`. After a correct ring it is a measurement, not a
construction. A missing `:450` does not mean 4b did not happen — `:395` is that
signal.

`:425` and `:428` stay live as revert lines. If either fires, 4b damaged
readability and is reverted.

**Acceptance:** `candidateReadablePixels` does not fall, `candidateContrast` holds
at or above `1.05`, no door or route tile centre newly covered. Then run `capture:promote`, which moves
**image and mask together**, so the corpus records the scaled silhouette against
its own image and the program ends green.

## 6. Definition of done

- [ ] `npm run typecheck` and `npm test` green.
- [ ] The qualify command green on the 19 live fixtures; the 6 frozen villa
      fixtures reported separately and excluded from the headline.
- [ ] 4b's red run recorded as evidence, and the mask side re-baselined after it,
      so the final state is green. A red headline and a green definition of done
      cannot both stand; the red run is the evidence, the re-baseline is the end
      state.
- [ ] Every commit's measurement recorded in `artifacts/visual-polish/`, including
      the numbers taken with the selector off.
- [ ] Decoded-inspection crops recorded for techniques 7 and 1.
- [ ] Draw calls and GPU resource counts re-recorded after each technique, still
      under 12 / 24 / 2.
- [ ] `HANDOFF-CLAIM.md` updated for comparator ownership **before** 0.3, and
      deleted when the program ends.

## 7. Known residual

The ACES gap is untouched. Production runs ACES; the capture pins
`toneMapping: none` because the locked manifests are no-tone. Anything visible
only under the ACES curve still has no pixel gate after this program.

## 8. Review record

The specification went through three rounds with Fable 5 and Grok 4.6. Fable
approved revision 4; Grok approved phase 0 and techniques 7, 4a and 1, and held
4b until its ring was fixed.

Plan review round 1 found the union-of-bounds ring sound as a mechanism — Fable
verified the no-op claim through `:389`–`:455` — but found revision 1 of this plan
wrong in eleven places. The load-bearing ones, all verified against the code
before being accepted:

- The ring sentence covered three pixel sets and could be implemented three wrong
  ways; unioning `requiredPixels` would have broken the no-op it claimed. *(Grok.)*
- The no-op cannot be proved by recapturing, and does not prove 4b's ring at all.
  Two separate proofs are now required. *(Grok.)*
- `:450` is set-overlap and is not a required failure. This failure set has now
  been wrong three times. *(Grok.)*
- `:456` fires on all four native fixtures with the selector off, so 4b runs with
  it on. *(Fable.)*
- Phase 0's order made 0.1's own verification unrunnable. *(Both.)*
- 0.1 refreshed before retargeting, which would have overwritten the Skia-era
  candidates that 0.0 exists to protect. *(Grok.)*
- 4a's shift in `placement()` contradicted its own shadow rule, and would have
  moved multi-tile floors. *(Grok.)*
- `npx jest scripts/verification` matches nothing, and
  `npm run qualify:renderer` with no arguments exits 1. *(Grok; Fable had checked
  the jest path and got it wrong.)*
- `package:electron` was never named before any capture. *(Grok.)*
- `three-world-renderer.test.ts:16` was omitted. *(Grok.)*
- `rasterResampled` needs `.default(false)` against a `.strict()` object. *(Grok.)*

**Plan review round 2.** Fable approved; its three residuals are applied — the
jest wording, the precise reason `requiredPixels` stays untouched, and the
`deepFreeze` note. Grok held on two more, both verified before accepting:

- **The 4b promote was mask-only and would have gone red.** A scaled mask over an
  unscaled baseline image puts floor inside the footprint at `:398`, collapsing
  `baselineContrast` and firing `:425` across the corpus. Image and mask now
  promote together, through a new `capture:promote` path that the plan had never
  named for any technique.
- **The 0.3 throw test named the wrong input.** There are two villa collections:
  the six rows inside the live set carry `6ec433dd`, the same SHA as the live set,
  so putting one back does not throw; only a `threejs-villa/` manifest at
  `701a8fd0` does. Verified both SHAs directly.
- Also tightened: `:414` is two deletes rather than a replacement, 0.2's verify
  runs the qualify command after wiring, and every technique names the real
  qualify and promote commands instead of the word "re-baseline".
