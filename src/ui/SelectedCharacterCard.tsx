import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { UiScale } from '../render/responsive-layout';
import { CharacterPortrait } from './CharacterPortrait';
import type { SelectedCharacterSummary } from './selected-character';
import { UI_LAYER } from './ui-layers';
import { uiMetrics } from './ui-metrics';

export function SelectedCharacterCard({
  accent,
  availableWidth,
  compact = false,
  onCenter,
  onTalk,
  pose,
  summary,
  uiScale,
}: Readonly<{
  accent: string;
  availableWidth: number;
  compact?: boolean;
  onCenter: () => void;
  onTalk?: () => void;
  pose: 'idle' | 'reaction' | 'talk';
  summary: SelectedCharacterSummary;
  uiScale: UiScale;
}>) {
  const metrics = uiMetrics(uiScale);
  const poseLabel = pose === 'reaction' ? 'REACTION POSE' : pose === 'talk' ? 'TALKING POSE' : 'IDLE POSE';
  if (compact) return (
    <View
      accessibilityLabel={`${summary.displayName}. Mood ${summary.mood}. Activity ${summary.activity}.`}
      nativeID="world-ui-character-card"
      style={[styles.compactCard, { borderLeftColor: accent }]}
    >
      <View>
        <Text style={[styles.compactName, { color: accent }]}>{summary.displayName.toUpperCase()}</Text>
        <Text style={styles.compactState}>{summary.mood} · {summary.activity}</Text>
      </View>
      <Pressable accessibilityLabel={`Center view on ${summary.displayName}`} onPress={onCenter} role="button" style={({ pressed }) => [styles.compactButton, pressed && styles.pressed]}>
        <Text style={styles.secondaryButtonText}>CENTER</Text>
      </Pressable>
    </View>
  );
  return (
    <View
      accessibilityLabel={`${summary.displayName}. ${poseLabel}. Mood ${summary.mood}. Activity ${summary.activity}. Relationship ${summary.relationship}. Destination ${summary.destination}.`}
      nativeID="world-ui-character-card"
      style={[styles.card, { borderLeftColor: accent, width: Math.min(availableWidth - 28, Math.round(390 * uiScale)) }]}
    >
      <View style={[styles.portraitWrap, { borderColor: accent }, pose === 'reaction' && styles.portraitReaction, pose === 'talk' && styles.portraitTalk]}>
        <CharacterPortrait
          displayName={summary.displayName}
          expression={summary.portraitExpression}
          npcId={summary.id}
        />
        <View style={[styles.moodBadge, { backgroundColor: accent }]}><Text style={styles.moodText}>{summary.mood}</Text></View>
      </View>
      <View style={styles.details}>
        <Text style={styles.selectedLabel}>CURRENT FOCUS · {poseLabel}</Text>
        <Text numberOfLines={1} style={[styles.name, { fontSize: metrics.titleText }]}>{summary.displayName}</Text>
        <Text numberOfLines={1} style={[styles.relationship, { color: accent, fontSize: metrics.secondaryText }]}>{summary.relationship}</Text>
        <View style={styles.rule} />
        <View style={styles.factRow}><Text style={styles.factLabel}>NOW</Text><Text numberOfLines={1} style={styles.factValue}>{summary.activity}</Text></View>
        <View style={styles.factRow}><Text style={styles.factLabel}>GOING</Text><Text numberOfLines={2} style={styles.factValue}>{summary.destination}</Text></View>
        <View style={styles.actions}>
          <Pressable accessibilityLabel={`Center view on ${summary.displayName}`} onPress={onCenter} role="button" style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <Text style={styles.secondaryButtonText}>CENTER</Text>
          </Pressable>
          {onTalk ? (
            <Pressable accessibilityLabel={`Talk to ${summary.displayName}`} onPress={onTalk} role="button" style={({ pressed }) => [styles.primaryButton, { backgroundColor: accent }, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>TALK</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 6, marginTop: 8 },
  card: {
    backgroundColor: '#171914f5', borderBottomColor: '#7f5a35', borderBottomWidth: 3,
    borderLeftColor: '#f1c65b', borderLeftWidth: 3, bottom: 42, flexDirection: 'row',
    gap: 10, left: 14, padding: 8, position: 'absolute', shadowColor: '#070906',
    shadowOffset: { height: 7, width: 7 }, shadowOpacity: 0.62, shadowRadius: 0, zIndex: UI_LAYER.card,
  },
  compactButton: { alignItems: 'center', borderColor: '#76573d', borderWidth: 1, justifyContent: 'center', minHeight: 30, paddingHorizontal: 12 },
  compactCard: {
    alignItems: 'center', backgroundColor: '#171914f5', borderBottomColor: '#7f5a35', borderBottomWidth: 3,
    borderLeftWidth: 3, bottom: 42, flexDirection: 'row', gap: 14, justifyContent: 'space-between',
    left: 14, paddingHorizontal: 10, paddingVertical: 8, position: 'absolute', shadowColor: '#070906',
    shadowOffset: { height: 5, width: 5 }, shadowOpacity: 0.62, shadowRadius: 0, zIndex: UI_LAYER.card,
  },
  compactName: { fontFamily: 'Georgia', fontSize: 14, fontWeight: '700' },
  compactState: { color: '#dec69a', fontFamily: 'Silkscreen', fontSize: 7, marginTop: 2 },
  details: { flex: 1, minWidth: 0 },
  factLabel: { color: '#8e8069', fontFamily: 'Silkscreen', fontSize: 7, width: 42 },
  factRow: { flexDirection: 'row', marginTop: 4 },
  factValue: { color: '#dec69a', flex: 1, fontFamily: 'Silkscreen', fontSize: 8 },
  moodBadge: { bottom: 0, left: 0, paddingHorizontal: 5, paddingVertical: 3, position: 'absolute', right: 0 },
  moodText: { color: '#211d1a', fontFamily: 'Silkscreen', fontSize: 7, textAlign: 'center' },
  name: { color: '#fff0c7', fontFamily: 'Georgia', fontWeight: '700', textTransform: 'uppercase' },
  portraitWrap: { borderWidth: 1, height: 90, width: 82 },
  portraitReaction: { transform: [{ rotate: '-2deg' }, { translateY: -3 }] },
  portraitTalk: { transform: [{ translateY: -1 }] },
  pressed: { opacity: 0.76, transform: [{ translateY: 1 }] },
  primaryButton: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 28 },
  primaryButtonText: { color: '#211d1a', fontFamily: 'Silkscreen', fontSize: 8 },
  relationship: { fontFamily: 'Silkscreen', marginTop: 2 },
  rule: { backgroundColor: '#514838', height: 1, marginVertical: 5 },
  secondaryButton: { alignItems: 'center', borderColor: '#76573d', borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 28 },
  secondaryButtonText: { color: '#d6c19a', fontFamily: 'Silkscreen', fontSize: 8 },
  selectedLabel: { color: '#8e8069', fontFamily: 'Silkscreen', fontSize: 7, letterSpacing: 0.6 },
});
