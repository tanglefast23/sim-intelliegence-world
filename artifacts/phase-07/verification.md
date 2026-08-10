# Phase 7 verification

- Branch: `codex/phase-07-world-movement`
- Base: `284d19930a8eb6fe312478915b387b1ab5713de2`
- Full command: `npm run verify`
- Result: passed
- Test result: 19 suites, 147 tests
- Map result: the authored `64x48` northwest residential map validates 3,072 ground cells, collision, walls, openings, props, interactions, five villa areas, doors, roof group, two edge portals, staging tiles, and all three spawns
- Path result: stable four-direction A-star tie breaking, no diagonals, blocked targets, no-route targets, interruption, cancellation, and moving-blocker replanning passed
- Authority result: each movement step commits one deterministic cardinal event and schema version 3 saves the current map and tile
- Frame result: an inside save reloads to the same deterministic first-frame signature; the door keeps the roof hidden and the first outside tile restores it
- Camera result: exact viewport-relative clicks, discrete `1x`, `2x`, and `3x` zoom, bounds, anchored zoom, multi-render middle drag, wheel zoom, `F` center, and Escape cancellation passed
- Click result: UI, NPC, object, interaction, and floor priority passed; packaged HUD clicks did not move the protagonist
- Render result: floor, prop, shadow, character, effect, wall, and roof layers use fixed order; same-layer items use row and stable-ID order
- Performance result: input listeners remain mounted across renders and walk frames update only while moving
- Electron package: passed for macOS arm64
- Packaged smoke: exact three-step movement and all nine world checks passed; CanvasKit ready and Node access blocked
- Visual evidence: `world-1x.png`, `world-2x.png`, `world-3x.png`, and `world-roof-restored.png`
- Grok audit: Grok 4.5, high effort, completed; four findings confirmed and fixed, one finding narrowed to same-layer ordering and fixed

`WORLD-02`, `WORLD-03`, and `WORLD-04` pass for the Phase 7 scope. The packaged scene starts inside the five-room villa, displays room labels at native zoom, moves by mouse click, restores the textured roof outside, and hides it again on entry.
