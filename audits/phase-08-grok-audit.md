# Phase 8 Grok Audit

## Scope

Grok 4.5 reviewed the Phase 8 diff from `origin/main` at high reasoning effort. The audit covered authoritative time, large jumps, needs, economy, schedules, transfers, map transitions, rollback, autosaves, migrations, renderer wiring, and packaged smoke evidence.

## Verified and fixed

1. **Stale approaching transfers could survive a later schedule.** A new schedule milestone now cancels the NPC's superseded `approaching_exit` transfer before it assigns the next goal. Active movement departs only when the current travel goal is the exact portal owned by that transfer. Normal goal completion also removes a mismatched approaching transfer defensively.
2. **The v3-to-v4 migration used one tile per location.** Migration now maps each locked `(locationId, activityId)` pair to the exact authoritative prototype tile. The legacy-save test compares every migrated Linda block with the current initial schedule.
3. **An unreachable active NPC never retried.** Active movement now requests a new path when an old path is unreachable or its goal changes. A regression test blocks and releases the generic resident's goal.
4. **Sleep used a render-time state snapshot.** Sleep now applies through a functional state update, cancels the old player path, rebuilds NPC movement, and starts the overnight autosave from the committed `sleep-completed` event.

## Rejected after verification

1. **Backfill daily costs during v3-to-v4 migration.** Phase 8 introduces the basic-cost cursor. Versions 1 through 3 did not record which historical days had paid this new cost. Retroactive backfill would remove money that the old version never charged. Migration intentionally starts at the next midnight after the saved clock. Live v4 simulation then advances the cursor without gaps.

## Audit result

Four findings were accepted and fixed. One migration-policy finding was rejected because its proposed backfill would create a new player-visible charge without historical authority.
