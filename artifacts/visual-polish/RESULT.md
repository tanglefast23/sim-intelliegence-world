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
