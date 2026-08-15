# Stage 6 stop condition: WebGL 2 is blocklisted on the Intel macOS runner

Date: 2026-08-16. Branch retained: `codex/threejs-stage-6-cutover`, NOT merged.
Integration stays at `1fa1162`, green.

Plan section 16 stops the stage when a required macOS or Windows package or
runtime smoke fails. Plan Stage 0 task 19 is explicit about this exact case:
"If a release runner cannot create WebGL 2, stop and select a WebGL2-capable
runner; do not add an unsafe runtime flag or weaken the production
hard-failure rule."

## Local state: complete and green

Three.js is the production renderer. The Skia selector survives only for
localhost development and packaged smoke, and a test proves no production query
value reaches it.

- 88 suites, 910 tests, typecheck, import boundaries;
- packaged parity smoke passes for BOTH renderer variants;
- all-map smoke passes;
- 25 of 25 parity fixtures pass with Three.js as production;
- packaged Electron smoke reports `rendererKind: threejs-2d`, `webgl2Ready: true`,
  and model-generation FPS `119.89` against a `60` threshold;
- responsive qualification, presentation restart, save migration and natural
  movement smokes all pass.

One Fable round returned three findings and all three were fixed: Three.js
evidence checks were guarded on the raw env value rather than the effective
renderer, so a smoke requesting none could label output `threejs-2d` while
skipping the context-lifecycle proof; `WorldScene` still defaulted to Skia so the
dev harness silently exercised the deprecated path; and the windowless selector
still returned Skia.

## The blocker

`package-macos-x64-functional`, which runs on `macos-15-intel`:

```
ContextResult::kTransientFailure: Failed to send GpuControl.CreateCommandBuffer.
ContextResult::kFatalFailure: WebGL2 blocklisted
SI_WORLD_SMOKE_FAILURE renderer readiness timeout
```

Chromium blocklists WebGL 2 on that runner's GPU. Before this stage that job ran
the Skia renderer, which needs no WebGL, so the constraint was invisible. Making
Three.js the production renderer exposes it.

`package-macos-arm64` also failed, on a different and probably unrelated point:
`Smoke screenshot capture failed after 5 attempts: Loading shell is no longer
visible`. That reads as a capture timing problem rather than a GPU one, and it
needs its own diagnosis.

`package-macos-x64` (packaging plus the WebGL 2 probe) passed.

## Why this is not just a CI configuration nuisance

The same Chromium blocklist can apply to a real Intel Mac. If a shipped Intel
build hits it, the game cannot render at all after Skia is removed in Stage 7,
because section 9.3 requires initialization to fail with a clear message rather
than fall back. The Skia path is the only thing currently covering that case, and
Stage 7 deletes it.

This is a product decision, not a threshold to adjust:

1. keep an Intel runner and accept that functional coverage there needs a
   WebGL2-capable GPU, which means choosing a different runner image;
2. decide that Intel macOS is qualified by packaging and the WebGL 2 probe only,
   and record that functional coverage runs on ARM64;
3. reconsider whether Intel macOS remains a release target.

Adding a software-rendering flag to make the job pass is explicitly forbidden by
Stage 0 task 19 and would hide the real user-facing risk.

## Next step

Resolve the runner question first, then rerun the exact Stage 6 SHA. Diagnose the
ARM64 capture failure separately; it is not the same fault.
