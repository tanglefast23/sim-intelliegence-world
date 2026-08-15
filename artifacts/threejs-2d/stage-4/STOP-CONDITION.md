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

## Next step

Class B is the real design question and should be settled before Class A.
Either give the feedback primitives shader-based antialiasing so their edges
match Skia's coverage, or amend the specification to compare feedback masks by
coverage and contrast rather than per-pixel channel delta. The second option is
a specification change, not a threshold weakening, and needs to be written as a
dated amendment before any comparator change.
