import { Pressable, StyleSheet, Text, View } from 'react-native';

import type {
  ConfirmVerbalMissionGoalResult,
  ReadVerbalMissionTurnResult,
} from '../application/effects/ConversationPort';
import {
  verbalMissionConfirmationCopy,
  verbalMissionLabel,
  type VerbalMissionConfirmation,
} from './conversation-feedback';

type MissionRead = Extract<ReadVerbalMissionTurnResult, { kind: 'decided' }>;

export function VerbalMissionFeedback({ accent, result, uiScale }: Readonly<{
  accent: string;
  result: MissionRead;
  uiScale: number;
}>) {
  return (
    <View accessibilityLiveRegion="polite" nativeID={`verbal-mission-reaction-${result.turnId}`} style={styles.feedback}>
      <View style={styles.feedbackHeader}>
        <Text style={[styles.kicker, { color: accent, fontSize: Math.round(7 * uiScale) }]}>READ THE ROOM</Text>
        <Text style={[styles.chip, { fontSize: Math.round(7 * uiScale) }]}>{verbalMissionLabel(result.portraitId)}</Text>
        <Text style={[styles.chip, { fontSize: Math.round(7 * uiScale) }]}>ROOM {verbalMissionLabel(result.roomState)}</Text>
      </View>
      <Text style={[styles.read, { fontSize: Math.round(10 * uiScale), lineHeight: Math.round(16 * uiScale) }]}>{result.readTheRoom}</Text>
      {result.concernTransitions.map((transition) => (
        <Text key={`${transition.concernId}-${transition.to}`} style={[styles.transition, { fontSize: Math.round(8 * uiScale) }]}>
          {verbalMissionLabel(transition.concernId)} · {verbalMissionLabel(transition.from)} → {verbalMissionLabel(transition.to)}
        </Text>
      ))}
      {result.recall.length > 0 ? (
        <View style={styles.recallBlock}>
          <Text style={[styles.recallLabel, { fontSize: Math.round(7 * uiScale) }]}>YOU NOW KNOW</Text>
          {result.recall.map((fact) => <Text key={fact} style={[styles.recall, { fontSize: Math.round(8 * uiScale) }]}>{fact}</Text>)}
        </View>
      ) : null}
    </View>
  );
}

export function VerbalMissionConfirmation({
  accent,
  busy,
  busyLabel,
  confirmation,
  onConfirm,
  settlement,
  uiScale,
}: Readonly<{
  accent: string;
  busy: boolean;
  busyLabel: string;
  confirmation: VerbalMissionConfirmation;
  onConfirm: () => void;
  settlement?: ConfirmVerbalMissionGoalResult;
  uiScale: number;
}>) {
  const copy = verbalMissionConfirmationCopy(confirmation);
  return (
    <View accessibilityLiveRegion="polite" nativeID="verbal-mission-confirmation" style={[styles.confirmation, { borderColor: accent }]}>
      <Text style={[styles.kicker, { color: accent, fontSize: Math.round(7 * uiScale) }]}>
        {settlement?.kind === 'confirmed' ? 'OUTCOME RECORDED' : settlement?.kind === 'rejected' ? 'COULD NOT CONFIRM' : 'FINAL CONFIRMATION'}
      </Text>
      <Text style={[styles.confirmationTitle, { fontSize: Math.round(10 * uiScale) }]}>{copy.title}</Text>
      <Text style={[styles.confirmationDetail, { fontSize: Math.round(8 * uiScale), lineHeight: Math.round(13 * uiScale) }]}>{copy.detail}</Text>
      <Text style={[styles.consequence, { fontSize: Math.round(7 * uiScale) }]}>
        {settlement?.kind === 'confirmed'
          ? 'JOURNAL UPDATED · THIS RESULT IS SAVED'
          : settlement?.kind === 'rejected'
            ? 'NO FINAL ACTION WAS TAKEN · CONVERSATION PROGRESS WAS SAVED'
            : copy.consequence}
      </Text>
      {!settlement ? (
        <Pressable
          accessibilityLabel={`${copy.button.toLowerCase()}. ${copy.consequence}`}
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={onConfirm}
          role="button"
          style={({ pressed }) => [styles.confirmButton, pressed && styles.pressed, busy && styles.disabled]}
        >
          <Text style={[styles.confirmButtonText, { fontSize: Math.round(9 * uiScale) }]}>{busy ? busyLabel : copy.button}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { borderColor: '#66513b', borderWidth: 1, color: '#d8bd91', fontFamily: 'Silkscreen', paddingHorizontal: 6, paddingVertical: 3 },
  confirmation: { alignSelf: 'stretch', backgroundColor: '#201c16', borderLeftWidth: 3, marginBottom: 10, padding: 12 },
  confirmationDetail: { color: '#fff0c7', fontFamily: 'Silkscreen', marginTop: 7 },
  confirmationTitle: { color: '#f1c65b', fontFamily: 'Silkscreen', marginTop: 6 },
  confirmButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#d3a04c', justifyContent: 'center', marginTop: 10, minHeight: 38, paddingHorizontal: 14 },
  confirmButtonText: { color: '#211d1a', fontFamily: 'Silkscreen' },
  consequence: { color: '#c99665', fontFamily: 'Silkscreen', marginTop: 8 },
  disabled: { opacity: 0.4 },
  feedback: { alignSelf: 'stretch', backgroundColor: '#242117', borderColor: '#80703e', borderLeftWidth: 3, marginBottom: 10, padding: 10 },
  feedbackHeader: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  kicker: { fontFamily: 'Silkscreen' },
  pressed: { opacity: 0.78, transform: [{ translateY: 2 }] },
  read: { color: '#f4dfad', fontFamily: 'Silkscreen', marginTop: 9 },
  recall: { alignSelf: 'flex-start', backgroundColor: '#193023', color: '#a9d2a4', fontFamily: 'Silkscreen', marginTop: 5, paddingHorizontal: 7, paddingVertical: 5 },
  recallBlock: { borderTopColor: '#4c5435', borderTopWidth: 1, marginTop: 9, paddingTop: 8 },
  recallLabel: { color: '#8fab83', fontFamily: 'Silkscreen' },
  transition: { color: '#d3a96d', fontFamily: 'Silkscreen', marginTop: 7 },
});
