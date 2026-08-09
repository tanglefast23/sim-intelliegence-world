# Phase 4 character and atlas verification

Status: Passed on the packaged Electron proof scene.

## Generated art contract

- Three original identities: protagonist, Linda, and one generic resident.
- Six build-time source layers per identity: legs, torso and clothing, head and face, hair, accessory, and optional held item.
- Two authored front walking frames and two authored lateral-leg frames per identity.
- Eight flat runtime world cells per identity: two front, two rear, two left, and two right.
- Rear cells use SI World's self-contained build-time adaptation of the HFM method. No SI World build reads the HFM repository.
- Left and right cells combine the front billboard body with authored or mirrored lateral legs. Runtime code does not compose character layers.
- One `40x44` conversation portrait per identity and ten original `32x32` environment tiles.
- One deterministic `512x126` RGBA atlas with one-pixel transparent gutters and a rectangle index.
- World characters remain `24x30`. Walking alternates every `145 ms`. Runtime zoom is limited to nearest-neighbor integer `1x`, `2x`, and `3x`.

The generated atlas contains 37 reachable cells: 10 tiles, 24 world-character cells, and 3 portraits. The packaged proof scene is built from the same reverse bill that the test compares with every generated rectangle.

## Readability decision

The cheap front-billboard lateral system is accepted for prototype cast production. At native `1x`, the widened horizontal feet, alternating leg placement, one-pixel lean, shadow shift, and bounce make left and right movement readable. The packaged screenshot also proves the same cells at `2x` and `3x`.

No mirrored three-quarter head is needed. No full side profile, sitting, combat, romance, or job animation was added.

## Artifact hashes

| Artifact | SHA-256 | Size |
| --- | --- | ---: |
| `assets/generated/world-atlas.png` | `7791686e427e5b300aecac9210db627a5eaa88026e41dd893abc93ade5baddbb` | 12,345 bytes |
| `assets/generated/atlas-index.json` | `ed4e5368084866b38d5b08761d414c428fb03b0167eefba294996d683c9dd330` | 8,988 bytes |
| `artifacts/phase-04/atlas-review.png` | `3b681ecc83bd0308e9c7d1e824557787a521be290562ec28cbf2430081cf5302` | 17,472 bytes |
| `artifacts/phase-04/packaged-electron.png` | `c812f7f8fcfcba9ecaf150297a216b074598ad01cc5a1a41008f5f5291914689` | 42,400 bytes |

## Verification completed

- `npm run art:atlas`: generated the atlas, index, and review sheet.
- A second generation was byte-identical in automated tests.
- `npm run typecheck`: passed.
- `npm test -- --runInBand`: 11 suites and 75 tests passed, including portrait identity and exact proof-scene reachability.
- `npm run export:web`: bundled the generated atlas.
- `npm run test:electron`: unit checks, package build, packaged resource checks, sandbox proof, and screenshot proof passed.
- The packaged readiness gate was tested against a cold atlas load. It reports ready only after the atlas decodes and receives two paint frames.

The same complete verification passed after the accepted Phase 4 Grok audit fix.
