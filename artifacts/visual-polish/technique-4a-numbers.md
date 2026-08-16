# Technique 4a: the numbers taken with the selector off

Authored prop scale, measured against the baseline technique 7 left behind.

Fourteen of nineteen fixtures pass. Seven of those fourteen already carried
`rasterResampled` from technique 7, so the honest count is that five NEW fixtures
trip a family here, all of them on the scaled side.

| Fixture | Raster | Outside-mask | Mean | RMS | Large ratio |
|---|---|---|---|---|---|
| `southwest-1600x720-dpr1-zoom3` | scaled | 0.002648 | 0.110632 | 2.76556 | 0.002434 |
| `southwest-1920x1080-dpr1_25-zoom3` | scaled | 0.004892 | 0.190394 | 3.56109 | 0.003737 |
| `northwest-1600x720-dpr1_5-zoom2` | scaled | 0.006543 | 0.154634 | 2.423477 | 0.003273 |
| `northwest-1920x1080-dpr2-zoom3` | scaled | 0.00689 | 0.195857 | 2.863818 | 0.004931 |
| `southwest-1280x720-dpr2-zoom2` | scaled | 0.004017 | 0.174263 | 3.540106 | 0.00324 |

Limits: outside-mask 0.12 scaled, mean 1, RMS 3, large ratio 0.002.

Every failure is a large-changed ratio or an RMS, and every one is on a zoom 2 or
zoom 3 fixture. That is what an authored scale looks like: a silhouette band a few
pixels wide around each piece of furniture, multiplied by the zoom.

No readability check failed anywhere in the corpus. Not mask identity, not contrast
retention, not readable coverage, not one light sample. The four native fixtures are
absent from this list because they already carry the selector from technique 7.
