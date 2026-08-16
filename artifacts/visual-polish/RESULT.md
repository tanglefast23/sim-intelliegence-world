# Visual polish: what shipped, and what the evidence says

Baseline `23586ec`, the merged and CI-green Three.js port.

## What shipped

**A working capture path**, which is the substantive result.

Stage 7 retired the paired Skia-versus-Three.js runners as migration-only code.
That was right, but it removed the only way to hand the comparator a fresh
capture, so `qualify:renderer` re-read frozen PNGs and would have passed whatever
the renderer did. Any polish item measured that way would have carried evidence
that could not fail.

The path is now:

- `npm run capture:renderer` drives the packaged app, hidden and game-muted, to
  every locked case across each DPR and VFX mode, forcing the no-tone override so
  the captures match the manifests rather than measuring the ACES curve;
- `npm run capture:refresh` replaces only candidate images. It never touches a
  baseline: those are frozen Skia captures recording a comparison that can no
  longer be made, so overwriting one would erase the reference;
- three tests prove the path is not vacuous. A refresh that touches nothing
  fails. A damaged candidate fails the comparison. The untouched fixture still
  passes, so the damage test means something.

Measured end to end: 19 candidates refreshed, 25 of 25 fixtures pass.

**19 of those 25 are live. Six are not, and that is now declared rather than
hidden.** The six `villa-*` fixtures were captured by the parity runner Stage 7
retired, so their candidates are frozen history. The refresh originally skipped
them silently, which meant the headline pass included six frozen-versus-frozen
comparisons: the same vacuity this path was built to remove, surviving in reduced
form. The refresh is now driven from the comparator collection, names the six as
frozen history, and fails listing any other fixture it could not refresh. Reviving
them needs a villa capture runner.

## What did not ship, and why

**5.1 camera-origin snap. Implemented, measured, reverted.**

Five unit tests passed: the snap was a no-op at DPR 1 with an integer camera,
landed a fractional origin on the lattice at DPR 1.25, was idempotent, collapsed
cameras closer than one device pixel, and left the visible extent unchanged.

Against real captures it failed its own gate. The player mask on
`southeast-2560x1440-dpr1_25-zoom1` fell to `0.8967` retained contrast, under the
`0.9` floor, and five fractional-DPR fixtures exceeded the scaled RGB limits, the
worst at mean `1.456` against a limit of `1`.

The plan review predicted this exactly. Every baseline is a frozen Skia capture
that can never be re-taken, so any sub-pixel shift permanently spends
scaled-family threshold budget against a fixed reference. The locked rule is that
an item which cannot show its measurement is reverted, not softened, so it was.

The unit tests are the lesson worth keeping: they all passed while the change
broke a readability floor. Only pixel evidence caught it.

## The ACES gap

Production runs ACES. The capture forces the no-tone override, correctly, because
the locked manifests are no-tone and comparing an ACES capture against them would
measure the tone curve instead of the change. But the enhanced ACES manifest set
the port used no longer exists, and the capture script pins its evidence to
`toneMapping: 'none'`, so it could not take an ACES capture even if asked.

Anything visible only under the ACES curve therefore has no pixel gate. That
directly affects two of the remaining items, the rim light and the grading. It is
a named blocker, not an oversight.

## What the remaining four items now need

5.2 dithered pools, 5.3 rim light, 5.4 grading and 5.5 ground wave are specified
and reviewed, and the capture path they need exists. Each changes shading or
geometry, so each spends the same frozen-baseline budget that stopped 5.1. Before
any of them lands, that budget question has to be settled: either the corpus is
recaptured against a Three.js baseline and the frozen Skia captures are retired
to history, or each item has to fit inside what is left.

That is a decision about the evidence corpus, not about the renderer, and it is
the honest blocker in front of the rest of this program.

## Grok 4.6 audit record

The Stage 7 skip is replaced. Grok now runs, and the lever was payload size, not
budget: the full Stage 7 diff deletes many files plus fixture PNGs and swamped the
input, so it returned a verdict having read nothing. Raising `--max-turns` to 60
changed nothing. Path-scoped batches produced real audits.

- Batch 1, CSP, readiness contract and resource gate: no findings, with coverage
  citing `script-src 'self'` and the absence of `canvasKitReady`.
- Batch 2, renderer and shell: no findings, confirming Three.js owns lighting,
  atmosphere and the three feedback batches in composite order.
- Batch 3, tests and package surface: THREE HIGH findings, all valid.

Batch 3 is why this was worth re-running. It found that the Skia-removal test
retargeting fixed the symptom and left the cause: `readFileSync` still sat in the
`describe` body of two suites, which is the exact pattern that let Jest report a
suite as passing while its collection threw ENOENT. It also found the retargeted
`atlas-bill` batch assertion was a substring count that proved nothing about the
12-draw atlas ceiling.

Fixed: every source read moved inside `test()`, and the batch count replaced with
the renderer's real atlas batch list. Verified by deleting `world-renderer.ts` and
confirming the suite now reports a failure where it previously reported a pass.

A verdict whose coverage note says it is "beginning" an inspection is not an
audit. Those two runs are recorded here as unearned rather than counted.

## Handoff pixel techniques: rollback target

The program specified in `docs/specs/2026-08-16-handoff-pixel-techniques.md`
begins at commit 0.0, which guards this directory's sibling `artifacts/threejs-2d`.

**Rollback target: `8748434`**, the parent of that commit.

The spec deliberately refuses to name a hash in advance, and this is why. During
review the intended target moved three times — `d4a1a24`, then `33609af`, then
`9c2f8e2` — while a concurrent session committed to the same worktree. A revert
to any hash chosen earlier would have destroyed work that is not part of this
program, including that session's UI fix at `f51c709`. The target is recorded here
once, at the moment it becomes true.

## The Skia captures were never protected

`scripts/verification/evidence-output.ts` write-protects historical evidence, but
its list covered only `artifacts/phase-04`, `-14`, `-19`, `-22` and `-23`.
`artifacts/threejs-2d` was not on it.

That directory holds the frozen Skia captures: the only record of a
Skia-versus-Three.js comparison that can no longer be made, because Skia is gone.
Any capture run pointed at it would have overwritten them silently, and this
program's whole first phase is about retiring them as a reference *without*
destroying them. Found during specification review, closed in commit 0.0.

The guard is proved rather than asserted: removing the entry makes
`tests/electron/package-smoke.test.ts` report a failure where it now reports a
pass.

One limit is worth stating, because the guard does not close it alone.
`scripts/qualification/refresh-candidate-captures.ts:81` copies straight to
`manifest.candidate.image` and never calls `resolveEvidenceOutputRoot`, so it
writes wherever a manifest points — today, inside this tree. Until phase 0.1
retargets those paths, `capture:refresh` must not be run.

# The handoff techniques: final state of all ten

Verified against the code as it ships, not against intent.

| # | Technique | State |
|---|---|---|
| 1 | Integer low-res + `pixelated` | **Implemented, measured, REVERTED.** See `technique-1-reverted.md`. |
| 2 | Orthographic camera | Shipped before this program. |
| 3 | Atlas sprites, nearest, no mipmaps | Shipped before this program. |
| 4 | Authored object scale | **Shipped.** Props 1.08/1.12 by sprite id; characters 7/6. |
| 5 | Varied floor tiles | Shipped before this program. |
| 6 | Sprite-silhouette shadows | Shipped by the concurrent session, props only. |
| 7 | Additive stepped light-map glow | **Shipped.** Four radial plateaus, `NearestFilter`. |
| 8 | Edge occlusion | Shipped before this program. |
| 9 | Explicit layer order | Shipped before this program. |
| 10 | Colour pipeline, ACES, exposure | Shipped before this program. |

Three were open when this program started. Two ship. One was reverted on its own
measurement, which is the rule working rather than the program failing.

## What the evidence corpus can now do that it could not

Every one of these was verified by breaking it and watching the check fail.

| Check | Before | Now |
|---|---|---|
| Mask identity | Both sides named ONE file. Could never fail. | Distinct files, fires on an altered footprint. |
| Mask emitter | Deleted with the Stage 7 runners. | Restored, reproduces every family exactly. |
| Light samples | 1 across 25 fixtures, on a frozen fixture, sampling a patio fire. | 19 of 19, fires on a darkened lamp. |
| Baseline | Frozen Skia. Budget spent: item 5.1 died at mean 1.456 against a limit of 1. | Three.js. Mean 0 at the re-baseline. |
| Skia captures | Unprotected; any capture run could overwrite them. | Write-protected, guard proved by removing it. |
| Villa fixtures | Six self-comparisons inside a "25 of 25" headline. | Separate frozen set, never gating. |
| Comparator branches | Deleting one left the suite green. | Deleting two fails exactly two tests. |
| Set/fixture commit split | Silent; broke a real commit in this program. | Guarded by a test. |

## The residual, stated plainly

The ACES gap is untouched. Production runs ACES; the capture pins `toneMapping: none`
because the locked manifests are no-tone. Anything visible only under the ACES curve
still has no pixel gate.

`rasterResampled` reached 19 of 19 during technique 4b and was **cleared** afterwards.
It is a per-change declaration, not a permanent relaxation. The corpus qualifies at
19 of 19 today with every RGB-delta family live, so the next renderer change faces the
whole gate.
