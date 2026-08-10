# Phase 9 validated conversation verification

Status: Passed after the required Grok 4.5 audit and all accepted fixes.

## What works

- Linda loads authored personality, biography, validated rules, scene state, and only her permitted knowledge projection.
- A conservative `4,096`-token projection trims deterministically and excludes another named NPC's private memory.
- Each turn receives a closed fact, interest, memory, unlock, action, and source allowlist.
- The response is fully buffered, duplicate-key checked, parsed, Zod validated, source checked, boundary checked, policy checked, and only then revealed with type-on text.
- One correction attempt is allowed. A second failure produces authored no-change dialogue.
- Player text can create only a sourced held belief, a validated cat common interest, its unique unlock, and a bounded memory.
- Free text cannot grant an item, quest, exact marker, faction change, consent, or relationship stage.
- World truth remains separate from Linda's verified, contradicted, or unknown belief.
- A clean end commits one atomic domain event. Cancel, timeout, crash, renderer loss, and commit collision discard or preserve the last stable state.
- Conversation time pauses, world input locks, and manual saving occurs only after the stable commit.
- The generic resident uses authored short dialogue with zero model calls and zero persistent conversational memory.
- If the bundled model is absent or its circuit is open, exploration and authored dialogue remain usable.

## Acceptance evidence

| Gate | Evidence |
| --- | --- |
| AI-01 | Existing bundled loopback supervisor tests plus both real-model lifecycle runs pass two restarts, circuit open, and clean stop. |
| AI-02 | Both real-model runs keep one model loaded through two conversations; the service releases Linda's active context after each end. |
| AI-03–AI-06 | Authored files, closed schemas, Zod, exact sources, full buffering, one correction, and no-change fallback pass recorded and packaged tests. |
| AI-07 / AI-07A | Cat belief, unique common interest, duplicate prevention, schema-bypass rejection, denial rejection, and all high-impact blocks pass. |
| AI-08 | Real 4B and 9B recall Linda's private cat memory; the second-named-NPC fixture does not enter Linda's prompt. |
| AI-09 | A cat lie persists as `held_belief` plus `contradicted`; authoritative inventory truth does not change. |
| AI-10A | Staged state remains absent before end, commits once after end, survives JSON reload, and discards exactly on crash/cancel. |
| AI-11–AI-12 | Hard-boundary, unauthorized state, prohibited sexual categories, age-based minor language, allowed fictional adult crime, drugs, and vice all pass. |
| AI-13–AI-14 | Packaged clock and input lock pass; ambient dialogue makes no model call and stores no memory. |

Phase 10 owns relationship values, stage, and rejection persistence from the remaining part of AI-10.

## Automated verification

- `npm run verify`: passed.
- Content validation: 3 characters, 7 locations, 2 factions, 2 rule files, 4 maps, and 2 schedules.
- Pure import boundaries: valid.
- Jest: 24 suites, 196 tests passed.
- Electron unit boundary: 3 suites, 30 tests passed.
- Model unit lifecycle: 2 suites, 19 tests passed.
- Web export: passed.
- Electron package: passed.
- Packaged smoke: all prior world checks plus `conversationPause`, `conversationInputLocked`, `conversationBuffered`, `conversationFallback`, and `conversationCommitSave` are true.

## Real model verification

Both pinned external artifacts were hash-checked before use. No model or runtime binary entered Git.

| Model | Ready | Five hostile inference cases | Conversation result |
| --- | ---: | --- | --- |
| Qwen3.5-4B Q4_K_M | 852 ms | 755, 1064, 591, 650, 1246 ms | Two turns, private recall, lifecycle, and cleanup passed. |
| Qwen3.5-9B Q4_K_M | 849 ms | 1613, 1389, 833, 945, 1494 ms | Two turns, private recall, lifecycle, and cleanup passed. |

## Visual evidence

- `browser-conversation.png`: browser-authored cat conversation.
- `world-conversation.png`: packaged no-model fallback after full buffering.
- `packaged-loading.png` and `packaged-electron.png`: packaged startup and ready shell.
- `world-1x.png`, `world-2x.png`, `world-3x.png`, roof, downtown, ferry, and four-map-loop captures preserve Phase 8 world checks.
