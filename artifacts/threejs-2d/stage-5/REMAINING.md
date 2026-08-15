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


---

# Stage 5 update, 2026-08-16 — 24 of 25 fixtures pass

## Resolved since the first note

- `SkiaWorldSurface` now holds every Skia drawing surface behind one lazy
  boundary. `WorldScene` no longer imports Skia, so the Three.js path never
  evaluates the Skia module body. Both packaged renderer variants pass their
  smoke, and the served export requests no `canvaskit.wasm`. `GameScreen` ships
  as its own chunk, which proves the split.
- Three.js took the feedback batches back. It has owned lighting and atmosphere
  since Stage 4, so the batches sit last in the composite order and land above
  both. That discharges the Stage 3 deferral.
- Two extraction defects found and fixed by measurement, not guesswork:
  the world canvas style was invented rather than copied, dropping the `#b77945`
  clear colour that matches the Three.js renderer, so uncovered area read as
  shell backdrop and failed every 2560x1440 fixture; and Skia readiness fired
  before a large canvas had painted.

## The one remaining failure

`villa-destination-journal-failure`, mask `failure-marker`:

- retained contrast `0.607` against a `0.9` floor;
- readable coverage `0.874` against a `0.95` floor;
- scaled mask mean absolute delta `25.7` against `10`.

Skia drew this 3 pixel diagonal X antialiased. Three.js tessellates it with hard
edges and `antialias: false`. The mask footprint comes from Skia's geometry, so
the median inside it is dominated by background unless the stroke covers enough
of it. Antialiasing covers enough to flip that median; hard edges do not.

Five changes were tried and measured. ALL are disproved and reverted:

- round caps on the X: coverage `0.844` to `0.874`, contrast unchanged;
- removing the legacy P3 matrix from the feedback batches: contrast identical to
  six decimals, mask delta slightly worse;
- a feathered stroke at half a pixel: coverage `0.874` to `0.889`, contrast fell
  slightly;
- widening that feather to a full pixel: every number identical to six decimals,
  because the extra width lands outside the mask footprint, which only covers
  distance `1.5` from the centre line;
- snapping the failure mask to the rendered pixel lattice in the builder: no
  change, so the centre was already on integer coordinates.

The measured constants across all five are `candidateContrast 1.0151` against a
baseline of `1.6982`, retention `0.5977`, readable `120` of `135`. Colour is not
the cause: sampled pixels read `239,91,67` on Skia and `236,91,67` on Three.js.
The arms are simply thinner, so the median inside the footprint stays on
background.

The conclusion is that no geometric approximation reaches this. The stroke needs
real per-pixel coverage, not a wider hard-edged quad.

## Next step

Give thin feedback primitives real antialiased coverage in the shader. Add a
per-vertex signed distance attribute to the line and annulus geometry, and have
the primitive fragment shader return `smoothstep` alpha across the last half
pixel. Widening geometry cannot substitute, because extra width falls outside
the mask footprint while the fringe pixels inside it stay uncovered.

Note that `destination-pulse` and `journal-markers` already pass, at retention
`1.0000` and `0.9665`, so Three.js feedback rendering is sound in general. Only
the thin diagonal X is short.

Do NOT relax the contrast floor. The measurement is telling the truth: the
hard-edged X really is less readable than the antialiased one, and the floor
exists for exactly that.
