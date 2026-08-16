# Technique 4b: the numbers, and why the run is red

The authored character scale. The only item in this program that changes the size of
a gameplay-legibility element, and the only one that moves a required mask.

## The run reports 0 of 19, by construction

`:395` — mask identity — fires on every fixture, because the protagonist's silhouette
went from 24x30 to 28x35. That is the item happening, not the item failing. A green run
would mean the silhouette did not move, which would mean 4b did not happen.

`:450` — readable-coverage retention — also fires, and this needs saying carefully. It
is a set OVERLAP of readable pixel INDICES. The baseline mask on a native fixture is the
76-cell outline of a 24x30 sprite; the candidate is the outline of a 28x35 sprite. Two
differently-sized outlines share very few pixels, so retention collapses to `0.2237`
even though the figure is more readable than before, not less.

An earlier revision of the specification claimed `:450` "fails by construction" and a
later one claimed it was "not a required failure". Neither was right in general. It fails
here because outlines barely overlap when they resize, which is a property of the
measure, not of the change.

## Acceptance: the recorded measurements

| Criterion | Result |
|---|---|
| `candidateReadablePixels` does not fall | **rose on all 19** |
| `candidateContrast` at or above `1.05` | **all 19**, lowest `1.1432` |
| No door or route tile centre newly covered | asserted by unit test |

Readable pixels rose everywhere, which is what a larger figure on the same floor should
do: 76 to 91 on the native fixtures, 1768 to 2396 at zoom 2, 15912 to 21644 at the
largest. Contrast moved a little in both directions and never approached the floor.

## The selector, and why it was cleared afterwards

Seven fixtures already carried `rasterResampled` from techniques 7 and 4a. Seven more
tripped an RGB-delta family here, which took the total to **19 of 19** — every fixture
in the corpus running readability-only.

That is an erosion worth naming rather than shrugging at. A corpus where every fixture
has its RGB families switched off has quietly lost most of its precision.

So after the baseline was promoted, the selector was **cleared on all 19**. The corpus
re-qualifies at 19 of 19 with the full families live, because candidate and baseline now
agree. `rasterResampled` is a per-change declaration, not a permanent relaxation, and the
next change to this renderer faces the whole gate again.

## The scale is 7/6, not the spike's 1.22

24 x 1.22 = 29.28 and 30 x 1.22 = 36.6. A fractional sprite SIZE puts the quad's far
edges on fractional world coordinates however the near edge is anchored, so whole-pixel
placement — a locked hard constraint — is broken by the scale itself, and no choice of
anchor rescues it. 7/6 maps 24x30 to exactly 28x35.

With whole-pixel shifts of 2 and 5 the foot line is exactly invariant and the pivot's x
is exactly invariant. The pivot's y drifts one sixth of a logical pixel. Whole-pixel
placement, the foot line and the rotation pivot cannot all three be exact at a
non-integer scale, and the pivot's y is the one that gives.
