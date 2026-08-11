# Phase 32 final art qualification audit brief

## Target

- Branch: `codex/phase-32-final-art-qualification`
- Base: `origin/main` at `6d0db8763ae8e4158a893000d81b75582d1a6f79`
- Tested source commit: `6e16934b3b11b2819ecda58a039bfdb471f0e8cc`
- Product targets: macOS and Windows. Linux is not a product target.
- Scope: the seven-file Phase 32 source diff and the final qualification manifest.
- Effort: high

## Required verdict

Find only concrete correctness, regression, determinism, evidence-provenance, package-coverage, CI-support, or acceptance-gate defects. Do not request subjective restyling or new content.

## Intended implementation

1. Define an exact 91-case final art matrix for all required window sizes, DPRs, zooms, maps, character states, directions, building states, lifecycle states, loads, portraits, tall props, multi-tile groups, and color-vision views.
2. Reject missing, duplicate, unexpected, stale, or path-escaping evidence entries with a strict Zod manifest validator.
3. Bind all package evidence to the tested source commit and package payload SHA-256.
4. Build the art atlas and presentation recipes twice and require identical hashes.
5. Generate protanopia, deuteranopia, and tritanopia review images from the fixed-camera full-color frame.
6. Run the Tier-B packaged art subset in the supported macOS Intel and Windows x64 CI jobs without making model qualification claims.

## Local verification completed

- `npm run verify`: passed from the exact source commit.
- Full source suite: 65 suites and 512 tests passed.
- Content generation and validation, deterministic art, audio, proof assets, first-hour golden, import boundaries, typecheck, web export, Electron security and IPC, model lifecycle, package build, world journey, natural movement, responsive, restart, and save migration all passed.
- Final manifest: `passed: true`, Art Revision 5, exact 91 required cases, and exact tested commit.
- Deterministic build: the atlas, index, atlas report, and generated presentation recipes had identical SHA-256 hashes across two builds.
- Source authority: `presentationOnlyChange: true` and `contentAuthorityBaselineMatch: true`.
- Package smoke: all four maps, all three zooms, roofs, interactions, conversation fallback, quest flow, travel, and save reload passed.
- Final world journey: 119.89 FPS against a required 60 FPS.
- Same-package maximum-load comparison: legacy and enhanced both rounded to 120 FPS with the same 8.3 ms median. Enhanced used one extra static batch against an allowed maximum of one. Acceptance passed.
- Native visual inspection: full-cast identity, fixed-camera 1x, maximum load, and color-vision images have no confirmed seam, blur, clipped UI, unreadable text, or identity defect.

## Audit questions

1. Can the final manifest claim coverage without real, hashed evidence for every required case?
2. Can path resolution escape the qualification root, accept stale hashes, duplicate cases, or omit a required matrix value?
3. Can deterministic build comparison report success when generated art or presentation recipes differ?
4. Can evidence from a different commit or package payload be accepted?
5. Do the Mac Intel and Windows x64 jobs actually enable the Tier-B package subset while preserving the no-model-qualification boundary?
6. Do tests assert the required contract, or only repeat implementation constants?

## Initial Grok findings and corrections

The first high-effort audit returned five findings. Local reconciliation rejected the broad performance claim because `validateArtQualityEvidence` already parses the same-package comparison, requires `performanceAcceptance.passed: true`, limits the enhanced median ratio to 1.1, limits added static batches to one, requires both modes at 60 FPS, and binds its subordinate reports to the tested commit and package.

Four areas were hardened:

1. Evidence paths now reject POSIX absolute, Windows drive or UNC, backslash, and traversal forms, then perform a normalized post-resolution containment check.
2. The final validator re-hashes the four current generated art/presentation artifacts and the packaged `app.asar`, and requires the package executable to exist.
3. High-DPI responsive, presentation restart, save migration, and native review reports now use strict acceptance schemas. The three packaged reports must match the tested commit and the exact package provenance. The review manifest must match the current atlas hash.
4. The deterministic atlas build now invokes npm through `process.execPath` and `npm_execpath`, including on Windows. A unit test covers the Windows command shape.

The corrected source passed typecheck, 65 suites, and 514 tests. All package evidence was regenerated from corrected commit `6e16934b3b11b2819ecda58a039bfdb471f0e8cc`.

Return confirmed findings only. If no concrete problem is established, return `NO_CONFIRMED_FINDINGS`.
