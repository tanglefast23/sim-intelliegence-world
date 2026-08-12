import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { WorldState } from '../domain/state/schema';
import type { UiScale } from '../render/responsive-layout';
import { uiMetrics } from './ui-metrics';

function clockLabel(absoluteMinute: number): string {
  const day = Math.floor(absoluteMinute / 1_440) + 1;
  const minuteOfDay = absoluteMinute % 1_440;
  const hours = Math.floor(minuteOfDay / 60).toString().padStart(2, '0');
  const minutes = (minuteOfDay % 60).toString().padStart(2, '0');
  return `DAY ${day} · ${hours}:${minutes}`;
}

type HudProps = Readonly<{
  state: WorldState;
  mapName: string;
  areaName: string;
  zoom: number;
  saveStatus: string;
  uiScale: UiScale;
  onSpeed: (speed: 0 | 1 | 2) => void;
}>;

export function Hud({ state, mapName, areaName, zoom, saveStatus, uiScale, onSpeed }: HudProps) {
  const metrics = uiMetrics(uiScale);
  const energyWidth = `${Math.max(0, Math.min(100, state.protagonist.energy))}%` as `${number}%`;
  const healthWidth = `${Math.max(0, Math.min(100, state.protagonist.health))}%` as `${number}%`;
  return (
    <>
      <View nativeID="world-ui-hud" style={[styles.hud, { padding: metrics.padding, width: Math.round(294 * uiScale) }]}>
        <View style={styles.locationRow}>
          <View>
            <Text style={[styles.eyebrow, { fontSize: metrics.secondaryText }]}>{mapName.toUpperCase()}</Text>
            <Text style={[styles.area, { fontSize: metrics.titleText }]}>{areaName}</Text>
          </View>
          <View style={styles.locationMark} />
        </View>
        <View style={styles.row}>
          <Text style={[styles.clock, { fontSize: metrics.persistentText }]}>{clockLabel(state.clock.absoluteMinute)}</Text>
          <Text style={[styles.money, { fontSize: metrics.persistentText }]}>${state.inventory.money}</Text>
        </View>
        <View style={[styles.meters, { gap: metrics.gap }]}>
          <View style={styles.meter}>
            <View style={styles.meterHeader}>
              <Text style={[styles.meterLabel, { fontSize: metrics.secondaryText }]}>ENERGY</Text>
              <Text style={[styles.meterValue, { fontSize: metrics.secondaryText }]}>{state.protagonist.energy}</Text>
            </View>
            <View style={styles.track}><View style={[styles.fillEnergy, { width: energyWidth }]} /></View>
          </View>
          <View style={styles.meter}>
            <View style={styles.meterHeader}>
              <Text style={[styles.meterLabel, { fontSize: metrics.secondaryText }]}>HEALTH</Text>
              <Text style={[styles.meterValue, { fontSize: metrics.secondaryText }]}>{state.protagonist.health}</Text>
            </View>
            <View style={styles.track}><View style={[styles.fillHealth, { width: healthWidth }]} /></View>
          </View>
        </View>
        <View style={styles.hudFooter}>
          <Text style={[styles.resident, { fontSize: metrics.secondaryText }]}>{state.protagonist.displayName.toUpperCase()}</Text>
          <Text style={[styles.zoom, { fontSize: metrics.secondaryText }]}>VIEW {Math.round(zoom * 100)}%</Text>
        </View>
      </View>
      <View nativeID="world-ui-speed" style={[styles.speedPlate, { right: 24 + metrics.pointerTarget * 3 + metrics.gap * 2 }]}>
        <Text style={[styles.speedLabel, { fontSize: metrics.secondaryText }]}>TIME</Text>
        {([0, 1, 2] as const).map((speed) => (
          <Pressable
            accessibilityLabel={speed === 0 ? 'Pause time' : `Set ${speed}x time`}
            key={speed}
            onPress={() => onSpeed(speed)}
            style={[
              styles.speedButton,
              { height: metrics.pointerTarget, width: metrics.pointerTarget },
              state.clock.selectedSpeed === speed && styles.speedActive,
            ]}
          >
            <Text style={[styles.speedText, { fontSize: metrics.secondaryText }, state.clock.selectedSpeed === speed && styles.speedTextActive]}>
              {speed === 0 ? 'II' : `${speed}×`}
            </Text>
          </Pressable>
        ))}
      </View>
      <View pointerEvents="none" style={styles.savePlate}>
        <Text nativeID="world-save-status" style={[styles.saveText, { fontSize: metrics.secondaryText }]}>{saveStatus.toUpperCase()}</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  area: { color: '#fff0c7', fontFamily: 'Georgia', fontWeight: '700', marginTop: 1 },
  clock: { color: '#f1c65b', fontFamily: 'Silkscreen' },
  eyebrow: { color: '#dfa85e', fontFamily: 'Silkscreen' },
  fillEnergy: { backgroundColor: '#d9ad56', bottom: 0, left: 0, position: 'absolute', top: 0 },
  fillHealth: { backgroundColor: '#74a97b', bottom: 0, left: 0, position: 'absolute', top: 0 },
  hud: {
    backgroundColor: '#181914f2', borderBottomColor: '#ad7640', borderBottomWidth: 2,
    borderLeftColor: '#d3a04c', borderLeftWidth: 3, left: 14, position: 'absolute', top: 0,
  },
  hudFooter: { borderTopColor: '#514838', borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 9, paddingTop: 6 },
  locationMark: { backgroundColor: '#f1c65b', height: 4, marginTop: 4, width: 22 },
  locationRow: { flexDirection: 'row', justifyContent: 'space-between' },
  meter: { flex: 1 },
  meterHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  meterLabel: { color: '#bda77e', fontFamily: 'Silkscreen' },
  meterValue: { color: '#fff0c7', fontFamily: 'Silkscreen' },
  meters: { flexDirection: 'row', marginTop: 8 },
  money: { color: '#fff0c7', fontFamily: 'Silkscreen' },
  resident: { color: '#d6c19a', fontFamily: 'Silkscreen' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  savePlate: { backgroundColor: '#181914e8', borderLeftColor: '#ad7640', borderLeftWidth: 2, bottom: 42, left: 14, paddingHorizontal: 8, paddingVertical: 5, position: 'absolute' },
  saveText: { color: '#bda77e', fontFamily: 'Silkscreen' },
  speedActive: { backgroundColor: '#f1c65b', borderColor: '#fff0c7' },
  speedButton: { alignItems: 'center', borderColor: '#665139', borderWidth: 1, justifyContent: 'center' },
  speedLabel: { color: '#dfa85e', fontFamily: 'Silkscreen', marginRight: 3 },
  speedPlate: { alignItems: 'center', backgroundColor: '#181914f2', borderTopColor: '#ad7640', borderTopWidth: 2, flexDirection: 'row', gap: 4, padding: 5, position: 'absolute', top: 12 },
  speedText: { color: '#d6c19a', fontFamily: 'Silkscreen' },
  speedTextActive: { color: '#211d1a' },
  track: { backgroundColor: '#3b372d', height: 4, marginTop: 3, overflow: 'hidden' },
  zoom: { color: '#bda77e', fontFamily: 'Silkscreen' },
});
