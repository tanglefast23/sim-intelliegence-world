import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ViewportSize } from '../render/camera';
import type { UiScale } from '../render/responsive-layout';
import { CharacterPortrait } from './CharacterPortrait';
import { uiMetrics } from './ui-metrics';

type QuestOfferDialogueProps = Readonly<{
  accent: string;
  onAccept: () => void;
  onDecline: () => void;
  playerName: string;
  surface: ViewportSize;
  uiScale: UiScale;
}>;

export function QuestOfferDialogue({ accent, onAccept, onDecline, playerName, surface, uiScale }: QuestOfferDialogueProps) {
  const metrics = uiMetrics(uiScale);
  const choiceWidth = Math.min(430, Math.round(surface.width * 0.36));
  const stripHeight = Math.max(150, Math.round(surface.height * 0.22));
  const dialogueText = { fontSize: metrics.conversationText, lineHeight: Math.round(metrics.conversationText * 1.5) };
  return (
    <View accessibilityLabel="Linda quest offer" nativeID="world-ui-quest-offer-overlay" style={styles.overlay}>
      <View
        nativeID="world-ui-quest-offer-panel"
        style={[styles.scene, { height: surface.height, width: surface.width }]}
      >
        <View style={[styles.actorLeft, { bottom: stripHeight - 24 }]}>
          <View style={styles.facesRight}><CharacterPortrait displayName={playerName} npcId="protagonist" scale={9} /></View>
        </View>
        <View style={[styles.actorRight, { bottom: stripHeight - 24 }]}>
          <View style={styles.facesLeft}><CharacterPortrait displayName="Linda" expression="upset" npcId="linda" scale={9} /></View>
        </View>
        <View style={[styles.actions, { bottom: Math.max(176, Math.round(surface.height * 0.265)), left: (surface.width - choiceWidth) / 2, width: choiceWidth }] }>
          <Pressable
            accessibilityLabel="Accept Linda's request"
            onPress={onAccept}
            style={({ pressed }) => [styles.accept, { minHeight: metrics.primaryControl }, pressed && styles.pressed]}
          >
            <Text style={[styles.acceptText, { fontSize: metrics.persistentText }]}>YES · HELP LINDA</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Decline Linda's request"
            onPress={onDecline}
            style={({ pressed }) => [styles.decline, { minHeight: metrics.primaryControl }, pressed && styles.pressed]}
          >
            <Text style={[styles.declineText, { fontSize: metrics.persistentText }]}>NO · NOT NOW</Text>
          </Pressable>
        </View>
        <View style={[styles.speech, { minHeight: stripHeight, paddingHorizontal: Math.max(28, Math.round(surface.width * 0.19)) }] }>
          <View style={[styles.nameplate, { backgroundColor: accent }]}>
            <Text style={[styles.speaker, { fontSize: metrics.persistentText }]}>LINDA</Text>
          </View>
          <Text style={[styles.dialogue, dialogueText]}>
            My boyfriend has been frightening me. I do not feel safe checking on him alone. Will you help me?
          </Text>
          <Text style={[styles.question, { fontSize: metrics.secondaryText }]}>LINDA IS WAITING FOR {playerName.toUpperCase()}'S ANSWER.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  accept: { alignItems: 'center', backgroundColor: '#d3a04c', justifyContent: 'center', paddingHorizontal: 14 },
  acceptText: { color: '#211d1a', fontFamily: 'Silkscreen' },
  actions: { flexDirection: 'column', gap: 7, position: 'absolute', zIndex: 5 },
  actorLeft: { left: '1%', position: 'absolute', zIndex: 2 },
  actorRight: { position: 'absolute', right: '1%', zIndex: 2 },
  decline: { alignItems: 'center', backgroundColor: '#100d0ae6', borderColor: '#76573d', borderWidth: 1, justifyContent: 'center', paddingHorizontal: 14 },
  declineText: { color: '#c3b18f', fontFamily: 'Silkscreen' },
  dialogue: { color: '#fff0c7', fontFamily: 'Silkscreen' },
  facesLeft: { transform: [{ scaleX: -1 }] },
  facesRight: { transform: [{ scaleX: 1 }] },
  nameplate: { alignItems: 'center', borderColor: '#fff0c7', borderWidth: 1, minWidth: 180, paddingHorizontal: 22, paddingVertical: 7, position: 'absolute', right: '18%', top: -18 },
  overlay: { backgroundColor: '#08090733', bottom: 0, left: 0, position: 'absolute', right: 0, top: 0, zIndex: 65 },
  pressed: { opacity: 0.78, transform: [{ translateY: 2 }] },
  question: { color: '#9d8768', fontFamily: 'Silkscreen', marginTop: 10 },
  scene: { overflow: 'hidden', position: 'relative' },
  speaker: { color: '#211d1a', fontFamily: 'Silkscreen' },
  speech: { backgroundColor: '#100d0ae6', borderTopColor: '#9c6a3d', borderTopWidth: 2, bottom: 0, justifyContent: 'center', left: 0, paddingBottom: 18, paddingTop: 28, position: 'absolute', right: 0, zIndex: 4 },
});
