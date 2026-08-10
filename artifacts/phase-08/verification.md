# Phase 8 Verification

## Automated gates

- Content validation compiles 4 maps and 2 exact schedule fixtures.
- Import boundaries and TypeScript checks pass.
- All Jest suites pass, including clock, needs, economy, schedules, transfer ownership, migration, transition rollback, stable autosaves, and the Grok regression cases.
- Electron packaging succeeds with the production `app://game/` renderer.

## Packaged player-visible proof

The packaged smoke run verifies:

- `1×`, `2×`, pause, mouse movement, cancellation, pan, wheel zoom, three zoom buttons, and `F` center.
- Villa entry, exit, room readability, and roof restoration.
- Two-hour nap and overnight sleep to `08:00`.
- Sleep autosave only after the completed overnight state.
- Northwest to northeast, northeast to southeast, southeast to southwest, and southwest to northwest crossings.
- One ordered autosave after each completed crossing.
- A visible `FERRY TERMINAL · CLOSED` label with no ferry interaction.

Evidence images:

- `packaged-loading.png`
- `packaged-electron.png`
- `world-1x.png`, `world-2x.png`, `world-3x.png`
- `world-roof-restored.png`
- `world-downtown.png`
- `world-ferry.png`
- `world-loop-complete.png`

## Phase boundary

`WORLD-01`, `WORLD-05` through `WORLD-10`, and `WORLD-14` are covered for Phase 8. The real sleep and travel parts of `WORLD-11` pass. The major-quest autosave remains assigned to Phase 11, and Phase 12 reruns the complete integrated gate set.
