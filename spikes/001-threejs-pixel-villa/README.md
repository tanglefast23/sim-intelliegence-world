# Three.js pixel-villa renderer spike

## Question

Given SI World’s existing pixel-art rules, can Three.js improve one villa frame without changing the art direction?

## Slice

- Same Sunward Villa social room.
- Same warm-brown, teal, gold, and green palette.
- Same authored 24×30 protagonist sprite from the world atlas.
- Static frame only.
- The 2D Three.js panel reuses atlas sprites and adds a GPU light map plus pixel shadows.
- The 2.5D Three.js panel adds low-resolution 3D depth, lighting, and pixel-edged shadows.

## View

```sh
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/spikes/001-threejs-pixel-villa/`.

The original side-by-side result is `comparison.png`.
The checked three-way result is `comparison-three-way.png`.

```sh
npm run spike:threejs:check
```

## Verdict: PARTIAL

### What worked

- The existing 24×30 protagonist sprite stays crisp and recognizable.
- 2D Three.js adds richer light and shadow while keeping the current top-down art.
- 2.5D adds room depth, furniture volume, warm lights, and contact shadows.
- Low-resolution rendering and nearest-neighbor scaling preserve the pixel-art look.

### What this does not prove

- Movement, camera panning, roof occlusion, full-map rendering, and packaged performance remain untested.
- This is an isolated display spike, not a second renderer inside the game runtime.

### Recommendation

The 2D Three.js gain is modest and probably does not justify a full migration alone. The 2.5D gain is larger, but it needs one playable room before any full migration decision.
