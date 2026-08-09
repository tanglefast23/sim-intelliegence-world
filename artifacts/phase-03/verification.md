# Phase 3 local-model verification

Status: Passed on the named development hardware. This is risk-spike evidence, not the Phase 14 ship-model qualification.

## Hardware and tools

- MacBook Pro `Mac17,7`
- Apple M5 Max, 18 cores
- 128 GB unified memory
- macOS 26.5.2, arm64
- Node.js 22.23.1, npm 10.9.8
- CMake 4.4.2
- Apple clang 21.0.0

## Pinned artifacts

The source models, generated GGUF files, binaries, bundles, logs, and temporary keys stayed outside Git under the local application-support model workspace. The tracked evidence manifest is `artifacts/phase-03/model-manifest.darwin-arm64.json`; its SHA-256 is `1aaef2a347b1389604f715db2cb82ab8c858fbc7f87c3c9bdca5d862b6ad675a`.

| Artifact | Revision or SHA-256 | Size |
| --- | --- | ---: |
| llama.cpp | `74ce15741b420b8d6f12e720398458b576c51c2c` | build 10335 |
| darwin-arm64 llama-server | `30cf458e1627892f30e874fbe1ecb66412db1fbea0fb4054857245234c379076` | 13,376,240 bytes |
| darwin-arm64 parent guard | `014d571fc3a8e2cf7a638793ed49b65e8b46f3657bde9ad53a6ebde8700bb688` | 34,048 bytes |
| Qwen3.5-9B source | `c202236235762e1c871ad0ccb60c8ee5ba337b9a` | source revision |
| Qwen3.5-9B Q4_K_M | `8a9256b233037ea081c2e606e49dba0851cd42e441800da8ee04597ae9798341` | 5,780,090,624 bytes |
| Qwen3.5-4B source | `851bf6e806efd8d0a36b00ddf55e13ccb7b8cd0a` | source revision |
| Qwen3.5-4B Q4_K_M | `32c8ff2d0972cc26d4c1f99d6655c7e0d4814bae9c23093a9213e23fd36e3d14` | 2,783,446,752 bytes |

Both Qwen source repositories supplied the recorded Apache-2.0 license file. The bundle also contains llama.cpp's recorded MIT license file. The manifest records both license hashes and sizes.

The llama.cpp build used static libraries, Metal, no native-machine tuning, no curl, no OpenSSL, no embedded or downloaded UI, and no example or test binaries. `otool -L` showed only Apple system libraries and frameworks.

## Real model results

Both candidates used the same five-case corpus: valid, invalid-shaped, duplicate-key-shaped, truncated-shaped, and hostile prompt-injection-shaped user input. Every returned content value passed the closed JSON Schema during generation and passed local duplicate-key, JSON, and Zod validation afterward.

| Candidate | Ready | Five inference times | Crash behavior |
| --- | ---: | --- | --- |
| Qwen3.5-4B Q4_K_M | 849 ms | 755, 1,053, 584, 664, 1,238 ms | two real restarts, then circuit open |
| Qwen3.5-9B Q4_K_M | 853 ms | 1,604, 1,377, 826, 940, 1,522 ms | two real restarts, then circuit open |

The runtime observed HTTP 503 while loading and HTTP 200 when ready. Each run used loopback, one random high port, one private 256-bit per-run key file, `8192` context, parallel `1`, offline mode, no UI, reasoning off, and no multimodal projector. Three crash injections left no known server or parent-guard process.

These timings are early evidence from a 128 GB M5 Max. They do not select the primary or fallback model and do not prove the named 16 GB macOS or Windows baselines.

## Packaged Electron evidence

- The 4B test bundle was copied through Forge `extraResource`, outside ASAR.
- The packaged application rechecked the server, model, parent-guard, and license hashes before use.
- The packaged application observed loading and ready, returned one constrained response, passed local validation, restarted twice after real crash signals, opened its circuit after the third crash, used the authored fallback, rejected a restart after `stop()`, and emitted `stoppedCleanly: true`.
- The packaged test application was 2.9 GB and contained the exact 2,783,446,752-byte 4B artifact.
- A forced SIGKILL of Electron initially reproduced one orphaned llama-server. The native parent guard fixed it. The final forced-parent-death smoke left no server or guard process.
- A normal launch after forced death removed only stale `llama-run-*` key directories. It preserved unrelated data and ended with an empty runtime temporary directory.

## Automated checks

- `npm run test:model -- --detectOpenHandles`: 2 suites, 19 tests passed; no open handle report.
- Final `npm run verify`: 8 suites, 63 tests passed; content, boundaries, typecheck, web export, normal Electron package, and normal packaged smoke passed.
- `npm run model:real-spike -- 4b`: passed five real cases, two restarts, circuit breaker, and cleanup.
- `npm run model:real-spike -- 9b`: passed five real cases, two restarts, circuit breaker, and cleanup.
- `npm run model:smoke`: packaged 4B response passed on the first attempt; two restarts, the sticky circuit breaker, and authored fallback passed in the packaged application.
- `npm run model:parent-kill-smoke`: no leaked llama-server after forced Electron death.
- A second `npm run model:smoke` removed the stale forced-death key directory and stopped cleanly.
- `git ls-files` returned no GGUF, runtime executable, runtime manifest, or temporary API-key file.

The same complete verification is rerun after any accepted Phase 3 Grok audit fix.
