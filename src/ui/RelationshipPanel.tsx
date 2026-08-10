import { Pressable, StyleSheet, Text, View } from 'react-native';

import { factionTier } from '../domain/factions/faction';
import type { WorldState } from '../domain/state/schema';

type RelationshipPanelProps = Readonly<{
  state: WorldState;
  npcId: string;
  onDismiss: () => void;
}>;

function label(id: string): string {
  return id.replaceAll('_', ' ').toUpperCase();
}

export function RelationshipPanel({ state, npcId, onDismiss }: RelationshipPanelProps) {
  const relationship = state.relationships[npcId] ?? state.relationships.linda;
  if (!relationship) return null;
  const visibleFactions = Object.values(state.factions).filter(({ revealed }) => revealed);
  return (
    <View nativeID="world-ui-relationship-overlay" style={styles.overlay}>
      <View accessibilityLabel="Relationship details" nativeID="world-ui-relationship-panel" style={styles.panel}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>SOCIAL RECORD</Text>
            <Text style={styles.title}>{label(relationship.npcId)}</Text>
          </View>
          <Pressable accessibilityLabel="Close relationships" onPress={onDismiss} style={styles.close}>
            <Text style={styles.closeText}>CLOSE</Text>
          </Pressable>
        </View>
        <Text style={styles.stage}>STAGE · {label(relationship.stage)}</Text>
        <View style={styles.values}>
          <Text style={styles.value}>FAMILIARITY {relationship.values.familiarity}</Text>
          <Text style={styles.value}>TRUST {relationship.values.trust}</Text>
          <Text style={styles.value}>ATTRACTION {relationship.values.attraction}</Text>
        </View>
        <Text style={styles.section}>BOUNDARIES AND CIRCUMSTANCES</Text>
        {relationship.rejections.length === 0 ? <Text style={styles.muted}>NO RECORDED REJECTION</Text> : relationship.rejections.map((record) => (
          <Text key={record.reasonId} style={record.resolved ? styles.resolved : styles.rejection}>
            {label(record.reasonId)} · {record.kind === 'permanent_boundary' ? 'PERMANENT' : record.resolved ? 'RESOLVED' : 'CHANGEABLE'}
          </Text>
        ))}
        <Text style={styles.section}>KNOWN FACTIONS</Text>
        {visibleFactions.map((faction) => (
          <Text key={faction.id} style={styles.faction}>
            {label(faction.id)} · {factionTier(faction.standing).toUpperCase()} · {faction.standing}
          </Text>
        ))}
        {!state.factions.velvet_tide?.revealed ? <Text style={styles.muted}>OTHER NETWORKS REMAIN HIDDEN</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  close: { borderColor: '#76573d', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  closeText: { color: '#c3b18f', fontFamily: 'Silkscreen', fontSize: 8 },
  eyebrow: { color: '#c89b5e', fontFamily: 'Silkscreen', fontSize: 8 },
  faction: { color: '#9fc58e', fontFamily: 'Silkscreen', fontSize: 9, marginTop: 7 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  muted: { color: '#897b67', fontFamily: 'Silkscreen', fontSize: 8, marginTop: 7 },
  overlay: { alignItems: 'center', backgroundColor: '#100d0acc', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0, zIndex: 55 },
  panel: { backgroundColor: '#252019', borderColor: '#c58b4b', borderWidth: 2, maxWidth: 650, padding: 18, width: '62%' },
  rejection: { color: '#ef9a69', fontFamily: 'Silkscreen', fontSize: 9, marginTop: 7 },
  resolved: { color: '#79b985', fontFamily: 'Silkscreen', fontSize: 9, marginTop: 7 },
  section: { color: '#d3a04c', fontFamily: 'Silkscreen', fontSize: 9, marginTop: 18 },
  stage: { color: '#fff0c7', fontFamily: 'Silkscreen', fontSize: 11, marginTop: 16 },
  title: { color: '#f1c65b', fontFamily: 'Silkscreen', fontSize: 18, marginTop: 3 },
  value: { color: '#fff0c7', fontFamily: 'Silkscreen', fontSize: 9 },
  values: { backgroundColor: '#1b1713', flexDirection: 'row', gap: 18, marginTop: 10, padding: 12 },
});
