import { Image, Platform, StyleSheet, View } from 'react-native';

import { ATLAS_INDEX } from '../render/atlas';

const atlasImage = require('../../assets/generated/world-atlas.png') as number;

/**
 * Stage 5: the smallest renderer-neutral atlas crop.
 *
 * Portraits and the new-game vista previously drew one sprite through a Skia `Atlas` canvas,
 * which forced CanvasKit to load on every path. This draws the same crop by offsetting the
 * whole atlas inside an overflow-hidden frame, so it needs no Skia and no second WebGL context.
 * `imageRendering: pixelated` keeps the nearest-neighbour sampling the Skia path used.
 */
export function AtlasSprite({
  height,
  scale,
  width,
  x,
  y,
}: Readonly<{
  height: number;
  scale: number;
  width: number;
  x: number;
  y: number;
}>) {
  return (
    <View
      pointerEvents="none"
      style={[styles.frame, { height: height * scale, width: width * scale }]}
    >
      <Image
        source={atlasImage}
        style={[
          styles.sheet,
          {
            height: ATLAS_INDEX.image.height * scale,
            left: -x * scale,
            top: -y * scale,
            width: ATLAS_INDEX.image.width * scale,
          },
          Platform.OS === 'web' ? ({ imageRendering: 'pixelated' } as object) : null,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  sheet: { position: 'absolute' },
});
