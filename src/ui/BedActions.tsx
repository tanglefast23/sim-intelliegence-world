import { Pressable, StyleSheet, Text, View } from 'react-native';

type BedActionsProps = Readonly<{
  minuteOfDay: number;
  disabled: boolean;
  onSleep: (mode: 'nap' | 'overnight') => void;
}>;

export function BedActions({ minuteOfDay, disabled, onSleep }: BedActionsProps) {
  const overnightAvailable = minuteOfDay >= 20 * 60;
  return (
    <View nativeID="world-ui-bed" style={styles.plate}>
      <Text style={styles.eyebrow}>BED</Text>
      <Pressable
        accessibilityLabel="Nap for two hours"
        disabled={disabled}
        onPress={() => onSleep('nap')}
        style={[styles.button, disabled && styles.disabled]}
      >
        <Text style={styles.text}>NAP · 2 HOURS · +25</Text>
      </Pressable>
      <Pressable
        accessibilityLabel={overnightAvailable ? 'Sleep until 8 AM' : 'Sleep is available after 8 PM'}
        disabled={disabled || !overnightAvailable}
        onPress={() => onSleep('overnight')}
        style={[styles.button, (!overnightAvailable || disabled) && styles.disabled]}
      >
        <Text style={styles.text}>{overnightAvailable ? 'SLEEP TO 08:00 · +80' : 'SLEEP · AFTER 20:00'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  button: { borderColor: '#ad7640', borderTopWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  disabled: { opacity: 0.38 },
  eyebrow: { color: '#dfa85e', fontFamily: 'Silkscreen', fontSize: 9, paddingHorizontal: 10, paddingVertical: 7 },
  plate: { backgroundColor: '#211d1aee', borderColor: '#ad7640', borderWidth: 2, bottom: 48, position: 'absolute', right: 12, width: 198 },
  text: { color: '#fff0c7', fontFamily: 'Silkscreen', fontSize: 9 },
});
