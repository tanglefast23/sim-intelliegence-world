# Phase 11 Grok audit

Status: Four completed read-only Grok 4.5 rounds and one failed file-reader attempt. Seven confirmed Grok findings were accepted, fixed, and verified. One claimed finding was rejected because its cited file exists. A later Opus 5 autosave finding was fixed and received a final Grok recheck. The last round returned `NO_CONFIRMED_FINDINGS`.

All completed rounds used the logged-in Grok CLI subscription at high reasoning effort with `XAI_API_KEY` removed from the environment. Grok did not edit files.

## Round 1 accepted findings and disposition

1. **The normal protect path could not reach the documented `injured_escape` defeat.**
   - The first-aid kit is now a real inventory item granted when Linda starts the quest.
   - Readiness requires Health, Confidence, the kit, and the optional security report.
   - Default quest readiness is 3/4 and predicts `injured_escape`; the report raises it to 4/4 and predicts success.

2. **The authored world did not produce a witnessed crime and police route.**
   - The generic resident's daytime work schedule now reaches an authored witness tile near Linda's villa.
   - Evidence derives nearby active witnesses and excludes Linda and her boyfriend.
   - A witnessed protect outcome advances police attention to `noticed`.

3. **The context menu hid readiness, witnesses, and the predicted branch.**
   - The menu now shows every readiness factor, the total score, witness count, predicted success or defeat, Health and time loss, rewards, relationship deltas, evidence, and police attention.

4. **Police escalation existed only as domain commands.**
   - The journal now exposes deterministic actions for officer contact, ignored summons, and a wanted encounter.
   - The actions advance `noticed` to `questioned`, `wanted`, and `arrest-on-sight`, and each action autosaves.

5. **The security report was a money sink with no branch effect.**
   - Its quest flag is now one of the four readiness factors.
   - Tests and packaged smoke prove that it changes the reachable protect result from `injured_escape` to success.

## Round 2 findings and disposition

1. **Protect predictions omitted the Velvet Tide standing and reveal consequence.** Accepted.
   - A successful protect preview now shows `VELVET TIDE -10 · REVEALED`.
   - A regression test verifies the player-visible text.

2. **The domain could start the quest without proving an interaction with Linda.** Accepted.
   - `start-linda-quest` now requires `requestNpcId`.
   - The domain requires Linda as the request NPC and requires the protagonist to be within three tiles of her active local position.
   - The UI disables the action with a clear distance reason, and tests reject a distant player and the wrong NPC.

3. **`src/domain/quests/linda-boyfriend.json` was missing.** Rejected.
   - The file exists and is the domain-safe runtime copy imported by `quest-machine.ts`.
   - Content validation compares it with `content/quests/linda-boyfriend.json` and rejects drift.

## Failed audit attempt

One repository-exploration run failed before a verdict because Grok's `Read` tool returned repeated `tool_output_error` results. It was stopped and rerun with bounded complete file contents. No result from the failed run was treated as an audit verdict.

## Post-Opus autosave recheck

The broad Opus 5 audit found that a terminal quest outcome still used the `manual` save trigger. This bypassed the rotating `major_quest` autosave required by `WORLD-11`.

- The fix routes only `linda-quest-resolved` through `major_quest` after the atomic transaction.
- Start, discovery, purchase, conversation, and police saves remain manual.
- Packaged smoke now parses and checksum-validates the rotating autosave and requires the resolved Linda quest inside a `major_quest` envelope.
- Grok reviewed this change and returned `NO_CONFIRMED_FINDINGS`.

## Final audit result

Grok returned:

```json
{
  "verdict": "NO_CONFIRMED_FINDINGS",
  "summary": "Phase 11 recheck of the two second-pass defects, terminal idempotence, and UI/smoke exercise of the start gate found no remaining confirmed high-impact defects.",
  "findings": []
}
```

It explicitly rechecked the Linda-only proximity gate, Velvet Tide consequence disclosure, terminal idempotence, UI command wiring, tests, and the packaged happy path.

## Post-fix proof

- TypeScript: passed.
- Jest: 26 suites and 264 tests passed.
- Content validation: passed for characters, locations, factions, rules, maps, schedules, gates, purchases, and the Linda quest.
- macOS Electron packaging: passed.
- Packaged Electron smoke: passed every world, save, conversation, quest, preview, autosave, evidence, and police-hook check.
