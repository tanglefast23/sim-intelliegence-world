# Phase 23 Grok implementation audit

## Scope

Grok 4.5 reviewed the final natural-movement specification, implementation plan, movement runtime, renderer integration, reservations, pathfinding, and focused tests at high reasoning effort. The review was read-only and excluded user-owned generated PNG files, `output/`, credentials, dependencies, and unrelated artifacts.

## Initial findings

1. **Critical:** opposing actors advanced separately, so one head-on participant could commit into the other participant's authoritative tile before the second participant finished.
2. **High:** only an active segment destination was reserved. After a commit, `path[0]` was unreserved until the next frame began its segment.
3. **High:** a pending click or stop switched a started turn blend back to straight interpolation because no accepted curve was latched in movement state.
4. **High:** the blocked-route path replanned once but did not perform the specified four-claim yield search.
5. **Medium:** `travelDistance` survived idle arrival and a new request, so a route could start on the second foot frame.

## Local verification

Codex traced and confirmed all five findings. The existing green suite did not directly cover these exact state boundaries.

## Corrections

1. The central frame coordinator now prepares all active actor requests before claim resolution. Exact head-on partners advance as one pair. Neither authoritative commit is exposed unless both pure movements validate and commit in the same frame. Both domain commands are then applied in stable player-first and NPC-ID order before the returned state is visible.
2. Reservation keys now include `segment.to`, or `path[0]` between segments, plus every tile in a latched curve envelope. Player-first and stable NPC claim checks use these keys.
3. An accepted turn curve and its corner are stored in `MovementState`. A replacement click or Escape suppresses only a curve that has not started. A started curve continues to be sampled during the active segment.
4. Blocked movement counts a four-claim budget. It first attempts a deterministic replan, then searches stable rings up to six tiles for a reachable yield tile. The actor keeps the original target as `resumeTarget` and resumes it after yielding. If no yield exists, it waits without route churn and can continue when the blocked next tile clears.
5. Successful new requests, cancellation, and idle arrival reset `travelDistance` and `walkFrame` to the first gait frame.

## Added proof

- A head-on integration test checks every returned frame for authoritative overlap and proves the final tile exchange.
- A next-node reservation test covers the between-segment boundary.
- A curve test clicks after the curve latches and proves it remains active.
- A blocked-target test proves yield recovery after four claims and retention of the original target.
- A gait test proves each new route starts on frame 1.
- Full result after corrections: 42 suites and 375 tests passed; TypeScript passed.

## Correction audit

Grok 4.5 found two remaining defects in the first correction:

1. Equal claims for one unoccupied next tile were symmetric, so both actors could wait forever.
2. A second yield could replace the original `resumeTarget` with the first yield tile.

Codex confirmed both findings. Claim assembly now includes reservation keys only from actors with higher stable priority: protagonist first, then NPC ID. Presence tiles remain blockers for every other actor. Chained yields now keep `state.resumeTarget ?? state.target`. New tests prove one stable winner for a shared next tile and preservation of the original target through a second yield.

The next Grok 4.5 correction review found three additional defects:

1. `requestMovement` did not merge dynamic actor blockers into its path search.
2. The packaged report validator trusted harness summary fields instead of recomputing curve, continuity, gait, and interruption gates from recorded samples.
3. The `55 FPS` gate was optional for non-qualification callers.

Codex confirmed all three findings. New route searches now merge static and dynamic blockers while allowing the actor's own tile. The report records an interruption-tagged renderer sample, derives all movement gates from the recorded samples, requires its summary to match those derived values, and always requires at least `55 FPS` in the standard packaged pass. A new pathfinding test proves a fresh route avoids a dynamically occupied tile. Validator tests prove a low-FPS report fails.

Final Grok 4.5 correction review returned `NO_CONFIRMED_FINDINGS`. It checked the three narrow corrections: occupancy-aware route construction, sample-derived packaged gates with an interruption marker, and unconditional `55 FPS` enforcement.
