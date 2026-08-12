import { useState, type ReactNode } from 'react';

import { NewGameFlow } from '../../application/NewGameFlow';
import {
  DEFAULT_PRESENTATION_PREFERENCES,
  type PresentationPreferences,
} from '../../application/presentation/preferences';
import type { WorldState } from '../../domain/state/schema';
import { ATLAS_INDEX, CHARACTER_IDS, type CharacterId } from '../../render/atlas';
import { centerCameraOnTile, type ViewportSize } from '../../render/camera';
import { EXPECTED_VFX_ANCHORS } from '../../render/vfx/fixtures';
import { WorldScene } from '../../render/WorldScene';
import type { DevHarnessRoutableEntry } from './route';
import {
  DEV_HARNESS_MAP_IDS,
  devHarnessGoldenHourState,
  devHarnessLocationState,
  devHarnessQuestState,
  devHarnessVfxState,
} from './scenario-state';

const MAP_PIXELS = { width: 64 * 32, height: 48 * 32 } as const;

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
  feedback?: string;
  initialPanel?: 'journal' | 'relationships';
  newGame?: boolean;
  presentationPreferences?: PresentationPreferences;
  state: WorldState;
  surface: ViewportSize;
}>;

function HarnessWorld({
  conversationFixtureId,
  feedback = 'DEV HARNESS · DISPOSABLE STATE',
  initialPanel,
  newGame = false,
  presentationPreferences = DEFAULT_PRESENTATION_PREFERENCES,
  state,
  surface,
}: HarnessWorldProps) {
  return (
    <WorldScene
      initialConversationFixtureId={conversationFixtureId}
      initialFeedback={feedback}
      initialOpenPanel={initialPanel}
      initialPresentationPreferences={presentationPreferences}
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
  southwest_commercial: 'Saffron Bazaar',
  southeast_docks: 'Greywake Harbor',
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

const vfxCases = EXPECTED_VFX_ANCHORS.map((anchor) => ({
  id: anchor.id,
  label: anchor.id.replaceAll('-', ' ').toUpperCase(),
  note: `${ATLAS_MAP_NAMES[anchor.mapId]} · ${anchor.kind.toUpperCase()} · starts at 3× zoom.`,
}));

function vfxPresentationPreferences(
  anchor: (typeof EXPECTED_VFX_ANCHORS)[number],
  surface: ViewportSize,
): PresentationPreferences {
  const camera = centerCameraOnTile(anchor, 3, surface, MAP_PIXELS);
  return {
    ...DEFAULT_PRESENTATION_PREFERENCES,
    worldZoom: 3,
    camera: { mapId: anchor.mapId, x: camera.x, y: camera.y },
  };
}

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

const goldenHourEntry: DevHarnessEntry = {
  id: 'golden-hour',
  group: 'World',
  title: 'Four-District Golden Hour',
  summary: 'Hold every district at the same approved art-review time.',
  cases: mapCases,
  render: (caseId, surface) => (
    <HarnessWorld
      state={devHarnessGoldenHourState(caseId as (typeof DEV_HARNESS_MAP_IDS)[number])}
      surface={surface}
    />
  ),
};

const characterTalkEntry: DevHarnessEntry = {
  id: 'character-talk',
  group: 'People',
  title: 'Four-District Talk Pose',
  summary: 'Open the same selected-character talk pose in every district.',
  cases: mapCases,
  render: (caseId, surface) => (
    <HarnessWorld
      conversationFixtureId="linda"
      state={devHarnessGoldenHourState(caseId as (typeof DEV_HARNESS_MAP_IDS)[number])}
      surface={surface}
    />
  ),
};

const proceduralEffectsEntry: DevHarnessEntry = {
  id: 'procedural-effects',
  group: 'World',
  title: 'Procedural Effects',
  summary: 'Open every authored fire and sparkle in its real neighborhood.',
  cases: vfxCases,
  render: (caseId, surface) => {
    const anchor = EXPECTED_VFX_ANCHORS.find(({ id }) => id === caseId);
    if (!anchor) throw new Error(`Unknown dev harness VFX case ${caseId}.`);
    return (
      <HarnessWorld
        feedback={`VFX HARNESS · ${anchor.id.toUpperCase()}`}
        presentationPreferences={vfxPresentationPreferences(anchor, surface)}
        state={devHarnessVfxState(anchor.mapId, anchor.id)}
        surface={surface}
      />
    );
  },
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
  goldenHourEntry,
  characterTalkEntry,
  proceduralEffectsEntry,
  conversationsEntry,
  panelsEntry,
]);
