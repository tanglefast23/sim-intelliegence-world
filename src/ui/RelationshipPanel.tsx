import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { factionTier } from '../domain/factions/faction';
import type { WorldState } from '../domain/state/schema';
import type { ViewportSize } from '../render/camera';
import { responsivePanelLayout, responsiveSideSheetWidth, type UiScale } from '../render/responsive-layout';
import { CharacterPortrait } from './CharacterPortrait';
import { uiMetrics } from './ui-metrics';

type RelationshipPanelProps = Readonly<{
  accent: string;
  state: WorldState;
  npcId: string;
  onDismiss: () => void;
  surface: ViewportSize;
  uiScale: UiScale;
}>;

function label(id: string): string {
  return id.replaceAll('_', ' ').toUpperCase();
}

export function RelationshipPanel({ accent, state, npcId, onDismiss, surface, uiScale }: RelationshipPanelProps) {
  const relationship = state.relationships[npcId];
  if (!relationship) return null;
  const visibleFactions = Object.values(state.factions).filter(({ revealed }) => revealed);
  const panelLayout = responsivePanelLayout(surface, uiScale);
  const docked = !panelLayout.compact;
  const metrics = uiMetrics(uiScale);
  const bodyText = { fontSize: metrics.panelText, lineHeight: Math.round(metrics.panelText * 1.45) };
  return (
    <View nativeID="world-ui-relationship-overlay" style={[styles.overlay, docked && styles.overlayDocked]}>
      <View
        accessibilityLabel="Relationship details"
        nativeID="world-ui-relationship-panel"
        style={[
          styles.panel,
          docked && styles.panelDocked,
          {
            borderColor: accent,
            height: docked ? surface.height : panelLayout.height,
            padding: metrics.padding,
            width: docked ? responsiveSideSheetWidth(surface, uiScale) : panelLayout.width,
          },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.identity}>
            <CharacterPortrait displayName={label(relationship.npcId)} npcId={relationship.npcId} />
            <View>
              <Text style={[styles.eyebrow, { fontSize: metrics.secondaryText }]}>SOCIAL RECORD</Text>
              <Text style={[styles.title, { color: accent, fontSize: metrics.titleText }]}>{label(relationship.npcId)}</Text>
              <Text style={[styles.stageHeader, { fontSize: metrics.secondaryText }]}>{label(relationship.stage)}</Text>
            </View>
          </View>
          <Pressable accessibilityLabel="Close relationships" onPress={onDismiss} style={[styles.close, { minHeight: metrics.pointerTarget }]}>
            <Text style={[styles.closeText, { fontSize: metrics.secondaryText }]}>CLOSE</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body} style={styles.bodyScroll}>
        <View style={styles.values}>
          <Text style={[styles.value, bodyText]}>FAMILIARITY {relationship.values.familiarity}</Text>
          <Text style={[styles.value, bodyText]}>TRUST {relationship.values.trust}</Text>
          <Text style={[styles.value, bodyText]}>ATTRACTION {relationship.values.attraction}</Text>
        </View>
        <Text style={[styles.section, bodyText]}>BOUNDARIES AND CIRCUMSTANCES</Text>
        {relationship.rejections.length === 0 ? <Text style={[styles.muted, bodyText]}>NO RECORDED REJECTION</Text> : relationship.rejections.map((record) => (
          <Text key={record.reasonId} style={[record.resolved ? styles.resolved : styles.rejection, bodyText]}>
            {label(record.reasonId)} · {record.kind === 'permanent_boundary' ? 'PERMANENT' : record.resolved ? 'RESOLVED' : 'CHANGEABLE'}
          </Text>
        ))}
        <Text style={[styles.section, bodyText]}>KNOWN FACTIONS</Text>
        {visibleFactions.map((faction) => (
          <Text key={faction.id} style={[styles.faction, bodyText]}>
            {label(faction.id)} · {factionTier(faction.standing).toUpperCase()} · {faction.standing}
          </Text>
        ))}
        {!state.factions.velvet_tide?.revealed ? <Text style={[styles.muted, bodyText]}>OTHER NETWORKS REMAIN HIDDEN</Text> : null}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: 18 },
  bodyScroll: { flex: 1, minHeight: 0 },
  close: { alignSelf: 'flex-start', backgroundColor: '#10130f', borderColor: '#76573d', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  closeText: { color: '#c3b18f', fontFamily: 'Silkscreen', fontSize: 8 },
  eyebrow: { color: '#c89b5e', fontFamily: 'Silkscreen', fontSize: 8 },
  faction: { color: '#9fc58e', fontFamily: 'Silkscreen', fontSize: 9, marginTop: 7 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  identity: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  muted: { color: '#897b67', fontFamily: 'Silkscreen', fontSize: 8, marginTop: 7 },
  overlay: { alignItems: 'center', backgroundColor: '#100d0acc', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0, zIndex: 55 },
  overlayDocked: { alignItems: 'flex-end', backgroundColor: '#090b081f', justifyContent: 'flex-start' },
  panel: { backgroundColor: '#181914f7', borderColor: '#c58b4b', borderWidth: 1 },
  panelDocked: { borderLeftWidth: 3, shadowColor: '#070906', shadowOffset: { height: 8, width: -8 }, shadowOpacity: 0.65, shadowRadius: 0 },
  rejection: { color: '#ef9a69', fontFamily: 'Silkscreen', fontSize: 9, marginTop: 7 },
  resolved: { color: '#79b985', fontFamily: 'Silkscreen', fontSize: 9, marginTop: 7 },
  section: { color: '#d3a04c', fontFamily: 'Silkscreen', fontSize: 9, marginTop: 18 },
  stageHeader: { color: '#9fc58e', fontFamily: 'Silkscreen', marginTop: 5 },
  title: { color: '#f1c65b', fontFamily: 'Silkscreen', fontSize: 18, marginTop: 3 },
  value: { color: '#fff0c7', fontFamily: 'Silkscreen', fontSize: 9 },
  values: { backgroundColor: '#10130f', flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 10, padding: 12 },
});
