# Phase 2 Verification Evidence

## Environment

- Date: 2026-08-10
- Platform: macOS ARM64
- Electron: `43.3.0`
- Branch base: `origin/main` at `0995c38bb46ec9a058ec8bccfab22456fe7376ee`

## Clean verification

- `npx expo install --check` — dependencies are compatible
- `npm ci` — clean locked install succeeds
- `npm run verify` — succeeds
- Jest — 6 suites and 43 tests pass
- Electron TypeScript compilation — succeeds
- Forge package — succeeds for macOS ARM64
- Live packaged smoke — succeeds and exits without a remaining app process

The packaged renderer reported this closed proof object:

```json
{"appUrl":"app://game/","assetsLoaded":true,"bridgeKeys":["getRuntimeInfo","reportRendererReady"],"canvasKitReady":true,"nodeAccessBlocked":true}
```

## Packaged resource and security proof

- The package starts the exported app through `app://game/` without a development server.
- The ready proof requires successful font loading, non-empty image and audio fetches, a measurable post-paint CanvasKit canvas, the exact bridge surface, the exact app root, and blocked Node globals.
- The renderer reports no `require`, `module`, or `Buffer` access.
- The preload exposes only `getRuntimeInfo` and `reportRendererReady`.
- Unit tests cover traversal, custom-protocol authority, CSP, locked web preferences, navigation, new-window, webview, IPC sender, closed schema, rate-limit, and preload probes.
- External renderer HTTP and HTTPS requests are canceled in the default Electron session.

## Package contents

- Packaged `.app`: approximately `290 MB`, including Electron and frameworks
- `app.asar`: approximately `14 MB`, `1,072` entries
- Required `dist`, compiled main/preload, CanvasKit, proof atlas, proof audio, Silkscreen font, and `zod` entries are present.
- Source, tests, audits, screenshots, scripts, Expo, and React Native dependencies are rejected by the package-list smoke check.
- The smoke runner deletes stale target screenshots and requires two distinct, non-trivial PNG captures.
- The local development package has an ad-hoc linker signature only. Release signing is not claimed by Phase 2.

## Evidence files

- `packaged-loading.png` — authored shell before CanvasKit is ready; SHA-256 `ef1b00fac13cdf032ba9d7202b15caefc2ea35a15972863a97e1d0f484275be9`
- `packaged-electron.png` — live Skia canvas and sandboxed runtime; SHA-256 `91a2342eff150ff105958988755be1d4fbe4b95c21e928588419627d96a7f9a5`
- `public/canvaskit.wasm` — SHA-256 `eb68c7a7f602d8cb89915352c4471a2d26edfd72000f78202cb1fe32ce1f9dc4`
- Proof atlas — SHA-256 `d1675320a8a25786d4ee068b225fbc7ff0120086d9a3a087e9da2025a16b322e`
- Proof audio — SHA-256 `7016eb5aa855f464af82bcd405b74a3271ce9f8f26f05881644bf27f87c28611`

## Dependency-audit disposition

The initial Forge install introduced a critical vulnerable `tar 6.2.1` extraction dependency. The lock now overrides all Forge extraction paths to current `tar 7.5.22`; package and smoke tests pass with that override, and `npm audit` reports zero critical advisories.

The remaining npm result is 4 low, 7 moderate, and 16 high transitive advisories in the current Expo, React Native, Jest, and Forge toolchain. No compatible current patch is offered by npm for those paths. The project does not process untrusted build archives or images, and it will recheck current patches in every dependency-changing phase and at release qualification.

## Grok audit disposition

Grok 4.5 completed the required high-effort, read-only Phase 2 audit. All five findings were independently confirmed and fixed. The detailed disposition is in `audits/phase-02-grok-audit.md`.
