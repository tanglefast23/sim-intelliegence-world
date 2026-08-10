import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { WorldState } from '../domain/state/schema';

type JournalPanelProps = Readonly<{
  state: WorldState;
  onDismiss: () => void;
  onPurchaseSecurityReport: () => void;
  onAdvancePolice: () => void;
}>;

function label(id: string): string {
  return id.replaceAll('_', ' ').toUpperCase();
}

function timeLabel(absoluteMinute: number): string {
  const day = Math.floor(absoluteMinute / 1_440) + 1;
  const time = absoluteMinute % 1_440;
  return `DAY ${day} ${Math.floor(time / 60).toString().padStart(2, '0')}:${(time % 60).toString().padStart(2, '0')}`;
}

export function JournalPanel({ state, onDismiss, onPurchaseSecurityReport, onAdvancePolice }: JournalPanelProps) {
  const entries = Object.values(state.journal);
  const invitations = Object.values(state.invitations);
  const purchased = state.quests.linda_boyfriend_check?.flagIds.includes('security_report_purchased') ?? false;
  const lindaQuest = state.quests.linda_boyfriend_check;
  const policeAction = state.policeAttention === 'noticed'
    ? { label: 'Answer police questions', result: 'Attention becomes QUESTIONED. Evidence becomes linked.' }
    : state.policeAttention === 'questioned'
      ? { label: 'Ignore police summons', result: 'Attention becomes WANTED.' }
      : state.policeAttention === 'wanted'
        ? { label: 'Trigger wanted encounter', result: 'Attention becomes ARREST-ON-SIGHT.' }
        : undefined;
  return (
    <View nativeID="world-ui-journal-overlay" style={styles.overlay}>
      <View accessibilityLabel="Lead journal" nativeID="world-ui-journal-panel" style={styles.panel}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>VALIDATED LEADS</Text>
            <Text style={styles.title}>JOURNAL</Text>
          </View>
          <Pressable accessibilityLabel="Close journal" onPress={onDismiss} style={styles.close}>
            <Text style={styles.closeText}>CLOSE</Text>
          </Pressable>
        </View>
        <Text style={styles.section}>LEADS</Text>
        {lindaQuest ? <Text style={styles.detail}>LINDA QUEST · {lindaQuest.status.toUpperCase()}</Text> : null}
        {entries.length === 0 ? <Text style={styles.muted}>NO VALIDATED LEADS YET</Text> : entries.map((entry) => (
          <View key={entry.id} style={styles.card}>
            <Text style={styles.cardTitle}>{entry.summary.toUpperCase()}</Text>
            <Text style={styles.detail}>{entry.locationPrecision.toUpperCase()} LOCATION{entry.markerVisible ? ' · MAP MARKER' : ' · NO MARKER'}</Text>
            {entry.deadlineMinute !== undefined ? <Text style={styles.detail}>DEADLINE · {timeLabel(entry.deadlineMinute)}</Text> : null}
            <Text style={styles.detail}>{entry.resolutionState.toUpperCase()}</Text>
          </View>
        ))}
        <Text style={styles.section}>HOME INVITATIONS</Text>
        {invitations.length === 0 ? <Text style={styles.muted}>NO VISITS SCHEDULED</Text> : invitations.map((invitation) => (
          <Text key={invitation.id} style={styles.detail}>
            {label(invitation.npcId)} · {invitation.status.toUpperCase()}
            {invitation.scheduledMinute !== undefined ? ` · ${timeLabel(invitation.scheduledMinute)}` : ''}
            {invitation.counterProposedMinute !== undefined ? ` · COUNTER ${timeLabel(invitation.counterProposedMinute)}` : ''}
          </Text>
        ))}
        <Text style={styles.section}>OPTIONAL PREPARATION</Text>
        <Pressable
          accessibilityLabel="Buy villa security report"
          disabled={purchased || state.inventory.money < 60}
          onPress={onPurchaseSecurityReport}
          style={[styles.purchase, purchased && styles.purchaseDone]}
        >
          <Text style={styles.purchaseText}>{purchased ? 'SECURITY REPORT PURCHASED' : 'BUY VILLA SECURITY REPORT · $60'}</Text>
        </Pressable>
        <Text style={styles.section}>CONSEQUENCES</Text>
        <Text style={styles.detail}>POLICE · {state.policeAttention.toUpperCase()}</Text>
        <Text style={styles.detail}>EVIDENCE · {Object.keys(state.evidence).length}</Text>
        {policeAction ? (
          <Pressable accessibilityLabel={policeAction.label} onPress={onAdvancePolice} style={styles.policeAction}>
            <Text style={styles.purchaseText}>{policeAction.label.toUpperCase()}</Text>
            <Text style={styles.detail}>{policeAction.result}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#1b1713', borderLeftColor: '#d3a04c', borderLeftWidth: 2, marginTop: 8, padding: 10 },
  cardTitle: { color: '#fff0c7', fontFamily: 'Silkscreen', fontSize: 9 },
  close: { borderColor: '#76573d', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  closeText: { color: '#c3b18f', fontFamily: 'Silkscreen', fontSize: 8 },
  detail: { color: '#bda77e', fontFamily: 'Silkscreen', fontSize: 8, marginTop: 6 },
  eyebrow: { color: '#c89b5e', fontFamily: 'Silkscreen', fontSize: 8 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  muted: { color: '#897b67', fontFamily: 'Silkscreen', fontSize: 8, marginTop: 7 },
  overlay: { alignItems: 'center', backgroundColor: '#100d0acc', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0, zIndex: 55 },
  panel: { backgroundColor: '#252019', borderColor: '#c58b4b', borderWidth: 2, maxWidth: 680, padding: 18, width: '64%' },
  policeAction: { backgroundColor: '#4b2d2d', borderColor: '#d3765d', borderWidth: 1, marginTop: 8, padding: 10 },
  purchase: { alignItems: 'center', backgroundColor: '#6f4931', borderColor: '#d6a45d', borderWidth: 1, marginTop: 8, padding: 10 },
  purchaseDone: { backgroundColor: '#324a37' },
  purchaseText: { color: '#fff0c7', fontFamily: 'Silkscreen', fontSize: 8 },
  section: { color: '#d3a04c', fontFamily: 'Silkscreen', fontSize: 9, marginTop: 16 },
  title: { color: '#f1c65b', fontFamily: 'Silkscreen', fontSize: 18, marginTop: 3 },
});
