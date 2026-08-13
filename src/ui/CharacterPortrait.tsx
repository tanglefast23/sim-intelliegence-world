import {
  Atlas,
  Canvas,
  FilterMode,
  MipmapMode,
  Skia,
  rect,
  useImage,
} from '@shopify/react-native-skia';
import { StyleSheet, View } from 'react-native';

import { ATLAS_INDEX, CHARACTER_IDS, atlasRectangle, type CharacterId } from '../render/atlas';

const atlasImage = require('../../assets/generated/world-atlas.png') as number;
const NEAREST = { filter: FilterMode.Nearest, mipmap: MipmapMode.None } as const;
const PORTRAIT_SCALE = 2;

function portraitCharacterId(npcId: string): CharacterId {
  const candidate = npcId.replaceAll('_', '-') as CharacterId;
  return CHARACTER_IDS.includes(candidate) ? candidate : 'generic-resident';
}

export function CharacterPortrait({
  displayName,
  expression = 'rest',
  npcId,
  scale = PORTRAIT_SCALE,
}: Readonly<{
  displayName: string;
  expression?: 'rest' | 'joy' | 'upset';
  npcId: string;
  scale?: 2 | 3 | 6 | 9;
}>) {
  const image = useImage(atlasImage);
  const characterId = portraitCharacterId(npcId);
  const portraitId = ATLAS_INDEX.characters[characterId].portraits[expression]
    ?? ATLAS_INDEX.characters[characterId].portrait;
  const source = atlasRectangle(portraitId);

  return (
    <View
      accessibilityLabel={`Portrait of ${displayName}`}
      nativeID={`conversation-portrait-${characterId}`}
      style={[styles.frame, scale === 3 && styles.largeFrame, scale === 6 && styles.cinematicFrame, scale === 9 && styles.cutsceneFrame]}
    >
      {image ? (
        <>
          <Canvas key={characterId} style={scale === 9 ? styles.cutsceneCanvas : scale === 6 ? styles.cinematicCanvas : scale === 3 ? styles.largeCanvas : styles.canvas}>
            <Atlas
              image={image}
              sampling={NEAREST}
              sprites={[rect(source.x, source.y, source.width, source.height)]}
              transforms={[Skia.RSXform(scale, 0, 0, 0)]}
            />
          </Canvas>
          <View nativeID={`conversation-portrait-${characterId}-ready`} style={styles.ready} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cinematicCanvas: { height: 264, width: 240 },
  cinematicFrame: { backgroundColor: 'transparent', borderWidth: 0, height: 264, width: 240 },
  cutsceneCanvas: { height: 396, width: 360 },
  cutsceneFrame: { backgroundColor: 'transparent', borderWidth: 0, height: 396, width: 360 },
  canvas: { height: 88, width: 80 },
  frame: {
    backgroundColor: '#181512',
    borderColor: '#76573d',
    borderWidth: 1,
    height: 90,
    overflow: 'hidden',
    width: 82,
  },
  largeCanvas: { height: 132, width: 120 },
  largeFrame: { height: 134, width: 122 },
  ready: { height: 0, width: 0 },
});
