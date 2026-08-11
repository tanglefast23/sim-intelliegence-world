# Phase 28 verification report

- Tested source commit: `5fdff8db5fab6b0b90505a567389866364bbf161`
- Art revision: `2`
- Atlas SHA-256: `0f4cd24485d819e1ca6d61749664e35088923a865361e6444aa87144f4c42294`
- Atlas size: `512x514`, RGBA, 234 public cells
- Full-program forecast: `1024x722`, 70.5 percent packed-area ratio
- Art source: tracked character layers, tile commands, palette recipes, and deterministic generators

## Hard gates

1. Pass. `docs/art/halcyra-art-bible.md` contains the Phase 28 character, material, building, roof, prop, vegetation, and landmark ledger.
2. Pass. Five tracked `12x12` material boards exist at `1x` and `3x`. Automated distribution and `2x2` tests pass.
3. Pass. The transition boards cover masks 1 through 15, unequal-priority junctions, and equal-priority ties. Roof base, edge, and corner cells are separate from the terrain count band.
4. Pass. Each prototype character has eight reachable `24x30` world cells, a `40x44` portrait, foot exchange, generated contours, and readable conversation fixtures at UI scales 1, 1.25, and 1.5.
5. Pass. `tier-a-review.md` records 6 of 6 scene-hierarchy questions as passed.
6. Pass. `source-review/door-states-1x.png` covers open, closed-unlocked, and closed-locked fixtures. `source-review/tall-prop-depth-1x.png` covers the player in front of and behind every prototype tall-prop class. The multi-tile boards show the sofa, table, and fountain without internal seams. The packaged lifecycle images cover room entrance, roof restore, portals, and all four map transitions.
7. Pass. Deterministic byte output, reachability, bounds, extruded gutters, transparent-RGB hygiene, revision matching, no-filter rendering, the `1024x1024` cap, and the 4 MiB decoded-memory cap pass.
8. Pass. Legacy and enhanced maximum-load modes both measure 120 FPS and 8.3 ms median frame time. The median ratio is 1.0. Enhanced art adds one static batch.
9. Pass. Fresh start, save load, resize, all zooms, four map transitions, and restart pass. Restart preserves world zoom 3, UI scale 1.25, and the exact camera. No layout revision or save schema changed.
10. Pass. The real-packer full-program projection and actual prototype pack remain inside their raw-area, packed-area, and dimension limits.
11. Pending. The required Grok implementation audit follows this evidence commit.

## Commands that passed

- `npm run art:check`
- `npm run content:check`
- `npm run validate:content`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm test -- --runInBand` with 51 suites and 412 tests
- `npm run package:electron`
- `npm run smoke:art-quality -- --output-root artifacts/phase-24/art-quality/phase-28-prototype`
- `npm run smoke:natural-movement -- --output-root artifacts/phase-24/art-quality/phase-28-prototype/movement`
- `npm run smoke:responsive:qualification -- --output-root artifacts/phase-24/art-quality/phase-28-prototype/responsive`
- `npm run smoke:presentation-restart -- --output-root artifacts/phase-24/art-quality/phase-28-prototype/restart`
- `npm run smoke:save-migration -- --output-root artifacts/phase-24/art-quality/phase-28-prototype/save`
