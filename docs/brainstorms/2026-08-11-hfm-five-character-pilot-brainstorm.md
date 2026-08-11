---
date: 2026-08-11
topic: hfm-five-character-pilot
---

# HFM Five-Character Pilot

## What We're Building

Build a non-production pilot for Protagonist, Linda, Devon Price, Mina Park, and Rafael Cruz. Each pilot uses HFM's exact `24x30` world grid and `24x29` portrait grid. The pilot must show the same face and feature geometry in both forms, with visible shoulders, arms, hands, separate legs, and shaped footwear in the world sprite.

## Why This Approach

The first full-cast rebuild shared roster data but invented a different square portrait and rectangular body system. This pilot ports the proven HFM anatomy and assembly grammar before any more production characters change. It keeps the current runtime atlas unchanged until the visual base passes review.

## Key Decisions

- Use HFM's face box, cut corners, fixed expression rows, stepped portrait bust, limb columns, contour pass, and `face -> feature -> body -> outline` assembly order.
- Keep SI-specific clothes, accessories, colors, and body choices. Do not copy football uniforms or full hero costumes.
- Use one shared head and feature function for portrait and world art. Do not scale a separate portrait drawing.
- Review the five people in the same three-panel card format as HFM: rest, joy, and full body.
- Produce a direct HFM-versus-SI comparison sheet plus a native `1x` sheet.
- Do not rebuild the other 30 people until the pilot is accepted.

## Acceptance

- Portrait source is `24x29`; world source is `24x30`.
- Every world sprite has two visible arms or an intentional asymmetric garment, two separate legs, and two feet.
- Portrait shoulders widen in steps instead of forming one square block.
- The top fifteen rows of portrait and world art use the same face and feature pixels.
- Each of the five silhouettes is distinct without color.
- The result reads as part of HFM's heroic-chibi universe at native `1x` and nearest-neighbor `3x`.

## Next Steps

Port the geometry, generate the contact sheet, perform five focused visual iterations, and stop for cast approval.
