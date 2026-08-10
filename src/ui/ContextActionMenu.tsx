import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ContextQuestAction } from '../domain/quests/quest-machine';

type ContextActionMenuProps = Readonly<{
  actions: readonly ContextQuestAction[];
  onAction: (actionId: ContextQuestAction['id']) => void;
}>;

export function ContextActionMenu({ actions, onAction }: ContextActionMenuProps) {
  if (actions.length === 0) return null;
  return (
    <View accessibilityLabel="Linda quest choices" nativeID="world-ui-context-actions" style={styles.panel}>
      <Text style={styles.eyebrow}>CONTEXTUAL CHOICE · EFFECTS PREVIEW</Text>
      {actions.map((action) => (
        <View key={action.id} style={styles.card}>
          <Pressable
            accessibilityLabel={action.label}
            accessibilityHint={[action.readinessSummary, action.result, action.socialConsequence, action.routeConsequence].filter(Boolean).join('. ')}
            disabled={!action.enabled}
            onPress={() => onAction(action.id)}
            style={[styles.button, !action.enabled && styles.buttonDisabled]}
          >
            <Text style={styles.buttonText}>{action.label.toUpperCase()}</Text>
          </Pressable>
          <Text style={styles.line}>YOU DO · {action.cause}</Text>
          {action.readinessSummary ? <Text style={styles.readiness}>{action.readinessSummary}</Text> : null}
          <Text style={styles.line}>RESULT · {action.result}</Text>
          <Text style={styles.social}>SOCIAL · {action.socialConsequence}</Text>
          <Text style={styles.route}>ROUTE · {action.routeConsequence}</Text>
          {action.disabledReason ? <Text style={styles.disabled}>{action.disabledReason.toUpperCase()}</Text> : null}
        </View>
      ))}
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
});
