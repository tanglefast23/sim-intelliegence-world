export const LLAMA_CPP = Object.freeze({
  repository: 'https://github.com/ggml-org/llama.cpp.git',
  revision: '74ce15741b420b8d6f12e720398458b576c51c2c',
  buildNumber: 10_335,
  supportCommits: Object.freeze([
    'fc0fe4004985d6749a7a05e250d161f9dbe41d65',
    '0d049d6a9245ccffc6073743ff8b6bb24ac6a47b',
    '42532afff43910e619a650c1704525b3acbbec5a',
  ]),
  buildFlags: Object.freeze([
    '-DCMAKE_BUILD_TYPE=Release',
    '-DBUILD_SHARED_LIBS=OFF',
    '-DGGML_NATIVE=OFF',
    '-DLLAMA_CURL=OFF',
    '-DLLAMA_OPENSSL=OFF',
    '-DLLAMA_BUILD_UI=OFF',
    '-DLLAMA_USE_PREBUILT_UI=OFF',
    '-DLLAMA_BUILD_SERVER=ON',
    '-DLLAMA_BUILD_TESTS=OFF',
    '-DLLAMA_BUILD_EXAMPLES=OFF',
  ]),
});

export const MODEL_PINS = Object.freeze({
  '4b': Object.freeze({
    id: 'qwen3.5-4b' as const,
    role: 'fallback' as const,
    repository: 'Qwen/Qwen3.5-4B' as const,
    revision: '851bf6e806efd8d0a36b00ddf55e13ccb7b8cd0a',
    outputFileName: 'qwen3.5-4b-q4_k_m.gguf',
  }),
  '9b': Object.freeze({
    id: 'qwen3.5-9b' as const,
    role: 'primary' as const,
    repository: 'Qwen/Qwen3.5-9B' as const,
    revision: 'c202236235762e1c871ad0ccb60c8ee5ba337b9a',
    outputFileName: 'qwen3.5-9b-q4_k_m.gguf',
  }),
});

export const MODEL_LICENSE = Object.freeze({
  name: 'Apache-2.0' as const,
  url: 'https://www.apache.org/licenses/LICENSE-2.0',
});
