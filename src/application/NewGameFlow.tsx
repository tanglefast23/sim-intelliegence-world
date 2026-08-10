import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export function normalizePlayerName(value: string): string {
  return value.trim().replace(/\s+/gu, ' ').slice(0, 32);
}

type NewGameFlowProps = Readonly<{
  busy: boolean;
  error?: string;
  onStart: (displayName: string) => void;
}>;

export function NewGameFlow({ busy, error, onStart }: NewGameFlowProps) {
  const [draft, setDraft] = useState('');
  const displayName = normalizePlayerName(draft);
  const start = () => {
    if (!busy && displayName) onStart(displayName);
  };

  return (
    <View accessibilityLabel="New life on Halcyra Island" nativeID="new-game-flow" style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>ONE-YEAR ISLAND RESIDENCY PRIZE</Text>
        <Text accessibilityRole="header" style={styles.title}>WELCOME TO HALCYRA</Text>
        <Text style={styles.copy}>
          Your villa is ready. The island will pay you $800 each week. You can leave, but why would you?
        </Text>
        <Text style={styles.label}>WHAT SHOULD THE ISLAND CALL YOU?</Text>
        <TextInput
          accessibilityLabel="Player name"
          autoCapitalize="words"
          autoCorrect={false}
          editable={!busy}
          maxLength={32}
          onChangeText={setDraft}
          onSubmitEditing={start}
          placeholder="YOUR NAME"
          placeholderTextColor="#776b59"
          returnKeyType="done"
          style={styles.input}
          value={draft}
        />
        {error ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text> : null}
        <Pressable
          accessibilityLabel="Start life on Halcyra"
          accessibilityRole="button"
          disabled={busy || !displayName}
          onPress={start}
          style={[styles.button, (busy || !displayName) && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>{busy ? 'PREPARING VILLA…' : 'START LIFE ON HALCYRA'}</Text>
        </Pressable>
        <Text style={styles.note}>No tutorial. Click where you want to go and decide who to trust.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', backgroundColor: '#d3a04c', minHeight: 46, justifyContent: 'center', marginTop: 16, paddingHorizontal: 18 },
  buttonDisabled: { backgroundColor: '#665139', opacity: 0.7 },
  buttonText: { color: '#211d1a', fontFamily: 'Silkscreen', fontSize: 11 },
  card: { backgroundColor: '#252019', borderColor: '#c58b4b', borderWidth: 2, maxWidth: 620, padding: 30, width: '88%' },
  copy: { color: '#fff0c7', fontFamily: 'Silkscreen', fontSize: 12, lineHeight: 21, marginTop: 14 },
  error: { color: '#ff9b85', fontFamily: 'Silkscreen', fontSize: 10, lineHeight: 17, marginTop: 10 },
  eyebrow: { color: '#c89b5e', fontFamily: 'Silkscreen', fontSize: 10 },
  input: { backgroundColor: '#181512', borderColor: '#76573d', borderWidth: 2, color: '#fff0c7', fontFamily: 'Silkscreen', fontSize: 16, minHeight: 48, paddingHorizontal: 12 },
  label: { color: '#d6c19a', fontFamily: 'Silkscreen', fontSize: 10, marginBottom: 8, marginTop: 24 },
  note: { color: '#9a8b73', fontFamily: 'Silkscreen', fontSize: 9, lineHeight: 15, marginTop: 14, textAlign: 'center' },
  screen: { alignItems: 'center', height: 626, justifyContent: 'center', width: 1126 },
  title: { color: '#f1c65b', fontFamily: 'Silkscreen', fontSize: 26, marginTop: 6 },
});
