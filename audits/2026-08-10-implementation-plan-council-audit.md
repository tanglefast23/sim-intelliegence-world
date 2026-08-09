# Implementation Plan Council Audit — 2026-08-10

## Scope

Audit `docs/plans/2026-08-10-feat-build-si-world-vertical-slice-plan.md` against `spec.md`. Find at most five release-blocking or high-impact omissions or contradictions in phase order, file ownership, acceptance gates, dependencies, verification, or the required Grok-audit, commit, pull-request, and merge protocol. Ignore style and minor polish. Decide whether the plan is executable from the current nearly empty repository through all 14 phases.

The council was read-only. Each reviewer received the same repository evidence and scope.

## Reviewers

- Claude Fable 5, exact requested model `claude-fable-5`, reasoning effort `xhigh`, no fallback
- Claude Opus 5, exact requested model `claude-opus-5`, reasoning effort `xhigh`
- Grok 4.5, exact requested model `grok-4.5`, reasoning effort `high`

All three returned complete structured findings.

## Synthesis and disposition

### 1. Gates scheduled before their systems exist — accepted

Agreement: Fable, Opus, and Grok.

Verified defects:

- Phase 6 required real sleep, travel, and quest autosave triggers before those systems existed.
- Phase 8 claimed every `WORLD-*` gate although player-name entry belongs to Phase 12 and the real quest autosave belongs to Phase 11.
- Phase 9 claimed every `AI-*` gate although Phase 10 implements relationship and rejection persistence.

Corrections:

- Phase 6 now proves persistence with fixture-driven stable-boundary requests.
- Phase 8 proves real sleep and travel triggers and only its named world gates.
- Phase 11 proves the real quest autosave.
- Phase 12 proves player-name persistence and reruns every integrated gate.
- Phase 9 owns conversation gates; Phase 10 owns the remaining `AI-10` social persistence and social parts of `AI-11`.

### 2. Signed-test qualification had no executable path — accepted

Agreement: Fable, Opus, and Grok.

The plan required `SHIP-01` while leaving all signing material behind an unscheduled release authorization. The specification and plan now define non-distribution test signing: macOS ad-hoc signing and a temporary local self-signed Windows test certificate. Release certificates, trust, and notarization remain future release decisions.

### 3. Shared phase files conflicted with exclusive staging — accepted

Agreement: Grok. Independently confirmed from the plan.

Later phases must update manifests, lockfiles, CI, their audit disposition, and their evidence directories. The protocol now permits only these named shared paths in addition to each phase's primary product files. Exact path review and exact staging remain mandatory.

### 4. Locked world-authorship layout had no owner — accepted

Agreement: Opus. Independently confirmed against `spec.md`.

Phase 5 now owns validation and minimum fixtures for `content/world/`. Phase 13 owns complete setting, history, social rules, locations, factions, characters, and reachability.

### 5. HFM rear-frame method was an undeclared external dependency — accepted

Agreement: Opus. Independently confirmed against the empty SI World repository.

Phase 4 now reads the local HFM method once and vendors an SI World implementation with its own tests. CI and later builds cannot read sibling repositories. The exact read-only local HFM and Life Sim paths are prerequisites only for that extraction step.

### 6. Knowledge isolation needed a non-vacuous second NPC — accepted

Agreement: Fable. Independently confirmed against `AI-08` and `AI-14`.

Phase 9 now includes a minimal second named-NPC knowledge fixture. This proves Linda-only knowledge does not leak without pulling the production cast into the phase.

### 7. Locked 100 ms feedback threshold was not measured — accepted

Agreement: Fable. Independently confirmed against `spec.md` performance requirements.

Phase 14 now measures non-text response feedback separately from first-token and validated-dialogue timing.

## Additional verified clarification

Opus noted that the save design names Steam Cloud compatibility while the plan excluded conflict UI. Phase 6 now keeps each slot in a self-contained file tree with no process-local persistence dependency. This supports later file synchronization without adding Steam integration or conflict UI to the prototype.

## Rejected or narrowed claims

- A production second named NPC is not required in Phase 9. A named knowledge fixture is sufficient for `AI-08`; full cast content remains Phase 13.
- Release signing certificates and notarization are not required to prove a non-distribution signed-test package. The specification now makes that distinction explicit.
- Phase path lists do not need permanent single-writer ownership across the entire project. They need exclusive ownership within one PR plus a narrow shared-infrastructure rule.

## Result

After these corrections, the 14-phase order has an executable acceptance path. Later phases must still fail honestly if named baseline hardware, model performance, or platform qualification evidence is unavailable.
