import { StyleSheet, Text, View } from 'react-native';
import type { ViewportSize } from '../render/camera';
import { automaticUiScale } from '../render/responsive-layout';
import { uiMetrics } from '../ui/ui-metrics';

type LoadingShellProps = Readonly<{
  detail: string;
  failed?: boolean;
  surface?: ViewportSize;
}>;

export function getLoadingShellCopy(failed: boolean, detail: string) {
  return {
    detail,
    headline: failed ? 'Unable to start safely.' : 'Preparing the island…',
  } as const;
}

export function LoadingShell({ detail, failed = false, surface }: LoadingShellProps) {
  const copy = getLoadingShellCopy(failed, detail);
  const metrics = uiMetrics(surface ? automaticUiScale(surface) : 1);
  return (
    <View accessibilityLiveRegion="polite" nativeID="loading-shell" style={[styles.screen, surface]}>
      <Text accessibilityRole="header" style={[styles.title, { fontSize: metrics.titleText * 2 }]}>
        SI World
      </Text>
      <Text style={[styles.detail, { fontSize: metrics.panelText }, failed && styles.failed]}>
        {copy.headline}
      </Text>
      <Text style={[styles.subdetail, { fontSize: metrics.secondaryText }]}>{copy.detail}</Text>
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
