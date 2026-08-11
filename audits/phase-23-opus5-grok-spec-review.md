# Phase 23 Opus 5 and Grok specification review

## Scope

Opus 5 and Grok 4.5 independently reviewed `docs/specs/2026-08-11-natural-movement.md`. Both reviews were read-only. They covered player movement feel, deterministic pathfinding, collision, reservations, interpolation, corner curves, character frames, pixel snapping, accessibility, performance, and executable proof.

## Shared conclusion

Both reviewers confirmed that natural movement is implementable with the current eight atlas cells per character. The existing front, rear, left, and right frame pairs are sufficient. Diagonal travel can reuse front or rear cells for the first proof.

## Opus 5 findings

1. Per-tile easing would create visible stop-start pulsing and conflict with constant world speed.
2. A curve needs reservations for its complete clearance envelope, and an interruption must not bend toward an abandoned route node.
3. Foot phase must follow distance instead of a free-running global timer.
4. Physical-pixel snapping must include DPR.
5. Qualification traces need an injected fixed-step driver, and character transforms must stay separate from static world batches.

Opus also corrected diagonal duration: true constant-speed travel is about `205 ms`, while `14:10` remains only the A* cost approximation.

## Grok 4.5 findings

1. Head-on actors need a deterministic conflict rule so they do not replan forever.
2. One shared blocker function must include terrain, compiled solids, door state, occupancy, and reservations.
3. A reserved destination needs defensive validation before tile commit.
4. Constant speed conflicts with per-segment easing.
5. The speed-2, delta-clamp, and foot-phase rules must describe one consistent timing model.

## Orchestrated synthesis

The final specification applies the council's corrections:

- constant-speed segments and arc-length corner sampling;
- true-distance segment duration with integer A* costs kept separate;
- curve-envelope reservations and latched blend decisions;
- a pending click or stop disables an unstarted curve;
- one pure movement-blocker function;
- atomic ordered head-on edge exchange plus stable wait/yield behavior;
- defensive pre-commit validation;
- distance-based gait phase per actor;
- DPR-aware render-only snapping;
- fixed-step deterministic qualification traces;
- character-only transient render batches;
- an explicit acceptance of front/rear diagonal art until the player-visible proof shows that a three-quarter view is necessary.

No reviewer requested more character frames, a navmesh, physics, fractional zoom, or a save-schema change.
