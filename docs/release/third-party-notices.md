# Third-party model notices

SI World bundles third-party software and model data only in model-enabled packages.

| Component | Pinned source | Licence | Packaged notice |
|---|---|---|---|
| llama.cpp | revision `74ce15741b420b8d6f12e720398458b576c51c2c` | MIT | `LLAMA-LICENSE` |
| Qwen3.5-9B | revision `c202236235762e1c871ad0ccb60c8ee5ba337b9a` | Apache-2.0 | `qwen3.5-9b-LICENSE` |
| Qwen3.5-4B | revision `851bf6e806efd8d0a36b00ddf55e13ccb7b8cd0a` | Apache-2.0 | `qwen3.5-4b-LICENSE` |

The runtime manifest pins the file name, byte count, and SHA-256 of each licence file. The package verifier rejects a model bundle when a licence file is absent or changed.

This notice does not replace the full licence texts. The full texts are distributed beside the selected runtime artifacts.
