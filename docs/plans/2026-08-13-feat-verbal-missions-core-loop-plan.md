---
title: "feat: Build the Verbal Missions core loop"
type: feat
date: 2026-08-13
status: proposed
base_sha: 44dc266f79417ef77eb63affb83904e3a3be7281
source_spec: docs/specs/2026-08-13-verbal-missions-ultimate-specC.md
---

# Build the Verbal Missions core loop

## 1. Outcome

Ship three authored missions that let the player persuade an NPC with free text while deterministic code owns every lasting result.

The vertical slice proves:

- Tomas can disclose one exact fact.
- Linda can sell one unique object at exact terms.
- Priya can agree to one scheduled action whose later result is resolved by world state.
- The same Concern Ledger and Outcome Engine handle all three missions.
- Unsupported goals remain ordinary dialogue and change no durable state.
- Model text can express an outcome but cannot invent one.

This plan implements the system spec at `docs/specs/2026-08-13-verbal-missions-ultimate-specC.md`.

## 2. Build rule

Use the smallest extension of the current architecture.

Reuse:

- `ConversationService` and `ConversationTransaction`;
- the existing serialized local model and `ModelSupervisor`;
- `parseBoundedJson` for strict model JSON;
- Zod 4 schemas and the current command/event reducer;
- the journal, relationship, inventory-money, schedule, and save systems;
- the current content build and validation scripts;
- direct JSON imports through TypeScript's existing `resolveJsonModule` support.

Do not add:

- a second model server;
- a new state manager;
- a generic action executor;
- a general market, wallet, promise, consent, crime, or romance engine;
- a generated mission catalog when direct typed JSON imports pass the boundary check;
- a new dependency.

## 3. Current flow to preserve

The live path is:

```text
ConversationPanel
  → ConversationPort
  → Electron preload
  → conversation IPC
  → ConversationService
  → local model supervisor
  → ConversationTransaction
  → domain command reducer
  → renderer state
  → autosave
```

The main anchors are:

- `src/ui/ConversationPanel.tsx`
- `src/application/effects/ConversationPort.ts`
- `electron/preload/index.ts`
- `electron/conversation/ipc.ts`
- `src/ai/conversation/service.ts`
- `src/ai/conversation/transaction.ts`
- `src/domain/commands/types.ts`
- `src/domain/commands/reducer.ts`
- `src/domain/events/types.ts`
- `src/domain/state/schema.ts`

Verbal Missions extend this path. They do not replace ordinary conversation.

## 4. Locked implementation decisions

### 4.1 Authority

The Move Reader returns only closed semantic IDs and exact evidence spans.

The pure Outcome Engine turns that validated move into one closed outcome.

`ConversationTransaction` stages that outcome and any exact authored player-fact record it reveals. Normal exit commits them. A technical abort may discard only when no outcome was decided.

Mission projection, repetition, adjudication, and readiness always read `ConversationTransaction.previewState`, rebuilt after every staged command. Only the final goal-family closer reads the committed state returned by `commit()`.

The Actor receives the decided outcome and writes dialogue. Actor text never mutates state.

Final confirmation first commits the open transaction. It then runs one goal-family command against that returned state and marks the session settled. Duplicate confirmation or later close returns the same settled state.

### 4.2 Domain commands

Add only these command families:

- `offer-verbal-mission`
- `apply-verbal-mission-outcome`
- `withdraw-verbal-mission`
- `record-player-knowledge`
- `record-fact-disclosure`
- `purchase-unique-object`
- `create-scheduled-commitment`
- `resolve-scheduled-commitment`

`apply-verbal-mission-outcome` accepts only the closed result of the pure engine. The reducer checks the mission ID, NPC, current status, expected concern states, legal concern transitions, unique outcome ID, and goal-family terms. It cannot execute money, ownership, terminal goal disclosure, scheduling, relationship-stage, consent, crime, or violence changes.

`record-player-knowledge` accepts one registered fact atom and one closed authored source. A mission turn may stage it only when the Outcome Engine names that fact in its closed outcome. A world interaction may use it for an authored discovery. Version one is first-write-wins by `factId`: later writes for that fact are no-ops and never replace provenance. It never accepts model-written fact text.

The three goal-family commands perform those exact changes. There is no `execute-goal` command.

### 4.3 Content source

Put shared schemas in `src/content/schemas/verbal-mission.ts`.

Put the three production mission files in `content/verbal-missions/`.

Import those JSON files from one `src/content/verbal-missions/catalog.ts`. Parse them at module load and expose lookup by mission and NPC ID.

Add a generated catalog only if `check:boundaries` proves direct imports violate an existing boundary. Do not build both paths.

### 4.4 Save authority

Version 7 adds four records:

- `playerKnowledge`
- `worldObjects`
- `verbalMissions`
- `commitments`

Freeze `LegacyStateV6Schema` before changing `WorldStateBaseSchema`. Older migration schemas must stop deriving from the current base.

Version 7 also replaces a journal entry's required `questId` with a discriminated `subject`: either a quest or a Verbal Mission. Migrate every current entry to a quest subject. Do not create placeholder quest records for Verbal Missions.

`worldObjects` is the only owner record for unique mission objects. Linda's purse never also appears in counted inventory.

### 4.5 Pending turns

Keep one pending mission outcome in the main-process conversation session.

Key it by `conversationId + turnId`.

- Repeating `readVerbalMissionTurn` returns the same result.
- `completeVerbalMissionTurn` consumes that result once.
- New input is rejected while one result is pending.
- Closing clears pending data.
- Actor failure uses the authored fallback and keeps the staged outcome.

Do not persist pending model work to disk.

### 4.6 Product boundary

Version one supports only `disclose_fact`, `buy_object`, and `schedule_cooperation`.

Marriage, murder, romance, consent, crime, and violence requests can receive dialogue. They cannot call a goal-family command.

## 5. Git and phase procedure

The root worktree contains unrelated user changes. Do not stage, reset, format, move, or delete them.

Use `codex/verbal-missions-integration` as the clean integration branch. Use one short-lived `codex/verbal-missions-pN-*` branch per phase.

For every phase:

1. Branch from the current integration head.
2. Work in a dedicated worktree.
3. Run the phase's focused tests and `git diff --check`.
4. Stage only files named by that phase.
5. Inspect the staged diff and commit it.
6. Merge with `--no-ff` into the clean integration worktree.
7. Rerun the phase gate after the merge.
8. Prove the phase branch is an ancestor of integration.
9. Remove its clean worktree and delete only that merged local branch.

Do not prune any existing Claude, user, art, or remote branch. At the end, fast-forward local `main` to the verified integration head if the unrelated root changes do not overlap. Then prove the SHA and zero divergence. Delete the integration branch only after that proof.

## 6. Phase 1: prove the local-model path

### Goal

Prove the Reader, early authoritative reaction, Actor, and policy path meet safety and hardware gates before changing saves.

### Files

Create or modify only:

- `src/ai/schemas/verbal-move.ts`
- `src/ai/conversation/verbal-mission-prompts.ts`
- `src/ai/conversation/verbal-mission-reader.ts`
- `src/ai/__tests__/verbal-mission-spike.test.ts`
- `tests/fixtures/ai-capability/verbal-missions.ts`
- `scripts/qualification/run-model-qualification.ts`
- a dated JSON result under `tests/fixtures/performance/` only after a real run.

### Work

1. Define the strict `VerbalMoveSchema` from the system spec.
2. Parse model output with `parseBoundedJson` and Zod.
3. Validate every ID against the projected candidate set.
4. Validate each evidence substring against the exact player message.
5. Reject duplicate JSON keys, unknown fields, unknown IDs, missing evidence, and oversized output.
6. Build one compact Reader prompt with only scene candidates and currently speakable facts.
7. Build one Actor test prompt containing a fixed authoritative outcome.
8. Reuse the service-owned single retry. Do not call a helper that adds another retry.
9. Measure three timestamps: thinking feedback, authoritative reaction, and validated Actor text.
10. Run the existing output policy path after the Actor.
11. Record first-pass schema validity, retry rate, false high-impact referents, fact leakage, and p95 timings on both locked 16 GB model baselines.

### Focused checks

```bash
npm test -- --runInBand --runTestsByPath src/ai/__tests__/verbal-mission-spike.test.ts
npm run typecheck
npm run check:boundaries
npm run model:qualify
```

### Gate

- First-pass structured validity is at least 95%.
- Wrong high-impact referents are below 1%.
- Concealed facts never leak.
- Authoritative portrait or cue is at most 3 seconds p95.
- Validated visible text begins within the existing 12-second p95 gate.
- The renderer remains responsive during the full path.

If either locked model or machine fails, stop. Trim prompts or choose a passing installed model. Do not start the save migration.

### Completed development result

The real spike selected `qwen3.5-4b`.

- 4B: 100% first-pass valid Reader structures, 0% wrong high-impact referents, 1.56-second p95 authoritative reaction, and 2.73-second p95 full path.
- 9B: 93.75% first-pass valid Reader structures and 6.25% wrong high-impact referents, so it is not eligible for Verbal Missions.

The 4B fine-grained tone diagnostic was 31.25%. The authoritative engine does not trust tone or generated text for state changes. Expand and tune that corpus during phase 8 before release.

This Mac has 128 GB RAM, so these timings are development evidence only. Phase 8 still requires both locked 16 GB machines. Phase 2 may proceed because no locked machine failed; those machine gates are unrun and remain release blockers.

### Commit

`test: qualify verbal mission model pipeline`

## 7. Phase 2: add contracts and save version 7

### Goal

Add the smallest closed state needed by the three missions and migrate every supported save safely.

### Files

Create:

- `src/domain/verbal-missions/state.ts`
- `src/domain/state/migrations/v6-to-v7.ts`
- `src/domain/__tests__/verbal-mission-state.test.ts`

Modify:

- `src/domain/state/models.ts`
- `src/domain/state/schema.ts`
- `src/domain/state/initial-state.ts`
- `src/domain/state/migrations/index.ts`
- `src/domain/quests/journal.ts`
- `src/domain/commands/types.ts`
- `src/domain/commands/reducer.ts`
- `src/domain/events/types.ts`
- `src/domain/quests/quest-machine.ts`
- `src/ui/JournalPanel.tsx`
- `src/domain/__tests__/state-schema.test.ts`
- `src/render/__tests__/journal-markers.test.ts`
- `src/world/__tests__/simulation.test.ts`
- each legacy migration schema that currently derives from `WorldStateBaseSchema`
- `electron/persistence/save-format.ts`
- `electron/persistence/checksum.ts`
- `electron/persistence/recovery.ts`
- `electron/persistence/save-repository.ts`
- `src/application/effects/PersistencePort.ts`
- `scripts/content/build-save-cutover-fixtures.ts`
- `scripts/electron/run-save-migration-package-smoke.ts`
- `scripts/qualification/write-save-evidence.ts`
- `scripts/qualification/art-quality-final-manifest.ts`
- save fixtures and their focused tests.

### Work

1. Add the exact strict state schemas from section 18.1 of the system spec.
2. Reuse `KnowledgeRecordSchema` for `playerKnowledge`.
3. Replace `JournalEntrySchema.questId` with the closed quest-or-mission subject union.
4. Migrate every existing journal entry to `{ kind: 'quest', questId }`.
5. Validate each journal subject against the matching quest or Verbal Mission.
6. Update journal commands, reducer reads, quest writers, the journal panel, and focused fixtures to branch on `subject.kind`.
7. Keep the persisted `journal-entry-upserted` event's current quest-only shape. Verbal Mission commands emit their own events with journal IDs so existing event ledgers remain parseable.
8. Add key-to-ID checks for every new record.
9. Reject duplicate credited moves, fired allergies, liabilities, and commitment IDs.
10. Reject a mission whose goal kind or target IDs disagree with its terms.
11. Freeze a complete `LegacyStateV6Schema` before changing the current base.
12. Make migrations 1 through 6 parse their historical shapes without importing the new base shape.
13. Migrate v6 to v7 with empty player knowledge, missions, and commitments.
14. Replace the global model pin with the already-installed and qualified `qwen3.5-4b` revision `851bf6e806efd8d0a36b00ddf55e13ccb7b8cd0a` and artifact SHA-256 `32c8ff2d0972cc26d4c1f99d6655c7e0d4814bae9c23093a9213e23fd36e3d14`.
15. Seed only `linda_marchetti_purse`, owned by `linda`.
16. Update the save envelope, checksum, recovery, evidence, and packaged migration paths for v7.
17. Preserve source bytes and backup behavior when migration fails.

### Focused checks

```bash
npm test -- --runInBand --runTestsByPath src/domain/__tests__/verbal-mission-state.test.ts tests/electron/save-faults.test.ts
npm run content:check
npm run save:qualify
npm run typecheck
npm run check:boundaries
```

Run `npm run smoke:save-migration` only through its hidden and muted Electron path. Do not show or focus Electron.

### Gate

- Save versions 1 through 6 reach valid version 7.
- A migrated save reloads twice without changing semantic state.
- Invalid new records fail closed.
- Quest and Verbal Mission journal subjects validate without duplicate lifecycle state.
- Unsupported versions and damaged saves preserve recoverable bytes.
- Linda's purse has one owner record and no counted inventory copy.

### Commit

`feat: add verbal mission save state`

## 8. Phase 3: build content validation and the pure Outcome Engine

### Goal

Turn one validated move into one deterministic, replayable outcome without model, UI, IPC, or persistence code.

### Files

Create:

- `src/content/schemas/verbal-mission.ts`
- `src/domain/verbal-missions/outcome-engine.ts`
- `src/domain/verbal-missions/repetition.ts`
- `src/domain/verbal-missions/__tests__/outcome-engine.test.ts`
- `src/content/__tests__/verbal-mission-validation.test.ts`
- small test mission fixtures under `tests/fixtures/verbal-missions/`.

Modify:

- `src/content/registries/catalog.ts`
- `scripts/content/validate-content.ts`
- `scripts/content/build-production-content.ts` only if content checking needs to include mission JSON.

### Work

1. Define strict schemas for dispositions, concerns, levers, allergies, recoveries, goal contracts, reactions, and mission definitions.
2. Use discriminated goal contracts so commerce fields cannot appear on Tomas or Priya.
3. Validate stable IDs, candidate references, source facts, and allowed transition pairs.
4. Add a small route solver over authored concern states.
5. Prove one honest success path, every claimed recovery path, and a false opening `confirmWhen`.
6. Prove a naked request cannot make confirmation legal.
7. Process a move in fixed precedence: boundary, threat or lie, allergy, impossible term, recovery, at most two levers, repetition or small talk.
8. Let the first three categories cancel positive progress.
9. Credit the composite of lever, concern, support facts, and offer amount once.
10. Track consecutive semantic repeats. Do not add fuzzy text-overlap punishment.
11. Change `terms.currentOffer` only through a credited offer lever.
12. When a new credited offer is below the prior credited amount, reopen `payment` and `value` before testing readiness.
13. Derive readiness from the current preview state and contract. Never save `ready` as a mission status.
14. Emit a closed outcome with concern transitions, room state, exact reaction ID, portrait ID, cue ID, optional fact disclosure, and confirmation state.
15. Add seeded replay tests proving identical inputs produce identical outcomes.

### Focused checks

```bash
npm test -- --runInBand --runTestsByPath src/domain/verbal-missions/__tests__/outcome-engine.test.ts src/content/__tests__/verbal-mission-validation.test.ts
npm run validate:content
npm run typecheck
npm run check:boundaries
```

### Gate

- Every legal concern transition passes.
- Every illegal transition fails.
- Repetition grants no new progress.
- Boundaries never weaken.
- Randomized replay is deterministic.
- Every test mission has a proven honest route.

### Commit

`feat: add verbal mission outcome engine`

## 9. Phase 4: add mission lifecycle and goal-family commands

### Goal

Make offers, turn outcomes, exact closers, and Priya's later resolution atomic and idempotent.

### Files

Create:

- `src/domain/verbal-missions/commands.ts`
- `src/domain/verbal-missions/goal-planners.ts`
- `src/domain/verbal-missions/commitments.ts`
- `src/domain/verbal-missions/__tests__/commands.test.ts`
- `src/domain/verbal-missions/__tests__/goal-planners.test.ts`

Modify:

- `src/domain/commands/types.ts`
- `src/domain/commands/reducer.ts`
- `src/domain/events/types.ts`
- `src/domain/events/apply.ts` if event replay uses a separate dispatcher;
- `src/domain/quests/journal.ts`
- the world tick and sleep path that already resolves scheduled work.

### Work

1. Add `offer-verbal-mission` with one unresolved mission per NPC.
2. Create the available mission and journal entry atomically.
3. Make repeated offer checks return the same state.
4. Move `available` to `active` on the first decided mission turn.
5. Add `apply-verbal-mission-outcome` with expected prior state and unique `outcomeId` checks.
6. Commit staged mission progress on normal exit, including backfires.
7. Add explicit withdrawal. Ordinary cancel cannot silently withdraw a mission.
8. Add one exact planner and reducer path for each goal family.
9. Add `record-player-knowledge` for non-terminal authored discoveries and engine-authorized conversational disclosure.
10. Make duplicate delivery of the same fact and source a no-op.
11. `record-fact-disclosure` writes Tomas's `playerKnowledge`, terminal mission state, journal receipt, and authored relationship result atomically.
12. `purchase-unique-object` revalidates money, owner, current offer, hard minimum, confirmation rule, and success rule before moving money and ownership.
13. Author Linda's legal `$100` `paid_too_much` terminal result separately from under-`$100` success.
14. `create-scheduled-commitment` creates only `agreed`.
15. `resolve-scheduled-commitment` alone creates `honoured`, `delayed`, or `reneged` from deterministic world state.
16. Run due commitment resolution after time advance, sleep, and load.
17. Return the same terminal receipt for duplicate confirmation or resolution delivery.
18. Reject all cross-family commands and unsupported goal kinds.

### Focused checks

```bash
npm test -- --runInBand --runTestsByPath src/domain/verbal-missions/__tests__/commands.test.ts src/domain/verbal-missions/__tests__/goal-planners.test.ts
npm run verify:first-hour
npm run typecheck
npm run check:boundaries
```

### Gate

- Offer, outcome, close, and commitment events are idempotent.
- `$79` refuses, `$80` succeeds when every required concern is resolved, `$99` succeeds, and `$100` yields `paid_too_much`.
- Insufficient funds and wrong ownership change nothing.
- Tomas, Linda, and Priya reject another family's closer.
- Priya's agreement never equals follow-through.

### Commit

`feat: add verbal mission goal commands`

## 10. Phase 5: wire the Reader, Outcome Engine, Actor, and IPC

### Goal

Add the split mission turn to the existing conversation service without changing ordinary dialogue behavior.

### Files

Create:

- `src/ai/conversation/verbal-mission-session.ts`
- `src/ai/conversation/verbal-mission-actor.ts`
- `src/ai/conversation/__tests__/verbal-mission-session.test.ts`

Modify:

- `src/ai/conversation/service.ts`
- `src/ai/conversation/transaction.ts`
- `src/ai/projection/prompt-projection.ts`
- `src/application/effects/ConversationPort.ts`
- `electron/preload/index.ts`
- `electron/conversation/ipc.ts`
- `tests/electron/conversation-ipc.test.ts`
- `src/ai/__tests__/conversation-system.test.ts`

### Work

1. Look up the NPC's unresolved mission when a full-AI conversation starts. Both `available` and `active` enter the mission path.
2. Leave `sendConversationTurn` unchanged for NPCs without a mission.
3. Add typed `readVerbalMissionTurn`, `completeVerbalMissionTurn`, and `confirmVerbalMissionGoal` operations.
4. Reuse existing message limits, content policy, pause token, session ownership, and serialized model access. Do not call `stageMutualInteraction()` for mission turns.
5. Narrow referent and fact candidates before the Reader.
6. Run deterministic number and explicit-action parsing before model interpretation.
7. Validate the Reader once, retry once, then return authored clarification with no state change.
8. Run projection, repetition, the Outcome Engine, and readiness against `transaction.previewState`. Run the engine exactly once and stage its closed command plus any exact `record-player-knowledge` command. The first decided turn stages `available → active` and rebuilds the preview for the next turn.
9. Return the authoritative portrait, cue, room state, concern changes, and Read the Room line before the Actor starts.
10. Inject only speakable facts and the exact outcome into the Actor prompt.
11. Run existing output schema, policy, and exact-term contradiction checks.
12. Retry the Actor once, then use the authored outcome-specific fallback.
13. Ensure Actor failure cannot erase a staged fact disclosure or concern result.
14. Grant no ordinary per-turn relationship delta or stage request. The first credited lever may stage one authored Familiarity signal per conversation; Trust changes come only from authored concern or closer results.
15. Make `END`, `WALK AWAY`, and UI close commit a decided mission turn.
16. Allow technical abort to discard only if the transaction has no decided turn.
17. On confirmation, commit the open transaction first. Apply the goal-family closer to that returned state, then store the final state as the session's settled state.
18. Return the same settled state for duplicate confirmation and for later `END`, `WALK AWAY`, close, or abort delivery. Release the session only after that close delivery.
19. Clear all pending outcome data on every close and error path.

### Focused checks

```bash
npm test -- --runInBand --runTestsByPath src/ai/conversation/__tests__/verbal-mission-session.test.ts src/ai/__tests__/conversation-system.test.ts tests/electron/conversation-ipc.test.ts
npm run test:model
npm run test:electron:unit
npm run typecheck
npm run check:boundaries
```

### Gate

- Reader failure changes no mission state.
- Actor failure keeps the decided outcome and returns only authored fallback text.
- Repeated read returns the same staged result.
- A second input while pending is rejected.
- Exit after progress or backfire commits once.
- Closer failure changes no goal-family result. Already-decided turn progress remains and the refreshed state is returned.
- An available mission becomes active on its first decided turn.
- A confirmed result cannot be rolled back by the panel's later close or abort call.
- Later turns see concern, offer, repetition, and knowledge state staged earlier in the same conversation.
- Small talk, repetition, and backfires cannot trigger the ordinary relationship or stage-advance path.
- Ordinary conversation tests remain unchanged.

### Commit

`feat: wire verbal mission conversation pipeline`

## 11. Phase 6: add player-facing mission feedback

### Goal

Make the system readable without showing model internals or secret scores.

### Files

Create only if separation keeps `ConversationPanel` readable:

- `src/ui/VerbalMissionFeedback.tsx`
- `src/ui/VerbalMissionConfirmation.tsx`
- focused UI tests beside them.

Modify:

- `src/ui/ConversationPanel.tsx`
- `src/ui/CharacterPortrait.tsx`
- `src/ui/conversation-feedback.ts`
- `src/audio/vocal-cue-policy.ts`
- `src/ui/__tests__/conversation-feedback.test.ts`
- existing conversation panel tests.

### Work

1. Show thinking feedback immediately.
2. Apply the authoritative portrait and authored vocal cue when the Reader operation returns.
3. Start the Actor operation only after that reaction is visible in state.
4. Show Read the Room, revealed concerns, qualitative room state, recall chips, and relevant physical actions.
5. Keep hidden concerns hidden and private prices out of all UI text.
6. Add exact goal-specific confirmation cards.
7. Show object, price, target, action, time, and consequence fields relevant to that goal only.
8. Disable confirmation while terms are stale or invalid.
9. After successful confirmation, show the exact receipt and remove Cancel.
10. Make close after any decided turn commit without a discard prompt.
11. Keep ordinary conversation layout and keyboard behavior working.
12. Use existing portrait frames where they communicate the five required reactions. Add art states only when a named mission reaction cannot be expressed accurately.
13. Keep all controls labeled and keyboard reachable.

### Focused checks

```bash
npm test -- --runInBand --runTestsByPath src/ui/__tests__/conversation-feedback.test.ts
npm run export:web
npm run typecheck
```

Use hidden renderer screenshots only if unit and web-export checks cannot prove layout. Keep Electron muted and unfocused.

### Gate

- Players see the authoritative reaction before generated dialogue.
- No Reader, Actor, model, score, or private-price label reaches player copy.
- Confirmation names the exact irreversible result.
- Reduced motion, keyboard control, and accessible labels pass.
- Ordinary conversations remain usable at supported window sizes.

### Commit

`feat: add verbal mission conversation feedback`

## 12. Phase 7: author and connect the vertical slice

### Goal

Ship Tomas, Linda, and Priya through the shared system with no one-off success parser.

### Files

Create:

- `content/verbal-missions/tomas-ferry-fact.json`
- `content/verbal-missions/linda-purse-deal.json`
- `content/verbal-missions/priya-transport-assessment.json`
- `src/content/verbal-missions/catalog.ts`
- `src/content/__tests__/verbal-mission-production.test.ts`
- one complete committed trace fixture per mission.

Modify:

- item, fact, action, quest, and journal registries used by these missions;
- Tomas, Linda, and Priya writing rules;
- world interaction hooks that discover appraisal or evidence facts;
- the existing availability checks that offer quests and journal entries;
- initial or migrated unique-object data only as already defined in phase 2.

### Work

1. Author Tomas as the Tier 0 guided fact-disclosure mission.
2. Author Linda with four honest routes, one backfire, one recovery, the `$80` hard minimum, and under-`$100` success rule.
3. Author Priya with evidence, patient consent, capacity, a bounded schedule, and a deterministic later resolver.
4. Add a contrasting disposition fixture proving one tactic is not universal.
5. Give every required fact one reachable authored discovery source.
6. Offer each mission from one existing world or quest transition. Do not mutate mission availability inside conversation `begin()`.
7. Make offer checks idempotent across repeated ticks, visits, and reloads. Cover saved flags `linda_protected`, `linda_help_withdrawn`, `linda_protect_failed` for the `injured_escape` result, and the blocked `linda_betrayed` branch explicitly.
8. Keep ambient residents in ordinary authored dialogue.
9. Keep the existing cat candidate parser unchanged.
10. Add authored reaction and fallback copy for every outcome ID.
11. Run all route, recovery, hidden-boundary, cross-family, exact-term, and content-policy lints against production content.

### Focused checks

```bash
npm test -- --runInBand --runTestsByPath src/content/__tests__/verbal-mission-production.test.ts
npm run content:check
npm run validate:content
npm run verify:first-hour
npm run typecheck
npm run check:boundaries
```

### Gate

- All three missions use the same engine.
- Tomas and Priya contain no commerce fields.
- Every mission has one honest complete route.
- Linda has at least two meaningfully different complete routes in automated traces.
- Priya creates only an agreement during conversation.
- Unsupported goals cannot reach a mission command.

### Commit

`feat: ship verbal mission vertical slice`

## 13. Phase 8: qualify the integrated feature

### Goal

Prove the merged implementation is safe, deterministic, performant, and regression-free.

### Files

Modify only qualification corpora, deterministic evidence, and real-run reports needed to record the result.

### Automated corpus

Cover at least:

- 400 paraphrase and referent cases;
- prompt injection and fake-system messages;
- unknown and cross-family IDs;
- malformed Reader and Actor output;
- concealed facts and exact-term contradictions;
- every concern transition;
- repeat, backfire, recovery, cooldown, exit, reload, and confirmation races;
- `$79`, `$80`, `$99`, `$100`, insufficient funds, wrong owner, and double confirmation;
- Priya agreement, deadline, honour, delay, reneging, replay, save, and reload;
- unsupported marriage and murder requests;
- two contrasting NPC dispositions;
- deterministic seeded replay.

### Commands

```bash
npm run content:check
npm run validate:content
npm run check:boundaries
npm run typecheck
npm test
npm run export:web
npm run test:electron:unit
npm run test:model
npm run package:electron
npm run model:qualify
```

Run packaged smoke only through confirmed hidden, muted automation. Do not run `npm run dev:harness`. Do not show, focus, raise, or play audio from Electron.

### Gate

- Every automated safety and replay case passes.
- First-pass Reader validity is at least 95%.
- Wrong high-impact referents and false backfires stay below 1%.
- Authoritative feedback is at most 3 seconds p95.
- Validated visible text stays inside the existing 12-second p95 gate.
- Prompt byte and token budgets pass.
- No ordinary conversation, save, quest, relationship, world tick, or first-hour regression appears.

The build can be code-complete after this gate. The system spec's guided and unmoderated player tests remain a product-release gate. Do not invent their results.

### Commit

`test: qualify verbal mission vertical slice`

## 14. Required end-to-end traces

Before final merge, preserve these exact machine-level stories.

### Tomas

1. Offer appears once.
2. The first valid question moves the mission from available to active and resolves the visible concern.
3. The Outcome Engine stages the ferry fact.
4. Actor fallback can say the same fact.
5. Confirmation writes `playerKnowledge`, journal, mission result, and relationship receipt once.
6. Reload keeps the fact and terminal result.

### Linda

1. Mission starts available with the purse owned by Linda.
2. Meaning and appraisal address different concerns.
3. The appraisal alone cannot confirm.
4. A later `$95` offer makes confirmation legal.
5. Confirmation moves `$95` and one ownership record atomically.
6. Duplicate delivery changes nothing.
7. Reload preserves money, owner, mission result, journal, and relationship state.

### Priya

1. Evidence, consent, and capacity resolve the authored concerns.
2. Confirmation creates one `agreed` commitment.
3. Conversation closes without marking it honoured.
4. The due resolver later chooses honoured, delayed, or reneged from world state.
5. Duplicate time, load, or resolution delivery creates no second result.

## 15. Final merge proof

Before moving local `main`:

1. Run the full phase 8 gate on the integration SHA.
2. Confirm the integration worktree is clean.
3. Confirm every phase branch is an ancestor of integration.
4. Confirm the root's unrelated files are still present and unchanged.
5. Fast-forward local `main` to the integration SHA.
6. Confirm `main` and the integration SHA match.
7. Delete only the merged local integration branch and its clean worktree.
8. Report the final SHA, each phase commit and merge SHA, tests actually run, skipped human gates, and every remaining unrelated root change.

Do not claim a push, remote merge, or player-test result unless it actually occurred.

## 16. Final audit hardening applied

Two read-only rounds ran with Claude Opus 5 and Claude Fable 5 at `xhigh` effort. Codex verified every cited claim against the repository before editing this plan.

The accepted changes were:

- commit staged turns before the goal-family closer and replay one settled state on later close;
- give journal entries typed quest or Verbal Mission subjects while preserving old quest event-ledger variants;
- add a non-terminal, first-write-wins player-knowledge command;
- route both available and active missions through the mission pipeline;
- read staged mission state from `ConversationTransaction.previewState`;
- skip ordinary per-turn relationship rewards and stage requests during missions;
- use the saved `linda_protect_failed` flag for the `injured_escape` branch;
- allow five total concerns while keeping at most four required;
- make `$80` a valid success only after its own credited offer route resolves every required concern;
- reopen payment and value when the player lowers a credited offer.

No further review round is permitted for this implementation. Later findings must come from real tests or play, not another speculative design pass.
