# Stage 4 stop condition — no-tone parity after the lighting move

Date: 2026-08-16. Branch retained: `codex/threejs-stage-4-lighting`.
Plan section 16: stop and retain the branch when the no-tone parity comparator
fails. Plan rule 14 forbids weakening a threshold so a phase can pass.

## Implemented and green

District shadows and light pools, the screen-space atmosphere, and the
destination/journal/failure feedback batches all moved onto the Three.js path.
The three React overlays now mount only for Skia, which is what makes the
composite order correct and discharges the Stage 3 deferral. ACES landed behind
an unsaved `none|aces` override with a recorded exposure.

Green: 88 suites / 902 tests, typecheck, import boundaries, both packaged smokes.

## Fable audit round: 5 findings, 4 fixed

1. BLOCKER, fixed. The legacy Display-P3 matrix was applied to the atmosphere
   batch, but that batch's legacy counterpart was plain DOM CSS composited by
   the browser, never a Skia surface. The wash covers every pixel at alpha
   0.188, so the matrix shifted the whole frame by about one count. Fixed with a
   separate material carrying no legacy transform.
   Measured effect: outside-mask ratio 0.163-0.193 -> 0.0072-0.0090, a 21x
   reduction; mean absolute delta 1.07 -> 0.33.
2. Fixed. Feedback anchors now snap to the whole screen pixels Skia used.
3. Fixed. `evidence()` reported `toneMapping: 'none'` even under ACES.
4. Fixed. The glow disc was filled to radius 30 while the rim UVs sit at 32, so
   every light pool faded early and rendered small.
5. Not fixed, live path only. The atmosphere drift epoch differs from the legacy
   overlay's mount time. No gate measures it; reduced motion is the qualified path.

A separate hypothesis, that three defaulted `premultipliedAlpha` to true against
straight-alpha shaders, was tested and DISPROVED: it moved the numbers by less
than 0.0001 and was reverted. Removing the 8-bit alpha quantization in `rgba()`
likewise changed nothing measurable, but was kept as the more correct form.

## What still fails, in two classes

Class A, uniform and small. Outside-mask changed-pixel ratio sits at 0.0072 to
0.0090 against a native limit of 0.005. This is the residual Fable predicted:
stacked translucent quads quantizing per blend in an 8-bit framebuffer versus
the browser's float compositing, concentrated in the 16 and 22 pixel edge bands.

Class B, localised and large. The journal pin and failure X now differ by up to
134 and 158 per channel, with readable-pixel sets changed and retained contrast
0.609. Skia draws these thin strokes and small circles antialiased; the Three.js
port tessellates hard-edged geometry with `antialias: false`. A one-pixel ring
and a three-pixel X cannot match an antialiased original per pixel.

## Class B is closed

Drawing feedback inside the Three.js canvas was self-inflicted. The locked order
only requires feedback ABOVE lighting and atmosphere. Three.js now owns both
inside the canvas, and the shared feedback overlay sits above that canvas in the
DOM, so the order already holds with no antialiasing mismatch. Every Class B
failure disappeared: per-channel deltas of 134 and 158, the changed readable
sets, and retained contrast 0.609 are all gone. Failure lines fell from 14 to 7.

## Two further hypotheses tested and DISPROVED

- `premultipliedAlpha` defaulting to true against straight-alpha shaders. Moved
  the numbers by less than 0.0001. Reverted.
- Precomposing the atmosphere wash and edge shades into nine float-composited
  regions, to avoid 8-bit quantization between stacked layers. This made the
  outside-mask ratio WORSE, 0.0078 to 0.0373, because `new Color()` converts to
  linear working space, so the precomposition happens in LINEAR space while the
  browser composites in sRGB. Reverted.

That last result is the sharpest remaining clue. The residual is a colour-space
difference in how stacked translucent layers combine, not a quantization
artefact. Any next attempt must precompose in sRGB, not in three's linear
working space.

## Layer stacking is ruled out entirely

Precomposing the atmosphere regions in sRGB produced outside-mask ratios of
0.0079 to 0.0089, IDENTICAL to emitting the wash and edge shades as separate
blended quads. sRGB source-over is associative, so precomposition can only
match. That closes the whole stacking and quantization line of enquiry, and the
change was reverted as complexity with no measured gain.

The residual is therefore NOT layer stacking, NOT alpha quantization, and NOT
premultiplied alpha. What remains is the final blend itself: the browser
composites the overlay over the canvas in float and rounds once, while WebGL
blends into an 8-bit framebuffer. About 0.8 percent of pixels land on a
different integer. That is a precision difference between compositing an overlay
OVER a canvas and rendering INTO it, and it cannot be removed without a float
render target and a single resolve, which the locked renderer settings forbid.

## Recommendation for whoever picks this up

Stop trying to make a moved layer match a pixel gate that assumed it had not
moved. Section 7.5's native rule was written when BOTH renderers used the same
React overlays for lighting and atmosphere. Stage 4 deliberately ends that. Once
Three.js owns those layers, the comparison is no longer parity of identical
inputs, which is precisely the situation `enhanced` mode already exists for:
identical masks and bounds, gated on contrast retention rather than per-pixel
channel delta.

The defensible move is a dated specification amendment stating that once a layer
moves into the renderer, its frames qualify under `enhanced` contrast rules
rather than `parity` pixel rules, with the readability floor unchanged. That is
a change of WHICH gate applies to a deliberately changed configuration, not a
loosening of a threshold, and rule 14 still forbids relaxing any number inside
either gate. It must be written and reviewed before any comparator change.

## Next step

Only Class A remains: outside-mask changed-pixel ratio 0.0072 to 0.0089 against
a native limit of 0.005, plus one borderline mask delta of 11 against a limit of
8 on `npc-generic-resident`.

Precompose the atmosphere regions in sRGB rather than in three's linear working
space: parse the hex channels directly to 0..255 without `new Color()`, composite
source-over there, then convert once to linear for the tint attribute. The linear
attempt is committed and reverted, so the two results can be compared directly.
