# Phase 22 Grok audit

## Scope

Grok 4.5 reviewed the integrated packaged proof at high reasoning effort. The review was read-only. It covered the responsive and high-DPI proof, package selection, save migration, presentation restart, model lifecycle, full Linda journey, CI jobs, evidence provenance, and the smoke-only active render driver.

## Initial findings and corrections

1. The maximum-load FPS proof counted idle `requestAnimationFrame` callbacks. Corrected: the qualification now drives real camera state updates and counts committed camera changes. The final packaged result is 120 FPS at 2560 x 1440, DPR 2, with all 3,571 visible draw items.
2. The new responsive, restart, and migration smokes were not in local `verify` or CI. Corrected: local verification and the Linux, Intel macOS, and Windows jobs run these smokes.
3. The evidence did not identify the exact measured source state. Corrected: reports include a source-file SHA-256 and a source commit.
4. The model and authored invitation sources were ambiguous. Corrected: the full journey records `firstFreeTextTurnSource: model` and `structuredInvitationSource: authored-structured`.

## Final audit findings

Grok confirmed that the four initial issues were corrected, then found two medium-severity residual issues:

1. Reports still named the Phase 21 commit because the Phase 22 source was uncommitted.
2. The active-pan `CustomEvent` listener was registered in normal production sessions.

## Final corrections

1. Phase 22 source was committed as `4209ce759d8837ea0a40cd03bc2ba85c369c078f`. All final reports were regenerated from that commit. Their `testedCommit` and `evidenceSource.baseCommit` values match it, and it contains every listed source file.
2. The main process now passes a smoke-only renderer argument. The sandboxed preload exposes an immutable boolean. `WorldInput` registers the active-pan proof listener only when this boolean is true. Normal sessions do not register the listener.

## Verification

- 39 test suites and 355 tests passed.
- The complete fallback packaged journey passed.
- The complete model-enabled Linda journey passed. The first free-text turn came from Qwen 3.5 4B.
- The model lifecycle passed load, health, response validation, restart, circuit fallback, rejection after stop, clean stop, and no leaked process checks.
- The maximum-load responsive qualification passed at 120 FPS.
- The five-size responsive matrix, presentation restart, and v5-to-v6 save migration passed.

