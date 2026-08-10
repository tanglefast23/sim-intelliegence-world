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

The final standalone run tested commit `e736be86a9f4dc9b576b7e91ad701d87b5d7b142`.

- Qwen3.5-4B: 100 of 100 ordinary responses valid, 98 of 100 capability fixtures first pass, all standalone development gates pass.
- Qwen3.5-9B: 100 of 100 ordinary responses valid, 88 of 100 capability fixtures first pass, capability gate fails.
- Both reports keep baseline hardware and renderer integration false.
- Neither model is ship-qualified.

The required exact 16 GB macOS and Windows machines are unavailable. Hosted CI runners and an Apple-silicon Rosetta run do not substitute for those machines. The Intel-support warning shown by macOS applies to the translated x64 test build, not the native ARM64 macOS build.

## Final disposition

The Phase 14 implementation closes the audit defects and produces reproducible development evidence. Phase 14 remains a failed ship gate because `SHIP-01` through `SHIP-04` are blocked. No threshold was weakened and no ship claim is made.

## Integrated package proof

The final native macOS ARM64 package tested commit `cc1c6368be945bc5a7e76349c47f718a256b848c` with the bundled 4B model. It passed ad-hoc signature verification, model lifecycle and forced-parent-death checks, and the complete playable smoke route. The measured response feedback was 4.4 ms and the measured renderer rate during generation was 118.97 FPS.

The package proof found and fixed two test-harness defects before the passing run. Packaged model smokes now accept an explicit output root, and renderer paint and generation waits have wall-clock bounds. Smoke mode disables Electron background throttling so an occluded test window cannot stop its only proof clock. These settings do not change normal player runtime behavior.

## Final re-audit

Grok confirmed the recorded 4B and 9B scores, the open capability scoring, tested-commit binding, smoke target selection, bounded waits, cross-platform CI design, and the absence of a ship claim. It found two residual evidence errors. Both were accepted.

1. `safeFallbacks` was derived from a flag set automatically on every invalid sample.
   - Fix: remove that per-sample flag. Run two deliberately rejected model responses through the real supervisor and require the resulting authored fallback to preserve consent and propose no persistent action.
2. The qualification status called every 9B miss a no-change path.
   - Fix: record that `halcyra_001` proposed the allowed `request_authored_action` bridge. The other misses proposed no persistent action, and none proposed an unauthorized state change.

The post-fix Grok 4.5 re-audit returned `NO_CONFIRMED_FINDINGS`. It confirmed the real two-attempt fallback probe, the 98% and 88% capability scores, the corrected `halcyra_001` description, false ship eligibility, and the declared exact-baseline blocker.

## PR CI repair audit

The first PR run passed the complete Linux verification job. The Intel macOS shell completed the full game route, but the hosted display measured 19.99 FPS and failed the qualification-only 60 FPS gate. The Windows shell packaged successfully, but its test signer could not find the installed Windows SDK SignTool because GitHub did not put it on `PATH`.

The repair adds an explicit `platform-shell` profile for hosted Linux, Intel macOS, and Windows route checks. It still requires a positive finite FPS measurement and records the result. It does not apply the baseline 60 FPS threshold. The default and integrated `qualification` profile still requires 60 FPS, and a platform-shell run cannot write a qualification report. The Windows signer now resolves the x64 SignTool from the installed SDK, temporarily trusts only the public test certificate, verifies the signed executable, and removes both certificate-store entries and the temporary public certificate in `finally`.

Grok 4.5 reviewed the seven changed CI, smoke, signing, test, and status files at high effort. It returned `NO_CONFIRMED_FINDINGS`. GitHub CI then disproved part of that verdict: `TrustedPeople` did not establish a trusted root for `signtool verify /pa`. The second repair imports only the public test certificate into the current user's `Root` store, verifies the artifact, and removes it in `finally`. The repository does not contain or export the temporary private key.

The focused second Grok 4.5 audit returned `NO_CONFIRMED_FINDINGS`. It confirmed the current-user root trust, same-user `/pa` verification, cleanup of the `Root` and `My` entries and temporary CER, and the corrected audit history. GitHub CI remains the required proof that this Windows-host behavior works.

The next Windows run reached the current-user root import but did not leave that step. The repair therefore replaces the PowerShell certificate import with `certutil -user -silent -f -addstore Root`, the documented command-line store operation with explicit silent and force options. SignTool verification and `finally` cleanup remain required. This result again shows that a clean document audit does not replace execution on the target host.

The focused third Grok 4.5 audit returned `NO_CONFIRMED_FINDINGS`. It confirmed the `certutil` option set, current-user scope, exit-code check, Authenticode verification, cleanup, and the recorded history of both prior Windows execution failures.

Target CI disproved the third audit verdict: Windows Server 2025 reported `Unexpected "-Silent" option` and printed `-addstore` help that lists `-user` and `-f`, but not `-silent`. The bounded redesign uses only the options accepted by that target, checks that the exact thumbprint exists in `CurrentUser\Root`, applies a two-minute step timeout, and fails if final cleanup leaves that root certificate behind. This is the final signer approach; another target failure requires a different verification design.

The Grok 4.5 audit of the bounded redesign returned `NO_CONFIRMED_FINDINGS`. It checked the target-supported option set, root-thumbprint proof, Authenticode verification, residual cleanup check, workflow timeout, and corrected audit history. Target CI remains the deciding evidence.

Target CI showed that `certutil -user -f -addstore Root` also blocks after it prints that the signature matches the public key. The two-minute timeout stopped the step. The trust-store approach is rejected.

The replacement does not alter a trust store. SignTool must create the embedded signature. `Get-AuthenticodeSignature` must report the exact generated signer and an intact status of `Valid` or `NotTrusted`; Microsoft defines `NotTrusted` as an untrusted publisher, separate from content failure. A one-byte-changed temporary copy must report `HashMismatch`. The report records `releaseTrusted: false`, the actual signature status, separate SHA-1 certificate thumbprint and SHA-256 certificate fingerprint fields, and the executable SHA-256. The temporary certificate and changed copy are removed in `finally`.

Grok 4.5 reviewed the no-trust-store replacement at high effort and returned `NO_CONFIRMED_FINDINGS`. It covered the PowerShell 5.1 status comparisons, exact signer match, Authenticode coverage of the changed byte, hash-field accuracy, cleanup, and honest audit history. Target Windows execution remains the deciding evidence.
