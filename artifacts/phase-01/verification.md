# Phase 1 Verification Evidence

## Environment

- Date: 2026-08-10
- Local Node: `v22.23.1`
- Local npm: `10.9.8`
- Branch base: `origin/main` at `d977c0fbf381980fb8774cfbb288d35decfdf13a`

## Reproducible checks

- `npx expo install --check` — dependencies are compatible with current Expo 57
- `npm ci` — clean locked install succeeds
- `npm run verify` — succeeds
- Jest — 2 suites and 9 tests pass
- Expo web export — creates `dist/index.html`, `dist/metadata.json`, and the web JavaScript bundle
- Browser accessibility tree — contains heading `SI World`
- Browser body text — `SI World` and `Foundation si-world-0.1.0`
- Browser console and page-error queries — no reported entries

## Visual evidence

- `foundation-web.png`
- Dimensions: `1280×577`
- SHA-256: `1c4c88f67087b8a9fc0b8ee2aae41c29c8d96ed5e6737ba8996c15578b15ab03`

## Dependency-audit limitation

`npm audit --omit=dev` reports 7 moderate and 15 high transitive advisories in the current Expo/React Native toolchain. There are no critical advisories. npm proposes incompatible downgrades to Expo 53, React Native 0.72, Skia 1, Reanimated 4.2, and Worklets 0.7 rather than a compatible patch.

Phase 1 does not suppress this result or run a forced downgrade. The affected CLI image and Xcode parsers receive only repository-controlled build inputs. Recheck current compatible upstream patches in each dependency-changing phase and before release qualification.
