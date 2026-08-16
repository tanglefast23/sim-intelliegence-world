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
