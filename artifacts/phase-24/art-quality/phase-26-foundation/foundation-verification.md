# Phase 26 foundation verification

## Atlas

- Contract version: `3`.
- Art revision: `1`.
- Actual atlas: `512x412` RGBA.
- Public runtime cells: `187`.
- Internal review cells: `0`.
- Actual raw rectangle area: `198,012` pixels.
- Actual packed occupancy: `93.87%`.
- Full planned forecast: `634` cells.
- Forecast raw area: `714,744` pixels, `68.16%` of the hard limit.
- Forecast real-packer bound: `1024x722`, `70.51%` of the hard limit.
- Hard atlas limit: `1024x1024`.

## Integrity

- The generator produces byte-identical PNG, index, and report output.
- Each cell owns an extruded one-pixel edge and corner gutter.
- Transparent pixels use RGB `0,0,0`.
- The index and report contain the PNG SHA-256 digest.
- The packaged boot resource gate hashes the loaded atlas and fails closed on mismatch.
- Candidate PNG, index, and report files decode and validate before replacement.
- Public and internal sprite lists cover the index exactly once.

## Source and evidence safety

- The ten character JSON sources are authoritative.
- `art:atlas` does not run a variant writer.
- The unsafe character variant writer was removed.
- `art:atlas` does not write a review image.
- `art:review` requires an explicit Phase 24 art-program output root.
- Packaged smokes use explicit `--output-root` parsing.
- Phase 4, 14, 19, 22, and 23 evidence roots are rejected.
- Default local smoke output is under ignored `output/verification/`.

## Review boards

- `characters-3x.png` shows every existing character frame and portrait.
- `atlas-cells-1x-3x.png` shows public tile cells at native and enlarged nearest-neighbor scales on light and dark backgrounds.
- `atlas-report.json` records category counts, raw area, dimensions, occupancy, and largest cells.
