import {
  Atlas,
  Canvas,
  FilterMode,
  MipmapMode,
  RoundedRect,
  Skia,
  rect,
  useImage,
} from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  ATLAS_PROOF_BILL,
  WALK_FRAME_MILLISECONDS,
  atlasRectangle,
  buildAtlasProofScene,
} from './atlas';

const atlasImage = require('../../assets/generated/world-atlas.png') as number;
const NEAREST = { filter: FilterMode.Nearest, mipmap: MipmapMode.None } as const;

type AtlasProofProps = Readonly<{ onReady: () => void }>;

export function AtlasProof({ onReady }: AtlasProofProps) {
  const image = useImage(atlasImage);
  const [frame, setFrame] = useState<0 | 1>(0);
  useEffect(() => {
    const timer = setInterval(() => setFrame((current) => current === 0 ? 1 : 0), WALK_FRAME_MILLISECONDS);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!image) {
      return;
    }
    let active = true;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (active) {
          onReady();
        }
      });
    });
    return () => {
      active = false;
    };
  }, [image, onReady]);
  const scene = useMemo(() => buildAtlasProofScene(frame), [frame]);
  const sourceRectangles = scene.sprites.map(({ sprite }) => {
    const source = atlasRectangle(sprite);
    return rect(source.x, source.y, source.width, source.height);
  });
  const transforms = scene.sprites.map(({ x, y, scale }) => Skia.RSXform(scale, 0, x, y));

  if (!image) {
    return <View style={styles.loading}><Text style={styles.caption}>Loading character atlas…</Text></View>;
  }
  return (
    <View>
      <View style={styles.labels}>
        <Text style={styles.label}>NATIVE 1×</Text>
        <Text style={styles.label}>INTEGER 2×</Text>
        <Text style={styles.label}>INTEGER 3×</Text>
      </View>
      <Canvas style={styles.canvas}>
        {scene.shadows.map((shadow, index) => (
          <RoundedRect
            color="#17151b66"
            height={2 * shadow.scale}
            key={`shadow-${index}`}
            r={shadow.scale}
            width={shadow.width}
            x={shadow.x}
            y={shadow.y}
          />
        ))}
        <Atlas
          image={image}
          sampling={NEAREST}
          sprites={sourceRectangles}
          transforms={transforms}
        />
      </Canvas>
      <Text style={styles.caption}>
        {ATLAS_PROOF_BILL.length} reachable cells · 24×30 characters · 32×32 tiles · 145 ms walk
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    backgroundColor: '#211f27',
    borderColor: '#4b4654',
    borderWidth: 1,
    height: 495,
    width: 1040,
  },
  caption: {
    color: '#93a898',
    fontFamily: 'Silkscreen',
    fontSize: 11,
    marginTop: 7,
    textAlign: 'center',
  },
  label: {
    color: '#f5dd9d',
    fontFamily: 'Silkscreen',
    fontSize: 11,
    width: 300,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
    paddingHorizontal: 10,
    width: 1040,
  },
  loading: {
    alignItems: 'center',
    height: 495,
    justifyContent: 'center',
    width: 1040,
  },
});
