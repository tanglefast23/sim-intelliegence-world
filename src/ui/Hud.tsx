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
  return (
    <>
      <View nativeID="world-ui-hud" style={[styles.hud, { padding: metrics.padding, width: Math.round(294 * uiScale) }]}>
        <Text style={[styles.eyebrow, { fontSize: metrics.secondaryText }]}>{mapName.toUpperCase()}</Text>
        <Text style={[styles.area, { fontSize: metrics.titleText }]}>{areaName}</Text>
        <View style={styles.row}>
          <Text style={[styles.clock, { fontSize: metrics.persistentText }]}>{clockLabel(state.clock.absoluteMinute)}</Text>
          <Text style={[styles.zoom, { fontSize: metrics.secondaryText }]}>{zoom}×</Text>
        </View>
        <View style={[styles.meters, { gap: metrics.gap }]}>
          <Text style={[styles.energy, { fontSize: metrics.secondaryText }]}>ENERGY {state.protagonist.energy}</Text>
          <Text style={[styles.health, { fontSize: metrics.secondaryText }]}>HEALTH {state.protagonist.health}</Text>
          <Text style={[styles.money, { fontSize: metrics.secondaryText }]}>$ {state.inventory.money}</Text>
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
              {speed === 0 ? 'Ⅱ' : `${speed}×`}
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
  area: { color: '#fff0c7', fontFamily: 'Silkscreen', fontSize: 15, marginTop: 2 },
  clock: { color: '#f1c65b', fontFamily: 'Silkscreen', fontSize: 10 },
  energy: { color: '#efc05b', fontFamily: 'Silkscreen', fontSize: 9 },
  eyebrow: { color: '#dfa85e', fontFamily: 'Silkscreen', fontSize: 9 },
  health: { color: '#79b985', fontFamily: 'Silkscreen', fontSize: 9 },
  hud: {
    backgroundColor: '#211d1aee', borderBottomColor: '#ad7640', borderBottomWidth: 2,
    left: 14, paddingHorizontal: 13, paddingVertical: 9, position: 'absolute', top: 0, width: 294,
  },
  meters: { flexDirection: 'row', gap: 12, marginTop: 7 },
  money: { color: '#fff0c7', fontFamily: 'Silkscreen', fontSize: 9 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  savePlate: { backgroundColor: '#211d1ac7', bottom: 42, left: 14, paddingHorizontal: 8, paddingVertical: 5, position: 'absolute' },
  saveText: { color: '#bda77e', fontFamily: 'Silkscreen', fontSize: 8 },
  speedActive: { backgroundColor: '#f1c65b', borderColor: '#fff0c7' },
  speedButton: { alignItems: 'center', borderColor: '#665139', borderWidth: 1, height: 29, justifyContent: 'center', width: 36 },
  speedLabel: { color: '#dfa85e', fontFamily: 'Silkscreen', fontSize: 8, marginRight: 3 },
  speedPlate: { alignItems: 'center', backgroundColor: '#211d1aee', flexDirection: 'row', gap: 4, padding: 5, position: 'absolute', right: 154, top: 12 },
  speedText: { color: '#d6c19a', fontFamily: 'Silkscreen', fontSize: 10 },
  speedTextActive: { color: '#211d1a' },
  zoom: { color: '#bda77e', fontFamily: 'Silkscreen', fontSize: 9 },
});
