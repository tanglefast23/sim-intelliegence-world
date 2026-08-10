import { useCallback, useEffect, useState } from 'react';

import { createInitialState } from '../domain/state/initial-state';
import type { WorldState } from '../domain/state/schema';
import { WorldScene } from '../render/WorldScene';
import { getDesktopBridge } from './DesktopBridge';
import { LoadingShell } from './LoadingShell';
import { NewGameFlow } from './NewGameFlow';
import { shouldReportGameReady } from './game-readiness';

type GameSession = Readonly<{
  key: string;
  saveGeneration: number | null;
  saveStatus: string;
  state: WorldState;
  worldFeedback: string;
}>;

type BootState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'new'; busy: boolean; error?: string }>
  | Readonly<{ status: 'active'; session: GameSession }>
  | Readonly<{ status: 'failed'; detail: string }>;

type GameScreenProps = Readonly<{ onReady: () => void }>;

export function GameScreen({ onReady }: GameScreenProps) {
  const [boot, setBoot] = useState<BootState>({ status: 'loading' });

  useEffect(() => {
    const bridge = getDesktopBridge();
    if (!bridge) {
      setBoot({ status: 'new', busy: false });
      return;
    }
    let active = true;
    void bridge.loadSave('slot-001').then((result) => {
      if (!active) return;
      if (result.status === 'unchanged' || result.status === 'migrated') {
        setBoot({
          status: 'active',
          session: {
            key: `save-${result.saveGeneration}`,
            saveGeneration: result.saveGeneration,
            saveStatus: `${result.status === 'migrated' ? 'MIGRATED' : 'LOADED'} GEN ${result.saveGeneration}`,
            state: result.state,
            worldFeedback: `WELCOME BACK, ${result.state.protagonist.displayName.toUpperCase()}.`,
          },
        });
      } else if (result.status === 'empty') {
        setBoot({ status: 'new', busy: false });
      } else if (result.status === 'incompatible') {
        setBoot({
          status: 'failed',
          detail: `This save uses an incompatible game or content version. ${result.incompatibleCandidateCount} file${result.incompatibleCandidateCount === 1 ? '' : 's'} were preserved.`,
        });
      } else if (result.status === 'corrupt') {
        setBoot({
          status: 'failed',
          detail: `Save recovery found ${result.corruptCandidateCount} damaged file${result.corruptCandidateCount === 1 ? '' : 's'}. The files were preserved.`,
        });
      } else {
        setBoot({
          status: 'failed',
          detail: 'The save layout could not migrate to this island build. Every source file was preserved.',
        });
      }
    }).catch(() => {
      if (active) setBoot({ status: 'failed', detail: 'The save service did not answer. Your existing files were not changed.' });
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!shouldReportGameReady(boot.status)) return;
    const firstPaint = requestAnimationFrame(() => requestAnimationFrame(onReady));
    return () => cancelAnimationFrame(firstPaint);
  }, [boot.status, onReady]);

  const startNewGame = useCallback((displayName: string) => {
    const state = createInitialState(displayName);
    const bridge = getDesktopBridge();
    setBoot({ status: 'new', busy: true });
    if (!bridge) {
      setBoot({
        status: 'active',
        session: {
          key: 'browser-session',
          saveGeneration: null,
          saveStatus: 'BROWSER · NO DISK SAVE',
          state,
          worldFeedback: 'WELCOME TO HALCYRA · $800 WEEKLY ALLOWANCE RECEIVED.',
        },
      });
      return;
    }
    void bridge.requestSave({
      slotId: 'slot-001', expectedSaveGeneration: null, trigger: 'manual', state,
    }).then((result) => {
      if (result.status !== 'saved') {
        setBoot({ status: 'new', busy: false, error: 'The island could not create a stable save. Try again.' });
        return;
      }
      setBoot({
        status: 'active',
        session: {
          key: `new-${result.saveGeneration}`,
          saveGeneration: result.saveGeneration,
          saveStatus: `SAVED GEN ${result.saveGeneration}`,
          state,
          worldFeedback: 'WELCOME TO HALCYRA · $800 WEEKLY ALLOWANCE RECEIVED.',
        },
      });
    }).catch(() => {
      setBoot({ status: 'new', busy: false, error: 'The save write failed. No new game was started.' });
    });
  }, []);

  if (boot.status === 'loading') return <LoadingShell detail="Checking your Halcyra save…" />;
  if (boot.status === 'failed') return <LoadingShell detail={boot.detail} failed />;
  if (boot.status === 'new') {
    return <NewGameFlow busy={boot.busy} error={boot.error} onStart={startNewGame} />;
  }
  return (
    <WorldScene
      initialFeedback={boot.session.worldFeedback}
      initialSaveGeneration={boot.session.saveGeneration}
      initialSaveStatus={boot.session.saveStatus}
      initialState={boot.session.state}
      key={boot.session.key}
    />
  );
}
