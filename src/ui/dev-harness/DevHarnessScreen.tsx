import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ViewportSize } from '../../render/camera';
import { DEV_HARNESS_ENTRIES, type DevHarnessEntry } from './registry';
import {
  devHarnessGroups,
  formatDevHarnessHash,
  resolveDevHarnessRoute,
  resolvedDevHarnessRoute,
} from './route';
import { useHarnessHash } from './use-harness-hash';

export function DevHarnessScreen({ surface }: Readonly<{ surface: ViewportSize }>) {
  const { route, push, replace } = useHarnessHash();
  const resolution = useMemo(
    () => resolveDevHarnessRoute(DEV_HARNESS_ENTRIES, route),
    [route],
  );
  const resolvedHash = formatDevHarnessHash(resolvedDevHarnessRoute(resolution));

  useEffect(() => {
    if (formatDevHarnessHash(route) !== resolvedHash) {
      replace(resolvedDevHarnessRoute(resolution));
    }
  }, [replace, resolution, resolvedHash, route]);

  if (resolution.kind === 'menu') {
    return (
      <DevHarnessMenu
        entries={DEV_HARNESS_ENTRIES}
        onOpen={(entry) => push({ entryId: entry.id, caseId: entry.cases[0]?.id })}
        surface={surface}
      />
    );
  }

  const entry = DEV_HARNESS_ENTRIES.find((candidate) => candidate.id === resolution.entryId);
  if (!entry) return null;
  return (
    <DevHarnessHost
      caseId={resolution.caseId}
      entry={entry}
      key={`${entry.id}:${resolution.caseId}`}
      onMenu={() => push({})}
      onSelectCase={(caseId) => push({ entryId: entry.id, caseId })}
      surface={surface}
    />
  );
}

function DevHarnessMenu({
  entries,
  onOpen,
  surface,
}: Readonly<{
  entries: readonly DevHarnessEntry[];
  onOpen: (entry: DevHarnessEntry) => void;
  surface: ViewportSize;
}>) {
  const groups = useMemo(() => devHarnessGroups(entries), [entries]);
  return (
    <View nativeID="dev-harness-menu" style={[styles.menuRoot, surface]}>
      <ScrollView contentContainerStyle={styles.menuContent}>
        <Text accessibilityRole="header" style={styles.menuTitle}>SI WORLD DEV HARNESS</Text>
        <Text style={styles.menuBlurb}>
          Open a real game view immediately. This disposable mode never loads or writes slot-001.
        </Text>
        {groups.map((group) => (
          <View key={group.name} style={styles.group}>
            <Text style={styles.groupName}>{group.name.toUpperCase()}</Text>
            {group.entries.map((entry) => (
              <Pressable
                accessibilityLabel={`Open ${entry.title}: ${entry.summary}`}
                accessibilityRole="button"
                key={entry.id}
                onPress={() => onOpen(entry)}
                style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}
              >
                <Text style={styles.menuRowTitle}>{entry.title.toUpperCase()}</Text>
                <Text style={styles.menuRowSummary}>{entry.summary}</Text>
                <Text style={styles.menuRowId}>#/dev/{entry.id} · {entry.cases.length} CASE{entry.cases.length === 1 ? '' : 'S'}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function HarnessButton({
  label,
  onPress,
  selected = false,
}: Readonly<{ label: string; onPress: () => void; selected?: boolean }>) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, selected && styles.buttonSelected, pressed && styles.pressed]}
    >
      <Text style={[styles.buttonText, selected && styles.buttonTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function DevHarnessHost({
  caseId,
  entry,
  onMenu,
  onSelectCase,
  surface,
}: Readonly<{
  caseId: string;
  entry: DevHarnessEntry;
  onMenu: () => void;
  onSelectCase: (caseId: string) => void;
  surface: ViewportSize;
}>) {
  const [barVisible, setBarVisible] = useState(true);
  const [resetGeneration, setResetGeneration] = useState(0);
  const activeCase = entry.cases.find((candidate) => candidate.id === caseId);
  return (
    <View nativeID="dev-harness-entry" style={[styles.hostRoot, surface]}>
      <View key={resetGeneration} style={styles.feature}>{entry.render(caseId, surface)}</View>
      <View pointerEvents="box-none" style={[styles.barAnchor, { maxWidth: Math.max(360, surface.width - 180) }]}>
        {barVisible ? (
          <View style={styles.bar}>
            <View style={styles.barRow}>
              <HarnessButton label="◂ MENU" onPress={onMenu} />
              <HarnessButton label="RESET" onPress={() => setResetGeneration((value) => value + 1)} />
              <HarnessButton label="HIDE" onPress={() => setBarVisible(false)} />
              <Text numberOfLines={1} style={styles.barTitle}>{entry.title.toUpperCase()}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.barRow}>
                {entry.cases.map((entryCase) => (
                  <HarnessButton
                    key={entryCase.id}
                    label={entryCase.label}
                    onPress={() => onSelectCase(entryCase.id)}
                    selected={entryCase.id === caseId}
                  />
                ))}
              </View>
            </ScrollView>
            <Text nativeID="dev-harness-case-title" style={styles.barNote}>
              {activeCase?.note ?? `#/dev/${entry.id}/${caseId}`}
            </Text>
          </View>
        ) : (
          <HarnessButton label="DEV ▾" onPress={() => setBarVisible(true)} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: '#181512f2', borderBottomColor: '#f1c65b', borderBottomWidth: 2, borderRightColor: '#f1c65b', borderRightWidth: 2, gap: 6, padding: 8 },
  barAnchor: { left: 0, paddingTop: 8, position: 'absolute', top: 0, zIndex: 80 },
  barNote: { color: '#9a8b73', fontFamily: 'Silkscreen', fontSize: 8 },
  barRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  barTitle: { color: '#fff0c7', flexShrink: 1, fontFamily: 'Silkscreen', fontSize: 9 },
  button: { alignItems: 'center', backgroundColor: '#332a21', borderColor: '#76573d', borderWidth: 1, justifyContent: 'center', minHeight: 34, paddingHorizontal: 9 },
  buttonSelected: { backgroundColor: '#f1c65b', borderColor: '#fff0c7' },
  buttonText: { color: '#d6c19a', fontFamily: 'Silkscreen', fontSize: 8 },
  buttonTextSelected: { color: '#211d1a' },
  feature: { flex: 1 },
  group: { gap: 8 },
  groupName: { color: '#d3a04c', fontFamily: 'Silkscreen', fontSize: 9 },
  hostRoot: { backgroundColor: '#17201b', overflow: 'hidden' },
  menuBlurb: { color: '#bda77e', fontFamily: 'Silkscreen', fontSize: 10, lineHeight: 18, maxWidth: 760 },
  menuContent: { gap: 16, padding: 24, paddingBottom: 40 },
  menuRoot: { backgroundColor: '#211d1a' },
  menuRow: { backgroundColor: '#2d261f', borderColor: '#76573d', borderWidth: 2, gap: 5, minHeight: 82, padding: 13 },
  menuRowId: { color: '#8c7a63', fontFamily: 'Silkscreen', fontSize: 8 },
  menuRowSummary: { color: '#d6c19a', fontFamily: 'Silkscreen', fontSize: 10, lineHeight: 17 },
  menuRowTitle: { color: '#fff0c7', fontFamily: 'Silkscreen', fontSize: 12 },
  menuTitle: { color: '#f1c65b', fontFamily: 'Silkscreen', fontSize: 20 },
  pressed: { opacity: 0.72 },
});
