# Stage 5 remaining work

Date: 2026-08-16. Branch `codex/threejs-stage-5-surfaces`, NOT merged.
Integration stays at `aaabec1`, green.

## Done and verified

- `SkiaProof` became the renderer-neutral `GameSurfaceShell`. Its only Skia
  drawing was one solid background rect, which a plain View reproduces exactly.
  Readiness reporting, surface measurement, dev-harness routing and the
  `active-surface-canvas`, `active-game-surface` and `development-runtime`
  proof nodes keep their meaning.
- `App.tsx` no longer mounts `WithSkiaWeb`. A served-export network capture on
  `?testRenderer=threejs-2d` shows NO `canvaskit.wasm` request.
- Portraits and the new-game vista draw through a new renderer-neutral
  `AtlasSprite`, which offsets the atlas inside an overflow-hidden frame and
  keeps nearest-neighbour sampling with no second drawing surface.
- The atlas bill test now asserts sampling behaviour instead of Skia syntax.
- 88 suites / 908 tests, typecheck and import boundaries all pass.

## Fable round: 4 findings, all fixed

1. CRITICAL. Removing `WithSkiaWeb` left nothing loading CanvasKit, so the Skia
   path, still the production default at Stage 5, crashed. Reproduced exactly as
   predicted: `Uncaught TypeError: Cannot read properties of undefined (reading
   'XYWHRect')`. Fixed by loading CanvasKit on the Skia path only, and by keeping
   the game screen and dev harness behind dynamic imports so the Skia module body
   never evaluates before CanvasKit exists.
2. HIGH. Portraits and the new-game vista used Skia on BOTH paths and would have
   silently failed once Three.js stopped loading CanvasKit. Fixed by `AtlasSprite`.
3. MEDIUM. Dev-harness world readiness reported failure because the backdrop is
   no longer a canvas. Fixed by skipping the world-ready bridge report there.
4. LOW. `webgl2Ready` read true when no canvas was found. Fixed with `?? null`.

## What still blocks the packaged smoke

The Skia variant now passes. The Three.js variant fails with the same
`XYWHRect` error, for the mirror reason: `src/render/WorldScene.tsx` imports
`@shopify/react-native-skia` statically and is loaded on BOTH paths, so the
Skia module body evaluates against an absent `global.CanvasKit`.

Remaining Skia importers: `AtlasProof.tsx`, `DistrictLightingOverlay.tsx`,
`WorldScene.tsx`, `vfx/ProceduralMapEffects.tsx`.

## Next step

Extract WorldScene's Skia drawing into a `SkiaWorldSurface` component behind a
dynamic import, mounted only when `rendererKind === 'skia'`. WorldScene keeps
the controller role and the Three.js surface; the Skia canvas, the Skia-only
overlays and `ProceduralMapEffects` move behind that one lazy boundary.
Stage 7 deletes the whole boundary with the rest of Skia.

That is the last thing standing between this branch and the Stage 5 exit gate,
which requires the default shipping path to neither load nor require CanvasKit
while the temporary Skia selector still works.

### Measured prop surface for the extraction

A first crude count suggested 212 identifiers, which counted every token and was
wrong. Restricting to identifiers declared in `WorldScene` scope and used by the
Skia region gives 43, and that still includes loop locals declared inside the
region itself (`base`, `batch`, `cancel`, `center`, `effect`, `foot`, `frame`,
`key`, `map`, `movement`, `placement`, `screen`, `tile`, `transform`) and the
input handlers that belong to `WorldInput` rather than the Skia canvas
(`handlePan`, `handlePrimary`, `handleZoom`, `isPointInteractive`,
`toggleQuests`, `rendererSuspended`, `handleRendererContextState`).

The real props for `SkiaWorldSurface` are about twenty:

  atlasCameraTransform, atlasData, characterAtlasData, feedbackScreen,
  floorAtlas, groundBatches, groundDetailAtlas, image, lighting, reducedMotion,
  roofAtlas, selectedScreen, shelterCells, vfxCamera, vfxMode, wallAtlas,
  worldFrame, camera, surface, absoluteMinute, worldState, speed

`NEAREST` and `TILE_SIZE` are module constants and move with the component.

So the extraction is a single new file plus one JSX swap in `WorldScene`, not the
large refactor the first estimate implied. Move `renderLayer`, the world
`<Canvas>`, `ProceduralMapEffects`, `DistrictLightingOverlay`,
`AtmosphereOverlay` and the feedback `<Canvas>` into it, then mount it through
`lazy()` only when `rendererKind === 'skia'`.
