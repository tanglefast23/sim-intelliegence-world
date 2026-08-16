# Technique 1: implemented, measured, reverted

Handoff technique 1 — an integer low-resolution drawing buffer upscaled once with
`image-rendering: pixelated` — was implemented at `87d1c85` and reverted after
measurement. This records why, so nobody re-derives it.

## What it did

The drawing buffer became `viewport x max(1, floor(devicePixelRatio))` instead of
`viewport x devicePixelRatio`, and `threeRasterViewport` changed its divisor to match.
DPR 1 and DPR 2 are unchanged by construction; only 1.25 and 1.5 move.

## What passed

- **All eleven DPR 1 and DPR 2 fixtures are byte-identical.** Hashed candidate against
  baseline on the one run where that check means anything — before any promote. The
  change leaked nothing outside fractional scales, which was its first claim.
- Contrast retention held on every fractional fixture: worst `0.9554` against a floor
  of `0.9`.
- No mask moved. No light sample failed.

## What failed

**`southeast-2560x1440-dpr1_25-zoom1`: readable coverage `0.907692`, below the `0.95`
floor.**

The protagonist's readable pixel count against its own ring fell from **650 to 596**.
Three other fractional fixtures moved the same way and stayed inside the floor:
`0.997076`, `0.998714`, `0.972146`. One direction, four fixtures, one over the line.

That is not noise, and it is not a measurement artefact. It is the trade this technique
makes. At DPR 1.25 the protagonist is drawn at 24 buffer pixels and the browser upscales
it to 30 device pixels with nearest sampling, so some columns double and some do not.
Thin features that used to separate from the floor stop separating.

## Why it was reverted rather than tuned

The `0.95` readable-coverage floor is a pre-existing, locked threshold. The program's
rule is that an item which cannot show its measurement is reverted, not softened, and
`rasterResampled` deliberately does NOT switch readability off — only the RGB-delta
families. Lowering the floor to admit this change would weaken the gate for every future
change in order to pass one, which is the exact trade this whole program exists to
refuse.

Item 5.1, the camera-origin snap, died the same way and at the same kind of fixture:
fractional DPR, a readability floor, a change that was correct in intent.

## What would have to be true to try again

The cost is resolution, not lattice phase, so a smarter render scale does not avoid it.
`ceil(dpr)` supersamples and then needs a non-integer downscale, which blurs. `round(dpr)`
still maps 1.25 to 1 and changes nothing here.

The honest options are to accept a measurably less readable player at DPR 1.25, which
hard constraint 1 forbids, or to raise the art's effective resolution so a 24x30 sprite
has readable margin to lose. Neither is a renderer change.

## What survives

Nothing from this technique ships. The capture script keeps its comment about why the
comparator's `viewport x devicePixelRatio` dimension check holds — captures read the
composited window, not the drawing buffer — because that is true regardless and is worth
not rediscovering.
