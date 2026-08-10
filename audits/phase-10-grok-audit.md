# Phase 10 Grok audit

Status: Four read-only Grok 4.5 rounds completed. All eight confirmed findings were accepted, fixed, and verified. The final round returned `NO_CONFIRMED_FINDINGS`.

All rounds used the logged-in Grok CLI subscription at high reasoning effort with `XAI_API_KEY` removed from the environment. Grok reviewed the full uncommitted diff from `origin/main` and did not edit files.

## Accepted findings and disposition

1. **Invitation milestones ran after routine schedule milestones at the same minute.**
   - Transfer arrival uses priority 35, invitation departure/start uses 36, and routine schedules use 40.
   - An accepted invitation owns the NPC through its reserved travel and visit window.
   - Tests cover exact same-minute departure and routine-schedule collisions.

2. **A structured social ask could earn its normal conversation point before its threshold check.**
   - Structured actions now evaluate against the pre-mutual transaction preview.
   - The normal mutual delta is staged after the decision and cannot auto-advance a relationship stage in the same structured turn.

3. **Broad external-place matching misrouted local phrases such as `in the evening` and `near the spa`.**
   - The router now distinguishes external place qualifiers from authored Halcyra locations, local time phrases, and local activities.
   - Tests cover local time/place phrases, title-case and lowercase external places, and authored neighborhood names.

4. **Prompt-idea pills used the state from conversation open.**
   - Every turn result now includes prompt suggestions computed from the staged transaction preview.
   - The conversation UI refreshes pills from that result, so newly viable branches appear and successful branches disappear.

5. **Invitation departure could create a second transfer while visible routine travel was approaching its exit.**
   - Invitation travel now supersedes the earlier `approaching_exit` transfer before creating its own transfer.
   - A live-frame regression test proves one transfer per NPC and invitation-owned travel goals.

6. **Lowercase external places such as `paris` and `tokyo` were routed to Halcyra.**
   - External qualifiers are case-insensitive.
   - Authored local and non-place qualifier tokens remain excluded from external routing.

7. **Routine transit could start shortly before an accepted invitation and still be active at invitation departure.**
   - Invitation ownership now begins early enough to block only routine trips whose arrival would be after the reserved departure.
   - A routine trip that arrives exactly at departure is still allowed and resolves first.

8. **Authored island district tokens could still look like external places.**
   - Residential, directional neighborhood names, nightlife, entertainment, relaxation, district, neighborhood, and other authored island place tokens now remain local.

## Final audit result

Grok round 4 returned:

```json
{"verdict":"NO_CONFIRMED_FINDINGS","summary":"No confirmed findings.","findings":[]}
```

It explicitly rechecked invitation ownership and priorities, structured-action ordering, preview-based prompt pills, Halcyra/external routing, and bounded distinct screenshot capture.

## Post-fix proof

- `npm run verify`: passed.
- Jest: 25 suites and 251 tests passed.
- Content validation, generated art checks, pure import boundaries, TypeScript, web export, Electron unit tests, model lifecycle tests, and macOS Electron packaging passed.
- Packaged Electron smoke passed every required input, time, travel, conversation, relationship, faction, journal, purchase, save, security, and visual-transition check.
- Real bundled Qwen3.5-9B checks answered stable real-world and Halcyra questions in context, admitted specialist uncertainty, and did not invent Halcyra-relative geography.
