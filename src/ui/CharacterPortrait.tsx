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

import { CHARACTER_IDS, atlasRectangle, type CharacterId } from '../render/atlas';

const atlasImage = require('../../assets/generated/world-atlas.png') as number;
const NEAREST = { filter: FilterMode.Nearest, mipmap: MipmapMode.None } as const;
const PORTRAIT_SCALE = 2;

function portraitCharacterId(npcId: string): CharacterId {
  const candidate = npcId.replaceAll('_', '-') as CharacterId;
  return CHARACTER_IDS.includes(candidate) ? candidate : 'generic-resident';
}

export function CharacterPortrait({ displayName, npcId }: Readonly<{ displayName: string; npcId: string }>) {
  const image = useImage(atlasImage);
  const characterId = portraitCharacterId(npcId);
  const source = atlasRectangle(`portrait.${characterId}`);

  return (
    <View
      accessibilityLabel={`Portrait of ${displayName}`}
      nativeID={`conversation-portrait-${characterId}`}
      style={styles.frame}
    >
      {image ? (
        <>
          <Canvas key={characterId} style={styles.canvas}>
            <Atlas
              image={image}
              sampling={NEAREST}
              sprites={[rect(source.x, source.y, source.width, source.height)]}
              transforms={[Skia.RSXform(PORTRAIT_SCALE, 0, 0, 0)]}
            />
          </Canvas>
          <View nativeID={`conversation-portrait-${characterId}-ready`} style={styles.ready} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { height: 88, width: 80 },
  frame: {
    backgroundColor: '#181512',
    borderColor: '#76573d',
    borderWidth: 1,
    height: 90,
    overflow: 'hidden',
    width: 82,
  },
  ready: { height: 0, width: 0 },
});
