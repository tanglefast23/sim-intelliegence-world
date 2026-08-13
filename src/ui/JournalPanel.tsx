import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { WorldState } from '../domain/state/schema';
import type { ViewportSize } from '../render/camera';
import { responsivePanelLayout, responsiveSideSheetWidth, type UiScale } from '../render/responsive-layout';
import { CharacterPortrait } from './CharacterPortrait';
import { uiMetrics } from './ui-metrics';

type JournalPanelProps = Readonly<{
  accent: string;
  state: WorldState;
  onDismiss: () => void;
  onPurchaseSecurityReport: () => void;
  onAdvancePolice: () => void;
  surface: ViewportSize;
  uiScale: UiScale;
}>;

function label(id: string): string {
  return id.replaceAll('_', ' ').toUpperCase();
}

function timeLabel(absoluteMinute: number): string {
  const day = Math.floor(absoluteMinute / 1_440) + 1;
  const time = absoluteMinute % 1_440;
  return `DAY ${day} ${Math.floor(time / 60).toString().padStart(2, '0')}:${(time % 60).toString().padStart(2, '0')}`;
}

function sourceLabel(source: WorldState['journal'][string]['source']): string {
  return `${source.type.replaceAll('_', ' ')} · ${label(source.sourceId)}`;
}

function locationLabel(entry: WorldState['journal'][string]): string {
  if (entry.locationPrecision === 'exact') return label(entry.locationId ?? 'confirmed location');
  return entry.locationPrecision === 'vague' ? 'SEARCH AREA' : 'LOCATION UNKNOWN';
}

function caseContact(entry: WorldState['journal'][string]): Readonly<{ id: string; name: string }> {
  return entry.subject.kind === 'quest' && entry.subject.questId === 'linda_boyfriend_check'
    ? { id: 'linda', name: 'LINDA' }
    : { id: entry.source.sourceId, name: label(entry.source.sourceId) };
}

export function JournalPanel({ accent, state, onDismiss, onPurchaseSecurityReport, onAdvancePolice, surface, uiScale }: JournalPanelProps) {
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
  const panelLayout = responsivePanelLayout(surface, uiScale);
  const docked = !panelLayout.compact;
  const metrics = uiMetrics(uiScale);
  const bodyText = { fontSize: metrics.panelText, lineHeight: Math.round(metrics.panelText * 1.45) };
  return (
    <View nativeID="world-ui-journal-overlay" style={[styles.overlay, docked && styles.overlayDocked]}>
      <View
        accessibilityLabel="Lead journal"
        nativeID="world-ui-journal-panel"
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
          <View>
            <Text style={[styles.eyebrow, { fontSize: metrics.secondaryText }]}>PRIVATE CASEBOARD</Text>
            <Text style={[styles.title, { color: accent, fontSize: metrics.titleText }]}>JOURNAL</Text>
          </View>
          <Pressable accessibilityLabel="Close journal" onPress={onDismiss} style={[styles.close, { minHeight: metrics.pointerTarget }]}>
            <Text style={[styles.closeText, { fontSize: metrics.secondaryText }]}>CLOSE</Text>
          </Pressable>
        </View>
        <View style={styles.summary}>
          <View style={styles.summaryItem}><Text style={[styles.summaryValue, bodyText]}>{entries.length}</Text><Text style={[styles.summaryLabel, { fontSize: metrics.secondaryText }]}>LEADS</Text></View>
          <View style={styles.summaryItem}><Text style={[styles.summaryValue, bodyText]}>{invitations.length}</Text><Text style={[styles.summaryLabel, { fontSize: metrics.secondaryText }]}>VISITS</Text></View>
          <View style={styles.summaryItem}><Text style={[styles.summaryValue, bodyText]}>{Object.keys(state.evidence).length}</Text><Text style={[styles.summaryLabel, { fontSize: metrics.secondaryText }]}>EVIDENCE</Text></View>
        </View>
        <ScrollView contentContainerStyle={styles.body} style={styles.bodyScroll}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.section, bodyText]}>ACTIVE LEADS</Text>
          <Text style={[styles.caseNumber, { fontSize: metrics.secondaryText }]}>CASE 01 · HALCYRA</Text>
        </View>
        {lindaQuest ? <Text style={[styles.detail, bodyText]}>LINDA QUEST · {lindaQuest.status.toUpperCase()}</Text> : null}
        {entries.length === 0 ? <Text style={[styles.muted, bodyText]}>NO VALIDATED LEADS YET</Text> : entries.map((entry, index) => {
          const contact = caseContact(entry);
          return <View key={entry.id} style={[styles.card, { borderLeftColor: accent }]}>
            <View style={[styles.casePin, { backgroundColor: accent }]} />
            <Text style={[styles.leadIndex, { color: accent }]}>LEAD {String(index + 1).padStart(2, '0')}</Text>
            <View style={styles.leadHeader}>
              <View>
                <CharacterPortrait displayName={contact.name} npcId={contact.id} />
                <Text style={[styles.contactLabel, { backgroundColor: accent }]}>{contact.name}</Text>
              </View>
              <View style={styles.leadIdentity}>
                <Text style={[styles.source, { fontSize: metrics.secondaryText }]}>REQUESTED BY {contact.name}</Text>
                <Text style={styles.sourceProof}>{sourceLabel(entry.source)}</Text>
                <Text style={[styles.cardTitle, bodyText]}>{entry.summary.toUpperCase()}</Text>
                <View style={styles.stamps}>
                  <Text style={[styles.stamp, { borderColor: accent, color: accent }]}>{entry.resolutionState.toUpperCase()}</Text>
                  <Text style={styles.stamp}>{entry.locationPrecision.toUpperCase()}</Text>
                </View>
              </View>
            </View>
            <View style={styles.evidenceConnector} />
            <View style={styles.leadEvidence}>
              <View style={styles.locationThumbnail}>
                <View style={styles.thumbnailStreet} />
                <View style={styles.thumbnailBuilding} />
                <View style={[styles.thumbnailPin, { backgroundColor: accent }]} />
                <Text style={styles.thumbnailLabel}>{locationLabel(entry)}</Text>
              </View>
              <View style={styles.leadMeta}>
                <Text style={[styles.metaLabel, { fontSize: metrics.secondaryText }]}>LOCATION</Text>
                <Text style={[styles.detail, bodyText]}>{locationLabel(entry)}{entry.markerVisible ? ' · PINNED' : ''}</Text>
                <Text style={[styles.metaLabel, { fontSize: metrics.secondaryText }]}>DEADLINE</Text>
                <Text style={[entry.deadlineMinute === undefined ? styles.muted : styles.deadline, bodyText]}>
                  {entry.deadlineMinute === undefined ? 'OPEN-ENDED · NO DEADLINE' : timeLabel(entry.deadlineMinute)}
                </Text>
              </View>
            </View>
            <View style={styles.consequenceRow}>
              <Text style={styles.consequenceLabel}>CONSEQUENCES</Text>
              {([
                ['R', label(state.relationships[contact.id]?.stage ?? 'unknown')],
                ['P', state.policeAttention.toUpperCase()],
                ['E', String(Object.keys(state.evidence).length)],
              ] as const).map(([icon, value]) => (
                <View key={icon} style={styles.consequenceStamp}>
                  <Text style={[styles.consequenceIcon, { backgroundColor: accent }]}>{icon}</Text>
                  <Text style={styles.consequenceText}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
        })}
        <Text style={[styles.section, bodyText]}>HOME INVITATIONS</Text>
        {invitations.length === 0 ? <Text style={[styles.muted, bodyText]}>NO VISITS SCHEDULED</Text> : invitations.map((invitation) => (
          <Text key={invitation.id} style={[styles.detail, bodyText]}>
            {label(invitation.npcId)} · {invitation.status.toUpperCase()}
            {invitation.scheduledMinute !== undefined ? ` · ${timeLabel(invitation.scheduledMinute)}` : ''}
            {invitation.counterProposedMinute !== undefined ? ` · COUNTER ${timeLabel(invitation.counterProposedMinute)}` : ''}
          </Text>
        ))}
        <Text style={[styles.section, bodyText]}>OPTIONAL PREPARATION</Text>
        <Pressable
          accessibilityLabel="Buy villa security report"
          disabled={purchased || state.inventory.money < 60}
          onPress={onPurchaseSecurityReport}
          style={[styles.purchase, { minHeight: metrics.pointerTarget }, purchased && styles.purchaseDone]}
        >
          <Text style={[styles.purchaseText, bodyText]}>{purchased ? 'SECURITY REPORT PURCHASED' : 'BUY VILLA SECURITY REPORT · $60'}</Text>
        </Pressable>
        <Text style={[styles.section, bodyText]}>CONSEQUENCES</Text>
        <Text style={[styles.detail, bodyText]}>POLICE · {state.policeAttention.toUpperCase()}</Text>
        <Text style={[styles.detail, bodyText]}>EVIDENCE · {Object.keys(state.evidence).length}</Text>
        {policeAction ? (
          <Pressable accessibilityLabel={policeAction.label} onPress={onAdvancePolice} style={[styles.policeAction, { minHeight: metrics.pointerTarget }]}>
            <Text style={[styles.purchaseText, bodyText]}>{policeAction.label.toUpperCase()}</Text>
            <Text style={[styles.detail, bodyText]}>{policeAction.result}</Text>
          </Pressable>
        ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#10130f', borderLeftColor: '#d3a04c', borderLeftWidth: 3, marginTop: 8, padding: 10 },
  body: { paddingBottom: 18 },
  bodyScroll: { flex: 1, minHeight: 0 },
  cardTitle: { color: '#fff0c7', fontFamily: 'Silkscreen', fontSize: 9 },
  caseNumber: { color: '#756a58', fontFamily: 'Silkscreen' },
  casePin: { borderColor: '#fff0c7', borderRadius: 4, borderWidth: 1, height: 8, position: 'absolute', right: 9, top: 9, width: 8 },
  close: { backgroundColor: '#10130f', borderColor: '#76573d', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  closeText: { color: '#c3b18f', fontFamily: 'Silkscreen', fontSize: 8 },
  detail: { color: '#bda77e', fontFamily: 'Silkscreen', fontSize: 8, marginTop: 6 },
  deadline: { color: '#f0b36c', fontFamily: 'Silkscreen', marginTop: 4 },
  evidenceConnector: { borderLeftColor: '#5b4d3a', borderLeftWidth: 1, height: 10, marginLeft: 40 },
  eyebrow: { color: '#c89b5e', fontFamily: 'Silkscreen', fontSize: 8 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  muted: { color: '#897b67', fontFamily: 'Silkscreen', fontSize: 8, marginTop: 7 },
  consequenceLabel: { color: '#827561', fontFamily: 'Silkscreen', fontSize: 7, marginRight: 'auto' },
  consequenceIcon: { color: '#171914', fontFamily: 'Silkscreen', fontSize: 6, paddingHorizontal: 3, paddingVertical: 2 },
  consequenceRow: { alignItems: 'center', borderTopColor: '#40382d', borderTopWidth: 1, flexDirection: 'row', gap: 4, marginTop: 10, paddingTop: 8 },
  consequenceStamp: { alignItems: 'center', borderColor: '#594b3a', borderWidth: 1, flexDirection: 'row', gap: 3, padding: 2 },
  consequenceText: { color: '#b79c76', fontFamily: 'Silkscreen', fontSize: 6 },
  contactLabel: { color: '#171914', fontFamily: 'Silkscreen', fontSize: 6, marginTop: -16, paddingVertical: 3, position: 'relative', textAlign: 'center' },
  leadEvidence: { flexDirection: 'row', gap: 10, marginTop: 10 },
  leadHeader: { flexDirection: 'row', gap: 10 },
  leadIdentity: { flex: 1, minWidth: 0 },
  leadIndex: { fontFamily: 'Silkscreen', fontSize: 6, position: 'absolute', right: 22, top: 10 },
  leadMeta: { flex: 1, minWidth: 0 },
  locationThumbnail: { backgroundColor: '#292820', borderColor: '#5d513e', borderWidth: 1, height: 74, overflow: 'hidden', position: 'relative', width: 118 },
  metaLabel: { color: '#746957', fontFamily: 'Silkscreen', marginTop: 1 },
  overlay: { alignItems: 'center', backgroundColor: '#100d0acc', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0, zIndex: 55 },
  overlayDocked: { alignItems: 'flex-end', backgroundColor: '#090b081f', justifyContent: 'flex-start' },
  panel: { backgroundColor: '#181914f7', borderColor: '#c58b4b', borderWidth: 1 },
  panelDocked: { borderLeftWidth: 3, shadowColor: '#070906', shadowOffset: { height: 8, width: -8 }, shadowOpacity: 0.65, shadowRadius: 0 },
  policeAction: { backgroundColor: '#4b2d2d', borderColor: '#d3765d', borderWidth: 1, marginTop: 8, padding: 10 },
  purchase: { alignItems: 'center', backgroundColor: '#6f4931', borderColor: '#d6a45d', borderWidth: 1, marginTop: 8, padding: 10 },
  purchaseDone: { backgroundColor: '#324a37' },
  purchaseText: { color: '#fff0c7', fontFamily: 'Silkscreen', fontSize: 8 },
  section: { color: '#d3a04c', fontFamily: 'Silkscreen', fontSize: 9, marginTop: 16 },
  sectionHeader: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between' },
  source: { color: '#8f826d', fontFamily: 'Silkscreen', marginBottom: 6 },
  sourceProof: { color: '#655d4f', fontFamily: 'Silkscreen', fontSize: 6, marginBottom: 5 },
  stamp: { borderColor: '#665139', borderWidth: 1, color: '#bda77e', fontFamily: 'Silkscreen', fontSize: 6, paddingHorizontal: 5, paddingVertical: 3 },
  stamps: { flexDirection: 'row', gap: 4, marginTop: 8 },
  summary: { backgroundColor: '#10130f', borderColor: '#514838', borderWidth: 1, flexDirection: 'row', marginTop: 14, paddingVertical: 8 },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryLabel: { color: '#8f826d', fontFamily: 'Silkscreen', fontSize: 8, marginTop: 1 },
  summaryValue: { color: '#fff0c7', fontFamily: 'Georgia', fontWeight: '700' },
  thumbnailBuilding: { backgroundColor: '#8b6845', height: 30, left: 12, position: 'absolute', top: 12, width: 42 },
  thumbnailLabel: { backgroundColor: '#10130fdd', bottom: 0, color: '#d6c19a', fontFamily: 'Silkscreen', fontSize: 6, left: 0, padding: 4, position: 'absolute', right: 0 },
  thumbnailPin: { borderColor: '#fff0c7', borderRadius: 5, borderWidth: 1, height: 10, position: 'absolute', right: 20, top: 19, width: 10 },
  thumbnailStreet: { backgroundColor: '#48453b', height: 16, position: 'absolute', right: -8, top: 31, transform: [{ rotate: '-24deg' }], width: 84 },
  title: { color: '#f1c65b', fontFamily: 'Silkscreen', fontSize: 18, marginTop: 3 },
});
