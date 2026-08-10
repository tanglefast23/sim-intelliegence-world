# Phase 21 Grok audit

Date: 2026-08-11

## Scope and method

Grok 4.5 reviewed the bounded Phase 21 responsive viewport implementation at `high` effort. The evidence included the measured world surface, camera, responsive layout and evidence DTO, world input, UI panels, presentation preferences, Electron IPC, tests, and packaged smoke harness. Unrelated generated files, user-owned images, `output/`, credentials, and dependency trees were not sent.

The accepted contract required a near-full-window measured surface, correct camera and input after resize, preserved center and explicit zoom, separate validated UI scale, readable scrollable panels, preserved conversation state, main-owned preference persistence, and bounded packaged evidence.

## Initial verdict

Verdict: `FINDINGS`.

1. **Async travel could reapply a stale pre-resize surface — confirmed and fixed.** `WorldScene` now keeps the current surface in a ref and uses that ref when travel completes.
2. **Journal and relationship bodies were not bounded flex children — confirmed and fixed.** Both body `ScrollView` components now use `flex: 1` and `minHeight: 0` inside their fixed responsive panels.
3. **The decorative frame border consumed the measured world surface — confirmed and fixed.** `SkiaProof` now owns the border outside the measured inner game surface. Camera, render, input, culling, evidence, and smoke geometry receive only that inner size.
4. **Resize camera correction ran after paint — confirmed and fixed.** The center-preserving camera correction now runs in `useLayoutEffect`.

## Correction audit

Verdict: `NO_CONFIRMED_FINDINGS`.

Grok verified all four corrected paths: latest-surface travel completion, before-paint resize correction, bounded panel scrolling, and one shared inner-surface geometry source used by pure tests and packaged smoke.

## Final local gates

- Renderer and Electron TypeScript builds: passed.
- Focused post-audit gate: 54 tests passed.
- Full test suite before the audit: 38 suites and 353 tests passed.
- `npm run verify:ci-build`: passed.
- macOS arm64 package: passed.
- Packaged world smoke: passed every gameplay and responsive check.
- Packaged resize proof preserved camera center and an explicit `2x` zoom.
- Conversation draft, transcript measurement, panel, and pause state survived resize plus UI-scale change.
- Measured renderer rate after corrections: 119.96 FPS against the required 60 FPS threshold.

## Windows CI evidence follow-up

The first Windows x64 CI journey reached `complete`, then failed because its early loading PNG and final post-resize PNG had different decoded dimensions. The final comparison now allows different dimensions after the responsive resize journey while still requiring two valid, minimum-size, non-identical PNG files.

A final bounded Grok 4.5 `high`-effort audit reviewed only this exception and returned `NO_CONFIRMED_FINDINGS`.

The next Windows run proved that its loading shell can decode at `1008x681` before the requested `1280x720` game content size settles. The loading-versus-new-game comparison now permits this platform transition. It still requires valid, decodable, minimum-size, non-identical PNG files. New-game-versus-world-1x, the 1x/2x/3x set, and all later journey pairs retain strict equal dimensions.

A second bounded Grok 4.5 `high`-effort audit reviewed this exact additional exception and returned `NO_CONFIRMED_FINDINGS`. Grok confirmed that the stable post-content-size evidence remains strict.

The same Windows run then identified the remaining intentional resize boundary: `world-1x.png` is captured before the responsive resize journey, while `world-roof-restored.png` is captured after the harness settles at `1280x720`. Their transition comparison now permits different dimensions. The complete 1x/2x/3x pre-resize group and every post-resize journey pair remain strict.

The final bounded Grok 4.5 `high`-effort size-epoch audit returned `NO_CONFIRMED_FINDINGS`. It confirmed the three cross-epoch exceptions, the strict checks within each size epoch, and the unconditional PNG decode, minimum-size, and non-identity requirements.
