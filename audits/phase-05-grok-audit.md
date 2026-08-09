# Phase 5 Grok audit

- Date: 2026-08-10
- Model: Grok 4.5
- Effort: high
- Access: grok.com subscription, read-only wrapper
- Scope: uncommitted Phase 5 deterministic domain and content contracts against `spec.md` and the implementation plan
- Status: completed

## Confirmed and fixed

1. High: the content loader used flat `content/characters/*.json` files and did not require one rules file for each non-protagonist character. The loader now accepts only `content/characters/*/rules.json`, and the catalog requires full membership.
2. High: the strict NPC rule schema omitted authoritative compatibility, starting relationship, hard-boundary, stage-rule, and rejection data. These fields are now required structured data with ID, floor, and duplicate validation.
3. Medium: clock addition could exceed the JavaScript safe-integer range after its first input check. Both accumulated milliseconds and the next absolute minute now have explicit safe-integer guards.
4. Medium: saved state accepted any non-empty engine version. It now requires the literal current engine version.
5. Medium: Friend stage entry did not require authored compatibility. Stage permission now distinguishes social and romantic compatibility, and Friend requires social compatibility.

## Rejected or uncertain

None.

## Verification

Each finding was checked against the cited implementation and the locked spec before the fix. Regression tests cover missing rule membership, structured boundary references, weakened stage floors, both clock overflow paths, engine-version mismatch, and incompatible Friend entry.
