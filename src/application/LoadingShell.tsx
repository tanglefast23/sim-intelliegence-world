import { StyleSheet, Text, View } from 'react-native';

type LoadingShellProps = Readonly<{
  detail: string;
  failed?: boolean;
}>;

export function getLoadingShellCopy(failed: boolean, detail: string) {
  return {
    detail,
    headline: failed ? 'Unable to start safely.' : 'Preparing the island…',
  } as const;
}

export function LoadingShell({ detail, failed = false }: LoadingShellProps) {
  const copy = getLoadingShellCopy(failed, detail);
  return (
    <View accessibilityLiveRegion="polite" style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>
        SI World
      </Text>
      <Text style={[styles.detail, failed && styles.failed]}>
        {copy.headline}
      </Text>
      <Text style={styles.subdetail}>{copy.detail}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  detail: {
    color: '#b8c9b7',
    fontSize: 17,
    marginTop: 12,
  },
  failed: {
    color: '#ff9b85',
  },
  screen: {
    alignItems: 'center',
    backgroundColor: '#17201b',
    flex: 1,
    justifyContent: 'center',
  },
  subdetail: {
    color: '#7f9784',
    fontSize: 13,
    marginTop: 6,
  },
  title: {
    color: '#f5dd9d',
    fontSize: 36,
    fontWeight: '700',
  },
});
