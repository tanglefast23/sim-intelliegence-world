# Phase 7 Grok audit

- Date: 2026-08-10
- Model: Grok 4.5
- Effort: high
- Access: grok.com subscription, read-only wrapper
- Scope: uncommitted Phase 7 map, movement, camera, input, renderer, migration, and packaged evidence against `origin/main`
- Status: completed

## Confirmed and fixed

1. High: a camera update during middle drag recreated one callback and remounted all input listeners. Continuous drag could stop after its first rendered batch. Input listeners now remain mounted and read current handlers through refs. The packaged test sends two drag moves with a render delay between them and checks the exact final camera offset.
2. High: the packaged `F` test compared the centered result with the camera position from before panning. A no-op `F` could pass. It now compares with the post-pan position and checks the exact centered camera coordinates for the moved player.
3. Medium: the walk frame changed every 145 ms while idle. Animation now runs only while movement status is `moving` and returns to frame zero when movement stops.
4. Medium: pointer coordinates used the outer bordered frame while camera math used the inner viewport. Pointer and smoke coordinates now use the exact `1120x620` viewport element.
5. Medium, narrowed: the renderer already consumed the required fixed floor-to-roof layer order, so the claimed cross-layer failure was not present. Same-layer items were not explicitly ordered. Props, characters, and walls are now sorted by row and stable ID before their atlas draw.

## Rejected or uncertain

1. Rejected in part: Grok stated that a character south of a wall or prop must draw across the fixed layer boundary. The locked renderer contract intentionally places props before characters and walls after characters. This cross-layer order remains unchanged. Only deterministic same-layer ordering was missing and was fixed.

## Verification

Each confirmed behavior was traced against the reviewed source. The strengthened packaged Electron smoke proves zoom buttons, exact three-step movement, multi-render middle drag, exact `F` centering, wheel zoom, cancellation, UI click isolation, roof restore, and roof entry. Unit tests cover stable depth order and authoritative first-frame reconstruction.
