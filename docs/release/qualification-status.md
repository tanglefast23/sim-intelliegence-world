# Phase 14 qualification status

Date: 2026-08-10

Result: **not ship-qualified**. The 4B candidate passed the locked standalone development gates. The 9B candidate failed the capability gate. Required exact 16 GB macOS and Windows evidence is unavailable.

The Apple silicon ARM64 package is the primary macOS target. The x64 package exists only for legacy Intel compatibility. On Apple silicon, macOS runs that x64 package through Intel translation and warns that Intel components will stop working in a future macOS release. That warning does not apply to the native ARM64 package.

## Development evidence

| Gate | 9B | 4B |
|---|---:|---:|
| Warm ordinary requests | 100/100 valid | 100/100 valid |
| Capability fixtures | **88/100 first pass — fail** | **98/100 first pass — pass** |
| First-token maximum | 397.19 ms | 250.17 ms |
| Visible response p95 | 3,133.01 ms | 1,480.82 ms |
| Minimum generation rate | 22.92 tokens/s | 48.83 tokens/s |
| Peak runtime memory | 6,383,730,688 bytes | 3,432,284,160 bytes |
| Integrated signed package | Not current | Passed |

Both reports test commit `19f4488fcf789baf6f690086d3be44dbf145c4c0` on an Apple M5 Max with 128 GB RAM. The 100 performance prompts and 100 capability prompts are distinct. Capability uses a fresh model process and an open response grammar. The grammar does not force the expected decision, scope, source, action, or consent result.

The 4B misses were `boundary_005` and `boundary_006`. Both kept consent true and did not perform unauthorized persistent state changes, but their semantic routing did not match the fixture. The 9B misses were `halcyra_001` through `halcyra_004`, `uncertain_001` through `uncertain_003`, `uncertain_006`, `uncertain_009`, `uncertain_010`, `injection_001`, and `injection_007`. All failures used the safe no-change path. The committed JSON reports contain IDs and structured observations, but no raw dialogue.

The report field named `performanceThresholdsPassed` is a combined standalone-candidate flag. It includes capability, fallback, and state-authority gates as well as timing gates. The 9B timing gates passed; its combined flag is false because capability was below 95%.

The signed macOS ARM64 4B package at commit `4e5017a53e555e8972c9ab4cbaae9600ed908209` loaded offline, completed both free-text turns without fallback, produced non-text feedback in 5.6 ms, and measured 119.39 FPS during generation on an Apple M5 Max with 128 GB RAM. The complete route passed camera, movement, building entry, four-neighborhood travel, dialogue, invitation, relationship, purchase, quest, police, save, and reload checks. Model restart, circuit fallback, clean shutdown, and forced-parent-death cleanup also passed.

## SHIP gate status

| Gate | Status | Evidence or blocker |
|---|---|---|
| SHIP-01 | Blocked | macOS ARM64 4B ad-hoc package passes. Intel macOS and Windows shell jobs do not include target model runtimes. Release trust is not claimed. |
| SHIP-02 | Blocked | No exact 16 GB macOS and Windows runs. GitHub-hosted Intel macOS and Windows runners are not substitutes. |
| SHIP-03 | Blocked | The 4B standalone development thresholds pass. The 9B capability threshold fails. Cross-platform baseline renderer and model proof is missing. |
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
