import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

import { worldAtmosphere } from './atmosphere';

type AtmosphereOverlayProps = Readonly<{
  absoluteMinute: number;
  reducedMotion: boolean;
}>;

const MOTES = [
  { left: '18%', top: '24%' },
  { left: '36%', top: '64%' },
  { left: '58%', top: '31%' },
  { left: '74%', top: '53%' },
  { left: '87%', top: '18%' },
] as const;

export function AtmosphereOverlay({ absoluteMinute, reducedMotion }: AtmosphereOverlayProps) {
  const atmosphere = worldAtmosphere(absoluteMinute);
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      drift.setValue(0.35);
      return undefined;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(drift, { duration: 3_800, easing: Easing.inOut(Easing.sin), toValue: 1, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(drift, { duration: 4_600, easing: Easing.inOut(Easing.sin), toValue: 0, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [drift, reducedMotion]);

  const moteOpacity = drift.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.72] });
  const moteShift = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });

  return (
    <View
      accessibilityLabel={`${atmosphere.period} atmosphere`}
      nativeID="world-atmosphere"
      pointerEvents="none"
      style={styles.overlay}
    >
      <View style={[styles.wash, { backgroundColor: atmosphere.wash }]} />
      <View style={[styles.horizon, { backgroundColor: atmosphere.horizon }]} />
      <View style={[styles.topShade, { backgroundColor: atmosphere.shade }]} />
      <View style={[styles.bottomShade, { backgroundColor: atmosphere.shade }]} />
      <View style={[styles.leftShade, { backgroundColor: atmosphere.shade }]} />
      <View style={[styles.rightShade, { backgroundColor: atmosphere.shade }]} />
      {MOTES.map((mote) => (
        <Animated.View
          key={`${mote.left}-${mote.top}`}
          style={[
            styles.mote,
            {
              backgroundColor: atmosphere.accent,
              left: mote.left,
              opacity: reducedMotion ? 0.28 : moteOpacity,
              top: mote.top,
              transform: [{ translateY: reducedMotion ? 0 : moteShift }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomShade: { bottom: 0, height: 22, left: 0, opacity: 0.34, position: 'absolute', right: 0 },
  horizon: { height: '28%', left: 0, position: 'absolute', right: 0, top: 0 },
  leftShade: { bottom: 0, left: 0, opacity: 0.18, position: 'absolute', top: 0, width: 16 },
  mote: { height: 2, position: 'absolute', width: 2 },
  overlay: { bottom: 0, left: 0, overflow: 'hidden', position: 'absolute', right: 0, top: 0 },
  rightShade: { bottom: 0, opacity: 0.18, position: 'absolute', right: 0, top: 0, width: 16 },
  topShade: { height: 16, left: 0, opacity: 0.25, position: 'absolute', right: 0, top: 0 },
  wash: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
});
