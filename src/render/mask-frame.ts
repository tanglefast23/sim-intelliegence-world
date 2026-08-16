/**
 * Renderer mask frames: the readability instrument the comparator measures against.
 *
 * The comparator asks two questions of every locked frame — did the player's silhouette move, and
 * is it still readable against the floor around it. Both are answered through a mask: logical
 * bounds plus a per-texel alpha footprint.
 *
 * Stage 7 deleted the builders that emitted these, along with the paired Skia runners, and nothing
 * replaced them. Both sides of every comparison then pointed at one frozen file, so mask identity
 * compared a file to itself and the footprint stopped tracking what the renderer drew. This module
 * is the emitter, restored.
 *
 * The rule is RECOVERED, not invented. It is `playerFootprint` and `integerRect` from
 * `git show 31566b6^:scripts/qualification/build-threejs-all-map-fixtures.ts`, with one addition:
 * `scale`, so an authored object scale emits a correct footprint rather than leaving the mask
 * behind its own sprite.
 *
 * PURE ON PURPOSE. The atlas arrives as an injected `alphaAt` callback rather than an import,
 * because this module is reachable from the renderer bundle and `pngjs` and `node:fs` are not.
 */

export type MaskRect = Readonly<{ x: number; y: number; width: number; height: number }>;

export type RendererMask = Readonly<{
  id: string;
  kind: 'player';
  frameId: string;
  logicalBounds: MaskRect;
  hitBounds: MaskRect;
  alphaFootprint: readonly string[];
}>;

export type MaskFrameInput = Readonly<{
  fixtureId: string;
  sprite: string;
  /** The sprite's cell in the atlas, in atlas texels. */
  source: MaskRect;
  worldX: number;
  worldY: number;
  camera: Readonly<{ x: number; y: number }>;
  viewport: Readonly<{ width: number; height: number }>;
  /** The captured frame's logical size. Equals the viewport at every locked case. */
  captureLogical: Readonly<{ width: number; height: number }>;
  devicePixelRatio: number;
  zoom: number;
  /** Authored object scale. `1` everywhere until technique 4 lands. */
  scale: number;
}>;

/** Reports whether an atlas texel inside the sprite's own cell is opaque. */
export type AlphaAt = (x: number, y: number) => boolean;

export function integerRect(x: number, y: number, width: number, height: number): MaskRect {
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

/**
 * A mask pixel is set when its atlas texel is opaque.
 *
 * At native raster — device pixel ratio 1 and zoom 1 — only EDGE texels are set: a texel whose
 * four-neighbour is transparent. That is why the native masks are 76-cell outlines rather than
 * 442-cell silhouettes, and an emitter that filled them everywhere would silently change what
 * every readable-coverage number in the corpus means while still looking correct.
 */
export function maskFootprint(input: MaskFrameInput, alphaAt: AlphaAt, bounds: MaskRect): readonly string[] {
  const step = input.zoom * input.scale;
  const silhouetteOnly = input.devicePixelRatio === 1 && input.zoom === 1;
  const opaque = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < input.source.width && y < input.source.height && alphaAt(x, y);

  // The grid is sized from the ROUNDED bounds, not from `height * zoom * scale`.
  //
  // The recovered builder used the unrounded product, which is safe only for integer zoom. A
  // fractional scale breaks it: 30 x 1.22 is 36.6, giving 36 rows against bounds rounded to 37,
  // and the mask schema hard-fails when the footprint height does not equal the bounds height.
  return Array.from({ length: bounds.height }, (_, y) =>
    Array.from({ length: bounds.width }, (_, x) => {
      const sourceX = Math.floor(x / step);
      const sourceY = Math.floor(y / step);
      if (!opaque(sourceX, sourceY)) return '0';
      if (!silhouetteOnly) return '1';
      return ([[-1, 0], [1, 0], [0, -1], [0, 1]] as const)
        .some(([dx, dy]) => !opaque(sourceX + dx, sourceY + dy)) ? '1' : '0';
    }).join(''));
}

export function rendererMask(input: MaskFrameInput, alphaAt: AlphaAt): RendererMask {
  // Zero at every locked case, because the capture matches the case viewport. Written down so it
  // does not have to be rediscovered the first time a capture does not.
  const offset = {
    x: (input.captureLogical.width - input.viewport.width) / 2,
    y: (input.captureLogical.height - input.viewport.height) / 2,
  };
  const logicalBounds = integerRect(
    offset.x + (input.worldX - input.camera.x) * input.zoom,
    offset.y + (input.worldY - input.camera.y) * input.zoom,
    input.source.width * input.zoom * input.scale,
    input.source.height * input.zoom * input.scale,
  );
  return {
    id: `player-protagonist-${input.fixtureId}`,
    kind: 'player',
    frameId: `${input.sprite}:${input.zoom}`,
    logicalBounds,
    // From the ROUNDED bounds, as the recovered builder did — not from the raw top-left.
    hitBounds: integerRect(
      logicalBounds.x - 4 * input.zoom,
      logicalBounds.y - 2 * input.zoom,
      32 * input.zoom,
      32 * input.zoom,
    ),
    alphaFootprint: maskFootprint(input, alphaAt, logicalBounds),
  };
}

export function rendererMaskFrame(
  inputs: readonly MaskFrameInput[],
  alphaAt: (sprite: string) => AlphaAt,
): Readonly<{ schemaVersion: 1; masks: readonly RendererMask[] }> {
  return { schemaVersion: 1, masks: inputs.map((input) => rendererMask(input, alphaAt(input.sprite))) };
}
