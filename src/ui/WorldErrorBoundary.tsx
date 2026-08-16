import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Catches a render or lifecycle exception from the world scene.
 *
 * Without this, one throw anywhere in the tick unmounted the entire interface and left a window
 * painted in the body colour: no world, no HUD, no message. That is how a diagonal NPC schedule
 * goal presented — see `routeBetween` — and it took three runs to identify because the failure
 * produced nothing to read. The boundary trades a blank window for the actual message.
 *
 * `#world-error-state` carries the message for smokes, and the visible panel carries it for a
 * human. The renderer console still receives the original error, so existing log paths are intact.
 */
type WorldErrorBoundaryProps = Readonly<{ children: ReactNode }>;
type WorldErrorBoundaryState = Readonly<{ message: string | undefined }>;

export class WorldErrorBoundary extends Component<WorldErrorBoundaryProps, WorldErrorBoundaryState> {
  public override state: WorldErrorBoundaryState = { message: undefined };

  public static getDerivedStateFromError(error: unknown): WorldErrorBoundaryState {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep the console path: the packaged main process forwards renderer errors to stderr.
    // eslint-disable-next-line no-console
    console.error(`SI_WORLD_SCENE_ERROR ${error.message}`, error.stack, info.componentStack);
  }

  public override render(): ReactNode {
    const { message } = this.state;
    if (message === undefined) return this.props.children;
    return (
      <View style={styles.root} nativeID="world-error-state" accessibilityLabel={`World error: ${message}`}>
        <View style={styles.panel}>
          <Text style={styles.title}>THE WORLD STOPPED</Text>
          <Text style={styles.message}>{message}</Text>
          <Text style={styles.hint}>Your last autosave is safe. Reopen the app to continue.</Text>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  hint: { color: '#9a8f7d', fontSize: 12, marginTop: 16 },
  message: { color: '#f1c65b', fontSize: 14, marginTop: 12 },
  panel: { backgroundColor: '#12100c', borderColor: '#665139', borderWidth: 1, maxWidth: 620, padding: 24 },
  root: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 32 },
  title: { color: '#f4ede2', fontSize: 18, letterSpacing: 2 },
});
