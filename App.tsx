import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { ENGINE_VERSION } from './src/domain/version';

export default function App() {
  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        SI World
      </Text>
      <Text style={styles.status}>Foundation {ENGINE_VERSION}</Text>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    backgroundColor: '#17201b',
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: '#f5dd9d',
    fontSize: 36,
    fontWeight: '700',
  },
  status: {
    color: '#b8c9b7',
    fontSize: 16,
    marginTop: 8,
  },
});
