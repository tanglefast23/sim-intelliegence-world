import { StyleSheet, Text, View } from 'react-native';

type SelectionMarkerProps = Readonly<{
  color?: string;
  label?: string;
  subtitle?: string;
  viewportWidth: number;
  x: number;
  y: number;
  zoom: number;
}>;

export function SelectionMarker({ color = '#f1c65b', label, subtitle, viewportWidth, x, y }: SelectionMarkerProps) {
  const labelLeft = Math.max(8, Math.min(viewportWidth - 148, x - 70));
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" nativeID="world-selected-character" pointerEvents="none" style={styles.overlay}>
      {label ? (
        <View style={[styles.nameplate, { borderBottomColor: color, left: labelLeft, top: Math.max(8, y - 54) }]}>
          <Text numberOfLines={1} style={styles.name}>{label.toUpperCase()}</Text>
          {subtitle ? <Text numberOfLines={1} style={styles.subtitle}>{subtitle.toUpperCase()}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  name: { color: '#fff0c7', fontFamily: 'Silkscreen', fontSize: 9 },
  nameplate: { alignItems: 'center', backgroundColor: '#10130fe8', borderBottomWidth: 1, paddingHorizontal: 7, paddingVertical: 4, position: 'absolute', width: 140 },
  overlay: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  subtitle: { color: '#9fc58e', fontFamily: 'Silkscreen', fontSize: 7, marginTop: 2 },
});
