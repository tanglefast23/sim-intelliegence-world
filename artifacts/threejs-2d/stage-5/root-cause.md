# Stage 5 root cause: back-facing primitive quads were culled

`addLine` emits its quad wound by segment direction, so a line running the other
way is back-facing. The shader material never set `side`, so it defaulted to
`FrontSide` and those quads were culled.

The failure marker made this visible because its X is two diagonals running in
opposite directions. It rendered as four corner blobs from the round caps with a
hole through the middle, so its mask median sat on background.

Setting `DoubleSide` fixed it:

| measure | before | after | floor |
|---|---|---|---|
| retained contrast | 0.5977 | 0.9887 | 0.9 |
| readable coverage | 120 of 135 | 136 of 135 | 95 percent |

Five earlier attempts were disproved and reverted before the real cause was
found: round caps, removing the legacy P3 matrix, a half-pixel feather, a
one-pixel feather, and snapping the mask to the pixel lattice. Every one left
the numbers identical to six decimals, which was the clue that geometry and
colour were not the lever. A deliberate three-times-width diagnostic proved the
render pipeline did respond to changes, and a footprint dump then showed the
hole.

This was a real renderer defect, not a threshold problem. It affected every
diagonal primitive, so the fix reaches beyond the failure marker.
