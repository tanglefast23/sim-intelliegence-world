# Phase 26 pre-art performance reference

## Purpose

This is a historical method and reference. It is not the regression oracle for a later enhanced-art package. Later hard gates must measure baseline and enhanced art modes from the same package on the same machine.

## Command

```sh
npm run package:electron
npm run smoke:responsive:qualification -- \
  --output-root artifacts/phase-24/art-quality/phase-26-foundation/performance-baseline
```

## Fixed conditions

- Packaged Electron application, not the development server.
- Window content: `2560x1440`.
- Device-pixel ratio: `2`.
- World zoom: `1x` during maximum load.
- UI scale: `1.5`.
- Map: `northwest_residential`.
- Ordinary floor, prop, shadow, character, effect, wall, and roof layers enabled.
- Maximum-load camera and scene are produced by the existing Phase 22 qualification fixture.
- The packaged process receives `--force-device-scale-factor=2` directly so the qualification precondition is stable on macOS.

## Result

- Renderer-ready event: passed before the responsive run.
- Draw count: `3,571`.
- Sampled frames: `241`.
- Camera-change frames: `240`.
- Renderer FPS: `119.9`.
- Display RAF FPS: `119.9`.
- Rounded qualification FPS: `120`.
- Minimum required rounded FPS: `60`.
- Body and surface overflow: none.
- Canvas backing size: `5060x2820`.

The complete machine, source-path digest, geometry, layer counts, screenshot name, and measurements are in `performance-baseline/responsive-report.json`.

## Interpretation limit

Do not compare a later package directly with `119.9 FPS` and claim a valid percentage change. Machine load, display refresh, code, and package state can differ. The later performance gate must launch both art modes from one package and compare their median frame time under the same conditions.
