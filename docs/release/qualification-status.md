# Phase 14 qualification status

Date: 2026-08-10

Result: **not ship-qualified**. High-end development evidence passed. Required exact 16 GB macOS and Windows evidence is unavailable.

The Apple silicon ARM64 package is the primary macOS target. The x64 package exists only for legacy Intel compatibility. On Apple silicon, macOS runs that x64 package through Intel translation and warns that Intel components will stop working in a future macOS release. That warning does not apply to the native ARM64 package.

## Development evidence

| Gate | 9B | 4B |
|---|---:|---:|
| Warm ordinary requests | 100/100 valid | 100/100 valid |
| Capability fixtures | 100/100 first pass | 100/100 first pass |
| First-token maximum | 386.69 ms | 345.54 ms |
| Visible response p95 | 3,510.55 ms | 2,239.32 ms |
| Minimum generation rate | 24.52 tokens/s | 32.92 tokens/s |
| Peak runtime memory | 6,419,906,560 bytes | 3,469,672,448 bytes |
| Integrated signed package | Not current | Passed |

The signed macOS ARM64 4B package loaded offline, completed both free-text turns without fallback, produced non-text feedback in 3.3 ms, and measured 119.9 FPS during generation on an Apple M5 Max with 128 GB RAM.

## SHIP gate status

| Gate | Status | Evidence or blocker |
|---|---|---|
| SHIP-01 | Blocked | macOS ARM64 4B ad-hoc package passes. Intel macOS and Windows shell jobs do not include target model runtimes. Release trust is not claimed. |
| SHIP-02 | Blocked | No exact 16 GB macOS and Windows runs. GitHub-hosted Intel macOS and Windows runners are not substitutes. |
| SHIP-03 | Blocked | High-end development thresholds pass. Cross-platform baseline renderer and model proof is missing. |
| SHIP-04 | Blocked | Sources, conversion, licences, GGUFs, and macOS ARM64 runtime are pinned. macOS x64 and Windows x64 runtime manifests are missing. |
| SHIP-05 | Pass | Compatible migration succeeds; unavailable migration fails safely; source data stays unchanged. |
| SHIP-06 | Pass | Dialogue is text-first. Only short authored vocal cues are present. No generated speech is used. |

## Required work before a ship claim

1. Build and hash llama.cpp and the parent guard on macOS x64 and Windows x64.
2. Bundle the same candidate GGUF and required licence files on all three targets.
3. Run 9B and 4B on named exact 16 GB macOS and Windows machines.
4. Run the signed integrated package on both named baselines.
5. Select one model only after all locked performance, capability, state-safety, consent, and content gates pass.

The local translated x64 smoke on Apple silicon completed its route but failed timing-sensitive interaction checks. It is not native Intel evidence. The native `macos-15-intel` CI job must pass without weaker thresholds.
