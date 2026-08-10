# Local model provenance

## Status

The current development candidate is Qwen3.5-4B at `Q4_K_M`. It is not a ship selection. Exact 16 GB macOS and Windows qualification is still required.

The source of record is `scripts/model/model-pins.ts`. The generated external manifest is verified before packaging. Model files stay outside Git and outside ASAR.

## Pinned candidates

| Item | Qwen3.5-9B | Qwen3.5-4B |
|---|---|---|
| Role | Primary target | Named fallback and current development candidate |
| Repository | `Qwen/Qwen3.5-9B` | `Qwen/Qwen3.5-4B` |
| Source revision | `c202236235762e1c871ad0ccb60c8ee5ba337b9a` | `851bf6e806efd8d0a36b00ddf55e13ccb7b8cd0a` |
| GGUF SHA-256 | `8a9256b233037ea081c2e606e49dba0851cd42e441800da8ee04597ae9798341` | `32c8ff2d0972cc26d4c1f99d6655c7e0d4814bae9c23093a9213e23fd36e3d14` |
| GGUF bytes | `5,780,090,624` | `2,783,446,752` |
| Licence | Apache-2.0 | Apache-2.0 |

Both artifacts use llama.cpp conversion and `Q4_K_M` quantization from pinned llama.cpp revision `74ce15741b420b8d6f12e720398458b576c51c2c`, build 10335. The macOS ARM64 runtime SHA-256 is `30cf458e1627892f30e874fbe1ecb66412db1fbea0fb4054857245234c379076`. The parent guard SHA-256 is `014d571fc3a8e2cf7a638793ed49b65e8b46f3657bde9ad53a6ebde8700bb688`.

## Reproduction and verification

1. Set `SI_WORLD_MODEL_ROOT` to an absolute external work directory.
2. Run `npm run model:prepare -- 9b` or `npm run model:prepare -- 4b`.
3. Run `npm run model:build` on each target platform.
4. Run `npm run model:manifest` on each target platform.
5. Compare every file size and SHA-256 value with the generated manifest.
6. Run `llama-server --help`, the real-model smoke, and the qualification corpus with that exact runtime.

The packaged bundle contains `runtime-manifest.json`, the selected GGUF, the llama.cpp MIT licence, the Qwen Apache-2.0 licence, the server, and the parent-death guard. Runtime startup rechecks all manifest sizes and hashes.

## Evidence limits

The development Mac measured both candidates. Only the 4B candidate has a current integrated packaged-renderer run. The repository does not yet contain macOS x64 or Windows x64 model-runtime hashes. Shell packaging on those platforms does not close that gap.
