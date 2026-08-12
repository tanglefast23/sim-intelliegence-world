import { useState, type ReactNode } from 'react';

import { NewGameFlow } from '../../application/NewGameFlow';
import { DEFAULT_PRESENTATION_PREFERENCES } from '../../application/presentation/preferences';
import type { WorldState } from '../../domain/state/schema';
import { ATLAS_INDEX, CHARACTER_IDS, type CharacterId } from '../../render/atlas';
import type { ViewportSize } from '../../render/camera';
import { WorldScene } from '../../render/WorldScene';
import type { DevHarnessRoutableEntry } from './route';
import {
  DEV_HARNESS_MAP_IDS,
  devHarnessLocationState,
  devHarnessQuestState,
} from './scenario-state';

export interface DevHarnessCase {
  readonly id: string;
  readonly label: string;
  readonly note?: string;
}

export interface DevHarnessEntry extends DevHarnessRoutableEntry {
  readonly title: string;
  readonly summary: string;
  readonly cases: readonly DevHarnessCase[];
  readonly render: (caseId: string, surface: ViewportSize) => ReactNode;
}

type HarnessWorldProps = Readonly<{
  conversationFixtureId?: CharacterId;
  initialPanel?: 'journal' | 'relationships';
  newGame?: boolean;
  state: WorldState;
  surface: ViewportSize;
}>;

function HarnessWorld({
  conversationFixtureId,
  initialPanel,
  newGame = false,
  state,
  surface,
}: HarnessWorldProps) {
  return (
    <WorldScene
      initialConversationFixtureId={conversationFixtureId}
      initialFeedback="DEV HARNESS · DISPOSABLE STATE"
      initialOpenPanel={initialPanel}
      initialPresentationPreferences={DEFAULT_PRESENTATION_PREFERENCES}
      initialSaveGeneration={null}
      initialSaveStatus="DEV HARNESS · NO DISK SAVE"
      initialState={state}
      newGame={newGame}
      onPresentationPreferencesChange={() => undefined}
      persistenceDisabled
      surface={surface}
    />
  );
}

function WelcomePreview({ surface }: Readonly<{ surface: ViewportSize }>) {
  const [state, setState] = useState<WorldState>();
  if (state) return <HarnessWorld newGame state={state} surface={surface} />;
  return (
    <NewGameFlow
      busy={false}
      onStart={(displayName) => setState(devHarnessLocationState('northwest_residential', displayName))}
      surface={surface}
    />
  );
}

const WORLD_MAP_LABELS: Readonly<Record<(typeof DEV_HARNESS_MAP_IDS)[number], string>> = {
  northwest_residential: 'VILLAS',
  northeast_downtown: 'DOWNTOWN',
  southwest_commercial: 'SHOPS',
  southeast_docks: 'DOCKS',
};

const ATLAS_MAP_NAMES: Readonly<Record<(typeof DEV_HARNESS_MAP_IDS)[number], string>> = {
  northwest_residential: 'Sunward Villas',
  northeast_downtown: 'Neon Crescent',
  southwest_commercial: 'Palm Exchange',
  southeast_docks: 'Harbor Authority',
};

const mapCases = DEV_HARNESS_MAP_IDS.map((mapId) => ({
  id: mapId,
  label: WORLD_MAP_LABELS[mapId],
  note: `Open ${ATLAS_MAP_NAMES[mapId]} immediately.`,
}));

const conversationCases = CHARACTER_IDS.map((characterId) => ({
  id: characterId,
  label: ATLAS_INDEX.characters[characterId].displayName.toUpperCase(),
  note: 'Open the real conversation panel in its authored art-review mode.',
}));

const welcomeEntry: DevHarnessEntry = {
  id: 'welcome',
  group: 'Start',
  title: 'Welcome and New Game',
  summary: 'See the first screen and enter a disposable new game.',
  cases: [{ id: 'new-game', label: 'NEW GAME' }],
  render: (_caseId, surface) => <WelcomePreview surface={surface} />,
};

const locationsEntry: DevHarnessEntry = {
  id: 'locations',
  group: 'World',
  title: 'Island Locations',
  summary: 'Jump to each neighborhood without walking or changing a save.',
  cases: mapCases,
  render: (caseId, surface) => (
    <HarnessWorld
      state={devHarnessLocationState(caseId as (typeof DEV_HARNESS_MAP_IDS)[number])}
      surface={surface}
    />
  ),
};

const conversationsEntry: DevHarnessEntry = {
  id: 'conversations',
  group: 'People',
  title: 'Conversation Portraits',
  summary: 'Open every character in the production conversation layout.',
  cases: conversationCases,
  render: (caseId, surface) => (
    <HarnessWorld
      conversationFixtureId={caseId as CharacterId}
      state={devHarnessLocationState('northwest_residential')}
      surface={surface}
    />
  ),
};

const panelsEntry: DevHarnessEntry = {
  id: 'panels',
  group: 'Systems',
  title: 'Journal and Relationships',
  summary: 'Inspect empty, active, and discovered quest panels immediately.',
  cases: [
    { id: 'journal-empty', label: 'EMPTY JOURNAL' },
    { id: 'journal-active', label: 'ACTIVE QUEST' },
    { id: 'journal-discovered', label: 'EXACT LEAD' },
    { id: 'relationships', label: 'RELATIONSHIPS' },
  ],
  render: (caseId, surface) => {
    if (caseId === 'relationships') {
      return (
        <HarnessWorld
          initialPanel="relationships"
          state={devHarnessQuestState('locked')}
          surface={surface}
        />
      );
    }
    const stage = caseId === 'journal-discovered'
      ? 'discovered'
      : caseId === 'journal-active' ? 'active' : 'locked';
    return (
      <HarnessWorld
        initialPanel="journal"
        state={devHarnessQuestState(stage)}
        surface={surface}
      />
    );
  },
};

export const DEV_HARNESS_ENTRIES: readonly DevHarnessEntry[] = Object.freeze([
  welcomeEntry,
  locationsEntry,
  conversationsEntry,
  panelsEntry,
]);
