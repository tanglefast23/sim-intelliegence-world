# Technique 7: the numbers taken with the selector off

Stepped radial glow plateaus, measured against the baseline left by phase 0.
Twelve of nineteen fixtures pass with no selector at all. The seven below trip an
RGB-delta family and nothing else: not one readability check failed anywhere in the
corpus, which is what the change had to show.

| Fixture | Raster | Outside-mask | Mean | RMS | Large ratio | Tripped |
|---|---|---|---|---|---|---|
| `northwest-1280x720-dpr1-zoom1` | native | 0.021194 | 0.179053 | 1.50112 | 9.9e-05 | Outside-mask changed-pixel ratio 0.021194 exceeds 0.005. |
| `northeast-1440x900-dpr1-zoom2` | scaled | 0.051224 | 0.492818 | 2.693986 | 0.002058 | Scaled large changed-pixel ratio 0.002058 exceeds 0.002. |
| `southeast-1920x1080-dpr1-zoom1` | native | 0.035792 | 0.385825 | 2.51091 | 0.000957 | Outside-mask changed-pixel ratio 0.035792 exceeds 0.005. |
| `northwest-2560x1440-dpr1-zoom1` | native | 0.020673 | 0.206643 | 1.851423 | 0.001279 | Outside-mask changed-pixel ratio 0.020673 exceeds 0.005. |
| `southeast-1280x720-dpr1_5-zoom2` | scaled | 0.058674 | 0.636286 | 3.280147 | 0.001826 | Scaled root mean square channel delta 3.280147 exceeds 3. |
| `southeast-1440x900-dpr2-zoom3` | scaled | 0.083845 | 0.922106 | 4.003802 | 0.003314 | Scaled root mean square channel delta 4.003802 exceeds 3.; Scaled large changed-pixel ratio 0.003314 exceeds 0.002. |
| `fallback-circle-1280x720-dpr1-zoom1` | native | 0.021189 | 0.179046 | 1.501106 | 9.9e-05 | Outside-mask changed-pixel ratio 0.021189 exceeds 0.005. |

Limits: outside-mask 0.005 native and 0.12 scaled, mean 1, RMS 3, large ratio 0.002.

All four native fixtures are in this list, which is not a surprise: the glow repaints
district pools on every map, and the native outside-mask budget is 0.5 percent of the
frame. A review predicted exactly this before the change was written.

## Decoded inspection

Banding has no comparator gate — no radial-monotonicity measurement exists and this
program did not add one — so the claim is judged by decoded crops, recorded here:

- `technique-7-pool-before.png` — a 110-logical-pixel crop around a district pool on
  `northwest-2560x1440-dpr1-zoom1`, drawn with the smooth eight-stop gradient.
- `technique-7-pool-after.png` — the same crop with the four radial plateaus.

Distinct luminance levels along a horizontal radius from the pool centre fall from 35
to 19, and transitions from 24 to 17.

**That number is indicative, not conclusive, and it is worth saying why.** The glow is
additive over floor art that varies underneath it, so the level count mixes the ramp's
own quantisation with the ground texture's. The clean measurement of the ramp is the
plateau table itself, which is exactly five entries and unit-tested. The crops are the
artefact; the count is a pointer, not a proof.

## What the selector was set on, and what it was not

Seven of nineteen fixtures carry `rasterResampled: true`, each because it tripped a
named RGB-delta family above. The other twelve pass with no selector at all.

No readability check failed anywhere in the corpus at any point: not mask identity, not
contrast retention, not readable coverage, not one light sample. That is the gate this
technique had to pass, and it passed it before any selector was applied.
