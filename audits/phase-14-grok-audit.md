# Phase 14 Grok audit

Date: 2026-08-10

Model: Grok 4.5 subscription CLI

Mode: read-only, high effort, base `origin/main`

## Scope

The audit covered the Phase 14 model qualification runner, candidate corpus, report provenance, Electron security, save recovery, package signing and smoke evidence, platform CI, model and runtime pins, release documentation, and the requirement to avoid unsupported ship claims.

## First audit findings

Grok reported five high-impact evidence defects. All five were accepted.

1. The capability grammar forced the expected result and made 100 of 100 possible without model judgment.
   - Fix: use one open qualification schema. Score the returned decision, scope, source, action, and consent values after generation.
2. The persistent-state gate was hard-coded true.
   - Fix: inspect every structured result and fail if the model proposes a forbidden persistent action.
3. Some model, package, and CI evidence did not prove the exact tested commit.
   - Fix: resolve and validate one tested commit in every qualification, save, signing, smoke, and CI entry point.
4. Performance and capability prompts overlapped and shared one model process.
   - Fix: use 10 distinct performance prompts across 100 warm requests, 100 distinct capability prompts across nine categories, and a fresh model process for capability.
5. macOS x64 and Windows x64 smoke evidence could overwrite another run.
   - Fix: use platform-specific `current` evidence directories and prove the checked-out SHA in each job.

## Honest measured result

The final standalone run tested commit `19f4488fcf789baf6f690086d3be44dbf145c4c0`.

- Qwen3.5-4B: 100 of 100 ordinary responses valid, 98 of 100 capability fixtures first pass, all standalone development gates pass.
- Qwen3.5-9B: 100 of 100 ordinary responses valid, 88 of 100 capability fixtures first pass, capability gate fails.
- Both reports keep baseline hardware and renderer integration false.
- Neither model is ship-qualified.

The required exact 16 GB macOS and Windows machines are unavailable. Hosted CI runners and an Apple-silicon Rosetta run do not substitute for those machines. The Intel-support warning shown by macOS applies to the translated x64 test build, not the native ARM64 macOS build.

## Final disposition

The Phase 14 implementation closes the audit defects and produces reproducible development evidence. Phase 14 remains a failed ship gate because `SHIP-01` through `SHIP-04` are blocked. No threshold was weakened and no ship claim is made.

## Integrated package proof

The final native macOS ARM64 package tested commit `4e5017a53e555e8972c9ab4cbaae9600ed908209` with the bundled 4B model. It passed ad-hoc signature verification, model lifecycle and forced-parent-death checks, and the complete playable smoke route. The measured response feedback was 5.6 ms and the measured renderer rate during generation was 119.39 FPS.

The package proof found and fixed two test-harness defects before the passing run. Packaged model smokes now accept an explicit output root, and renderer paint and generation waits have wall-clock bounds. Smoke mode disables Electron background throttling so an occluded test window cannot stop its only proof clock. These settings do not change normal player runtime behavior.

## Final re-audit

Grok confirmed the recorded 4B and 9B scores, the open capability scoring, tested-commit binding, smoke target selection, bounded waits, cross-platform CI design, and the absence of a ship claim. It found two residual evidence errors. Both were accepted.

1. `safeFallbacks` was derived from a flag set automatically on every invalid sample.
   - Fix: remove that per-sample flag. Run two deliberately rejected model responses through the real supervisor and require the resulting authored fallback to preserve consent and propose no persistent action.
2. The qualification status called every 9B miss a no-change path.
   - Fix: record that `halcyra_001` proposed the allowed `request_authored_action` bridge. The other misses proposed no persistent action, and none proposed an unauthorized state change.
