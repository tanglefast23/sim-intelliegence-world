# Phase 9 Grok audit

Status: All five findings accepted, fixed, and verified.

Audit command:

```text
/Users/joemacprom5/.codex/skills/grok-audit/scripts/run_grok_audit.sh --base origin/main --effort high --scope "Phase 9 validated local conversation system only..."
```

The audit used the logged-in Grok CLI subscription with Grok 4.5. `XAI_API_KEY` was removed from the audit environment. Grok reviewed the diff and did not edit files.

## Findings and disposition

1. **Accepted — per-turn allowlist was not rechecked after Zod parsing.**
   - Added one shared `TurnCandidateRegistry` used by both constrained JSON Schema construction and deterministic validation.
   - Added a recorded-adapter schema-bypass fixture that attempts to persist `island_gossip` and `linda_boyfriend` from an ordinary greeting. The whole response now falls back with no persistent change.

2. **Accepted — cat denials and questions could satisfy the original broad detector.**
   - Replaced the broad word-pair test with a positive first-person ownership recognizer.
   - Both the complete player message and exact evidence substring must pass.
   - Added denial and question cases for `do not`, `don't`, `never`, `no`, and question syntax.

3. **Accepted — normalized or truncated conversation IDs could silently collide.**
   - Conversation IDs now use collision-free UTF-8 hexadecimal encoding in command, event, and pause identifiers.
   - Commit event IDs also include the base revision.
   - A duplicate reducer result now throws without closing the transaction, so the caller can discard safely instead of reporting a false commit.

4. **Accepted — conversation modal input could reach the world surface.**
   - Conversation UI now uses the locked `world-ui-` prefix.
   - World primary, pan, zoom, center, and cancel callbacks also no-op while a conversation is active.
   - The packaged smoke dispatches left-click, middle-pan, and wheel input at the modal and proves that camera and location do not change.

5. **Accepted — deterministic minor detection missed numeric and written ages.**
   - Added numeric and written zero-through-seventeen `year old` patterns.
   - Added `sexualized` and `sexually` word forms.
   - Tests prove that `12-year-old` and `sixteen year old` refuse while `18-year-old` does not trigger the minor rule.

## Post-fix proof

- `npm run verify`: passed.
- Jest: 24 suites, 196 tests passed.
- Packaged Electron: conversation pause, modal input lock, full buffering, authored no-model fallback, clean end, and save generation 6 passed.
- Pinned Qwen3.5-4B and Qwen3.5-9B: five hostile corpus cases, two persistent Linda conversations, cat-memory recall, two crash restarts, circuit breaker, and clean shutdown passed after the fixes.
