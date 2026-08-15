import { StyleSheet, View } from 'react-native';

import { ATLAS_INDEX, CHARACTER_IDS, atlasRectangle, type CharacterId } from '../render/atlas';
import { AtlasSprite } from './AtlasSprite';

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
  scale?: 2 | 3 | 6 | 9 | 20;
}>) {
  const characterId = portraitCharacterId(npcId);
  const portraitId = ATLAS_INDEX.characters[characterId].portraits[expression]
    ?? ATLAS_INDEX.characters[characterId].portrait;
  const source = atlasRectangle(portraitId);

  return (
    <View
      accessibilityLabel={`Portrait of ${displayName}`}
      nativeID={`conversation-portrait-${characterId}`}
      style={[styles.frame, scale === 3 && styles.largeFrame, scale === 6 && styles.cinematicFrame, scale === 9 && styles.cutsceneFrame, scale === 20 && styles.dialogueFrame]}
    >
      <AtlasSprite
        height={source.height}
        key={characterId}
        scale={scale}
        width={source.width}
        x={source.x}
        y={source.y}
      />
      <View nativeID={`conversation-portrait-${characterId}-ready`} style={styles.ready} />
    </View>
  );
}

const styles = StyleSheet.create({
  cinematicCanvas: { height: 264, width: 240 },
  cinematicFrame: { backgroundColor: 'transparent', borderWidth: 0, height: 264, width: 240 },
  cutsceneCanvas: { height: 396, width: 360 },
  cutsceneFrame: { backgroundColor: 'transparent', borderWidth: 0, height: 396, width: 360 },
  dialogueCanvas: { height: 580, width: 480 },
  dialogueFrame: { backgroundColor: 'transparent', borderWidth: 0, height: 580, width: 480 },
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
