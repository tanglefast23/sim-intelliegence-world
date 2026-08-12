import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';

type SelectionMarkerProps = Readonly<{
  color?: string;
  label?: string;
  reducedMotion: boolean;
  subtitle?: string;
  viewportWidth: number;
  x: number;
  y: number;
  zoom: number;
}>;

export function SelectionMarker({ color = '#f1c65b', label, reducedMotion, subtitle, viewportWidth, x, y, zoom }: SelectionMarkerProps) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      pulse.setValue(0.5);
      return undefined;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { duration: 900, easing: Easing.inOut(Easing.sin), toValue: 1, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(pulse, { duration: 900, easing: Easing.inOut(Easing.sin), toValue: 0, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse, reducedMotion]);

  const labelLeft = Math.max(8, Math.min(viewportWidth - 148, x - 70));
  const ringScale = Math.min(1.5, zoom);
  const ringWidth = 34 * ringScale;
  const ringHeight = 18 * ringScale;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" nativeID="world-selected-character" pointerEvents="none" style={styles.overlay}>
      <Animated.View
        style={[
          styles.ring,
          {
            borderColor: color,
            height: ringHeight,
            left: x - ringWidth / 2,
            opacity: reducedMotion ? 0.82 : pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.95] }),
            top: y - ringHeight / 2,
            transform: [{ scale: reducedMotion ? 1 : pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
            width: ringWidth,
          },
        ]}
      />
      <View
        style={[
          styles.focusPip,
          { backgroundColor: color, left: x - 3, top: y - 32 * ringScale },
        ]}
      />
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
  focusPip: { borderColor: '#171914', borderWidth: 1, height: 6, position: 'absolute', transform: [{ rotate: '45deg' }], width: 6 },
  name: { color: '#fff0c7', fontFamily: 'Silkscreen', fontSize: 9 },
  nameplate: { alignItems: 'center', backgroundColor: '#10130fe8', borderBottomWidth: 1, paddingHorizontal: 7, paddingVertical: 4, position: 'absolute', width: 140 },
  overlay: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  ring: { borderColor: '#f1c65b', borderRadius: 18, borderWidth: 2, position: 'absolute' },
  subtitle: { color: '#9fc58e', fontFamily: 'Silkscreen', fontSize: 7, marginTop: 2 },
});
