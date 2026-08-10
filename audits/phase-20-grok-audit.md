# Phase 20 Grok audit

Date: 2026-08-11

## Scope and method

The first `high`-effort audit sent the complete 71-file Phase 20 diff to Grok 4.5. It reached the 24-turn limit without a structured verdict. Session: `019fed1d-9d14-79e3-b4ef-83869d075cd2`. No result from that run was treated as an audit verdict.

The evidence was then split into three bounded `high`-effort audits:

1. save persistence and deterministic layout recovery;
2. runtime rendering, collision, clicks, doors, roofs, and transitions;
3. generated maps, stable identities, production content, and migrations.

## Bounded verdicts

### Save and layout recovery

Verdict: `NO_CONFIRMED_FINDINGS`.

Grok found consistent v5/v6 checksums, candidate classification, generation-first selection, typed load results, all-or-nothing recovery, stable portal repair, source preservation, and recoverable first-write faults in the supplied evidence.

### Runtime and collision

Verdict: `FINDINGS`.

1. **Portal travel could start below blocking UI — confirmed and fixed.** `WorldScene` now gates automatic portal travel when dialogue or a journal/relationship panel is open. A pure gate test covers dialogue, panels, movement, an active transition, and arrival lock.
2. **Closed doors received weaker compile-time reachability than runtime collision — confirmed and fixed.** Door and building validation no longer removes closed entrance tiles from the compiled blocker set. A closed outer entrance now fails building reachability instead of shipping a route that runtime movement refuses.
3. **Objects with multiple interactions selected the first interaction — confirmed and fixed.** Owner routing now compares every reachable approach, selects the shortest path, then breaks ties by stable interaction ID and tile order. A two-interaction test proves the result.

### Generated maps and stable identities

Verdict: `FINDINGS`.

1. **Invitation travel used the old `(18,18)` home-visit target — confirmed and fixed.** Both local and cross-map invitations now use `GENERATED_LAYOUT.homeVisitTile`. The cross-map test checks the stored destination goal.
2. **All production actor start tiles remain in Sunward — not a Phase 20 defect.** The Phase 13 accepted audit locks production schedules to the populated northwest prototype until multi-hop NPC schedule travel exists. A trial use of the cross-district work tiles caused northwest-to-southeast schedule routes to fail because the current transfer engine supports one cardinal hop. Phase 20 does not add multi-hop NPC travel. Initial gathering positions remain generated stable identities.
3. **Generated actor map and location identity was discarded by production state — confirmed and fixed.** Production NPC presence and ambient schedules now consume generated `mapId` and `locationId` values instead of replacing them with northwest literals. Tests prove the state uses the complete generated identity.
4. **Neighborhood IDs lacked explicit authored bindings — disproved.** `compileLocationBindings` creates the map ID binding from all walkable cells after it compiles explicit business and home bindings. Content validation passed against that compiled index.
5. **The v5-to-v6 migration did not show a recovery entry point — disproved by the save audit.** The bounded content audit did not include persistence files. The separate save audit inspected `SaveRepository` and `layout-recovery.ts` and returned no confirmed finding.

## Verification before correction audit

- 89 focused tests passed.
- Type-checking passed.
- The committed-content generator produced no remaining content or fixture diff.

## Correction audit

Verdict: `NO_CONFIRMED_FINDINGS`.

Grok verified the generated home-visit identity, generated production presence identity, northwest-only schedule boundary, portal UI gate, closed-door reachability, and deterministic multi-interaction routing. It found no confirmed high-impact defect introduced or left by the corrections.

## Final local gates

- `npm run verify:ci-build`: passed with 36 suites and 338 tests.
- Web export: passed.
- Electron security/package/conversation tests: passed.
- Model lifecycle tests: passed.
- macOS arm64 package: passed.
- Packaged world smoke: passed all gameplay checks; measured renderer rate was 114.57 FPS against the required 60 FPS threshold.
