# Phase 19 Grok audit

- Auditor: Grok 4.5 through the read-only `grok-audit` wrapper
- Effort: `high`
- Status: completed
- Scope: Phase 19 functional atlas sources, generator, runtime index, preview builder, tests, and gate contract

## Reconciled findings

### G19-01 — Generated atlas artifacts were allegedly absent

- Grok severity: critical
- Disposition: rejected
- Local evidence: `git status --short` and `git diff --cached --name-status` both showed `assets/generated/atlas-index.json`, `assets/generated/world-atlas.png`, and `artifacts/phase-19/atlas-preview.png` in the staged change. The generated manifest reported version 2, 187 sprites, 10 ground cells, and 87 transparent part cells. Focused runtime tests and the web export loaded that manifest successfully.
- Cause of disagreement: the named-file evidence pack excluded generated binaries and did not give Grok authoritative staged-index evidence for those paths.
- Change: none.

### G19-02 — The visual artifact gate did not fail closed for an untracked preview

- Grok severity: high
- Disposition: confirmed
- Local evidence: `git diff --exit-code -- artifacts/phase-19/atlas-preview.png` ignores a new untracked file. A future PR could therefore omit the preview while its local generation command still passed.
- Fix: added `scripts/art/check-generated-art.ts`. The cross-platform check requires every generated atlas/review artifact to exist and be present in the Git index before it checks deterministic worktree differences. `npm run art:check` now uses this checker.

## Verification

- `npm run art:atlas`
- `npm run art:check`
- `npm run typecheck`
- `npm test -- --runInBand scripts/art/__tests__/atlas-generation.test.ts src/render/__tests__/atlas-bill.test.ts`
- `npm run export:web`
- visual inspection of `artifacts/phase-19/atlas-preview.png` at original resolution
- no diff under `content/maps` or `src/domain/state`

## Final verdict

One confirmed gate defect was fixed. The generated-art absence claim was contradicted by the staged index and successful runtime evidence.

## Correction audit

- Auditor: Grok 4.5
- Effort: `high`
- Status: completed
- Result: `NO_CONFIRMED_FINDINGS`
- Coverage: the `package.json` gate wiring, cross-platform generated-art checker, and both recorded dispositions

## Windows package-smoke correction

The first PR run passed Verify and macOS Intel, but Windows x64 failed while Electron tried to capture the loading shell. Packaging and signing had already passed. The first screenshot request failed with Electron `UnknownVizError` before the renderer-ready checkpoint.

### G19-03 — A delayed retry could accept the game frame as loading evidence

- Grok severity: high
- Disposition: confirmed
- Fix: the loading capture now requires the `#loading-shell` marker immediately before and after a non-empty screenshot. A late game frame is rejected.

### G19-04 — Empty Electron images were not rejected or tested

- Grok severity: medium
- Disposition: confirmed
- Fix: all smoke screenshot captures reject `NativeImage.isEmpty()`. Tests cover recovery from transient empty frames and bounded failure for permanent empty frames.

### G19-05 — Retries could exceed the distinct-frame deadline

- Grok severity: medium
- Disposition: confirmed
- Fix: the caller passes one absolute deadline through renderer-paint waiting and every capture retry. No new attempt starts at or after that deadline.

### G19-06 — The package listing did not require the retry helper

- Grok severity: medium
- Disposition: confirmed
- Fix: package validation now requires `/build/electron/main/smoke-capture.js`.

### Correction verification

- `npm run typecheck`
- `npm run build:electron`
- `npm test -- --runInBand tests/electron/package-smoke.test.ts src/application/__tests__/shell-state.test.ts`
- `npm run art:check`

### G19-07 — The post-capture loading-shell guard lacked direct regression coverage

- Grok severity: medium
- Disposition: confirmed
- Fix: added a test where capture returns a non-empty frame but the shell disappears during capture. The helper must reject that frame with the post-capture marker error. A stable-shell success path is also covered.

### G19-08 — Helper omission was not a negative package-listing test

- Grok severity: medium
- Disposition: confirmed
- Fix: added a test that removes only `/build/electron/main/smoke-capture.js` and requires package validation to fail.

## Windows correction re-audit

- Auditor: Grok 4.5
- Effort: `high`
- Status: completed
- Result: `NO_CONFIRMED_FINDINGS`
- Coverage: G19-03 through G19-08 production paths, loading-shell race guards, empty-frame rejection, deadline bounds, packaged helper enforcement, and direct regression tests
