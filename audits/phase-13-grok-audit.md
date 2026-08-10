# Phase 13 Grok audit

Date: 2026-08-10

Model: Grok 4.5 subscription CLI

Mode: read-only, high effort, base `origin/main`

## Scope

The audit covered the Phase 13 production cast and content scale-up: eight full-AI adults, 26 deterministic ambient residents, authored character writing and hard boundaries, generated browser writing, Linda-only cat state, prompt budgets, dynamic world rendering, generated character art, atlas reachability, and northwest map population.

## Audit history

The first broad audit reached Grok's turn limit before it produced a verdict. It was replaced with bounded audits that named the changed runtime, content, generator, and test files.

The first bounded audit reported four actionable defects. All four were accepted.

1. Seven new full-AI NPCs exposed aggressive flirting without a hard boundary.
   - Fix: add `no_aggressive_flirting` to every production relationship and authored rule file.
2. The prompt always included Linda's cat-state instruction.
   - Fix: include it only when the active scene has Linda's four cat-state registry IDs.
3. Browser dialogue used generic knowledge instead of the authored character files.
   - Fix: generate browser writing directly from each character's personality, biography, knowledge, rules, greeting, and fallbacks.
4. Browser inference staged Linda's cat payload for every named NPC.
   - Fix: require `npcId === 'linda'` before parsing or staging any cat payload.

The next bounded audit confirmed those product fixes and found four missing regression-test groups. All four were accepted.

1. Add Linda's positive cat-prompt path and test every other named NPC's negative path.
2. Compare generated browser greetings and fallbacks with the authored files.
3. Test hard boundaries in runtime relationships for every full-AI NPC.
4. Test browser cat-state isolation for all seven non-Linda full-AI NPCs.

The first final audit omitted `initial-state.ts` from its bounded evidence. It incorrectly reported that the production cast factories were not wired into game bootstrap. Local inspection and the passing 293-test suite disproved that claim. A corrected audit included `initial-state.ts`. It also stated the locked Phase 13 schedule scope: NPC schedules stay in the fully populated northwest prototype map until cross-map NPC transfer work is implemented.

## Final verdict

`NO_CONFIRMED_FINDINGS`

Grok confirmed that `createInitialState()` merges the production NPCs, relationships, and schedules; the cast totals are 8 full-AI, 26 ambient, and 34 NPCs; Linda-only cat data is isolated; browser writing contains the authored fields; ambient dialogue makes no model or memory calls; prompt estimates are at most 4096 tokens; and atlas and map reachability have regression coverage.

## Post-smoke audit

The packaged release gate exposed and fixed two proof-contract issues after the content audit: NPC accessibility labels now keep authored title case while visible labels stay uppercase, and sequential quest-outcome and police screenshots must each repaint distinctly. Synthetic smoke clicks also use the same viewport origin as real pointer input. Camera pans and screenshots now wait for two renderer paint frames. Two consecutive packaged smoke runs passed, and the named UI screenshots were visually checked. The final bounded Grok audit of these changes returned `NO_CONFIRMED_FINDINGS`.
