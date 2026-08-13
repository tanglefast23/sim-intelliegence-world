import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ContextQuestAction } from '../domain/quests/quest-machine';
import type { ViewportSize } from '../render/camera';
import type { UiScale } from '../render/responsive-layout';
import { uiMetrics } from './ui-metrics';

type ContextActionMenuProps = Readonly<{
  actions: readonly ContextQuestAction[];
  onAction: (actionId: ContextQuestAction['id']) => void;
  surface: ViewportSize;
  uiScale: UiScale;
}>;

export function ContextActionMenu({ actions, onAction, surface, uiScale }: ContextActionMenuProps) {
  if (actions.length === 0) return null;
  const metrics = uiMetrics(uiScale);
  const top = 40 + metrics.pointerTarget * 3;
  return (
    <View
      accessibilityLabel="Context choices"
      nativeID="world-ui-context-actions"
      style={[
        styles.panel,
        {
          maxHeight: Math.max(160, surface.height - top - 64),
          padding: metrics.padding,
          top,
          width: Math.min(Math.round(330 * uiScale), surface.width - 24),
        },
      ]}
    >
      <Text style={[styles.eyebrow, { fontSize: metrics.secondaryText }]}>CONTEXTUAL CHOICE · EFFECTS PREVIEW</Text>
      <ScrollView contentContainerStyle={styles.scrollContent}>
      {actions.map((action) => (
        <View key={action.id} style={[styles.card, { gap: metrics.gap, padding: metrics.padding }]}>
          <Pressable
            accessibilityLabel={action.label}
            accessibilityHint={[action.readinessSummary, action.result, action.socialConsequence, action.routeConsequence].filter(Boolean).join('. ')}
            disabled={!action.enabled}
            onPress={() => onAction(action.id)}
            style={[styles.button, { minHeight: metrics.pointerTarget }, !action.enabled && styles.buttonDisabled]}
          >
            <Text style={[styles.buttonText, { fontSize: metrics.secondaryText }]}>{action.label.toUpperCase()}</Text>
          </Pressable>
          <Text style={[styles.line, { fontSize: metrics.secondaryText }]}>YOU DO · {action.cause}</Text>
          {action.readinessSummary ? <Text style={[styles.readiness, { fontSize: metrics.secondaryText }]}>{action.readinessSummary}</Text> : null}
          <Text style={[styles.line, { fontSize: metrics.secondaryText }]}>RESULT · {action.result}</Text>
          <Text style={[styles.social, { fontSize: metrics.secondaryText }]}>SOCIAL · {action.socialConsequence}</Text>
          <Text style={[styles.route, { fontSize: metrics.secondaryText }]}>ROUTE · {action.routeConsequence}</Text>
          {action.disabledReason ? <Text style={[styles.disabled, { fontSize: metrics.secondaryText }]}>{action.disabledReason.toUpperCase()}</Text> : null}
        </View>
      ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  button: { backgroundColor: '#75452f', borderColor: '#e0ad5c', borderWidth: 1, paddingHorizontal: 8, paddingVertical: 6 },
  buttonDisabled: { backgroundColor: '#3a342d', borderColor: '#665f55' },
  buttonText: { color: '#fff0c7', fontFamily: 'Silkscreen', fontSize: 8 },
  card: { backgroundColor: '#1a1612ee', borderLeftColor: '#c58b4b', borderLeftWidth: 2, gap: 3, marginTop: 6, padding: 7 },
  disabled: { color: '#e07a62', fontFamily: 'Silkscreen', fontSize: 7 },
  eyebrow: { color: '#f1c65b', fontFamily: 'Silkscreen', fontSize: 8 },
  line: { color: '#c3b18f', fontFamily: 'Silkscreen', fontSize: 7 },
  panel: { backgroundColor: '#252019f2', borderColor: '#9c6a3d', borderWidth: 1, maxHeight: 520, padding: 10, position: 'absolute', right: 12, top: 102, width: 330, zIndex: 32 },
  route: { color: '#d6a45d', fontFamily: 'Silkscreen', fontSize: 7 },
  readiness: { color: '#f1c65b', fontFamily: 'Silkscreen', fontSize: 7 },
  social: { color: '#8fc59a', fontFamily: 'Silkscreen', fontSize: 7 },
  scrollContent: { paddingBottom: 2 },
});
