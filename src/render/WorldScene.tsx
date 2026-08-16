import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';


import { getDesktopBridge } from '../application/DesktopBridge';
import { useReducedMotion } from '../application/accessibility';
import type {
  PresentationPreferences,
  RendererPresentationPatch,
} from '../application/presentation/preferences';
import { createBrowserConversationPort } from '../ai/conversation/browser-port';
import { autosaveStableState } from '../application/runtime/autosave';
import { WORLD_MAP_CATALOG } from '../application/runtime/map-catalog';
import { setWorldSpeed, sleepWorld, tickWorld } from '../application/runtime/tick';
import { canStartPortalTransition, transitionNeighborhood } from '../application/runtime/transitions';
import { advanceMovementFrame } from '../application/runtime/movement-frame';
import { effectiveSpeed } from '../domain/clock/clock';
import { reduceCommand } from '../domain/commands/reducer';
import { DomainCommandSchema } from '../domain/commands/types';
import { lindaContextActions, type ContextQuestAction } from '../domain/quests/quest-machine';
import {
  VERBAL_MISSION_DISCOVERY_FACTS,
  verbalMissionContextActions,
  verbalMissionDiscoveryRecord,
} from '../domain/verbal-missions/discovery';
import { parseWorldState, type WorldState } from '../domain/state/schema';
import { VOCAL_CUE_CAPTIONS, type VocalCueId } from '../audio/vocal-cue-policy';
import { useVocalCues } from '../audio/vocal-cues';
import { relationshipSound } from '../audio/halcyra-audio-policy';
import { useWorldAudio, type InterfaceSoundId } from '../audio/halcyra-audio';
import { BedActions } from '../ui/BedActions';
import { ConversationPanel } from '../ui/ConversationPanel';
import { Hud } from '../ui/Hud';
import { JournalPanel } from '../ui/JournalPanel';
import { QuestOfferDialogue } from '../ui/QuestOfferDialogue';
import { RelationshipPanel } from '../ui/RelationshipPanel';
import { SelectedCharacterCard } from '../ui/SelectedCharacterCard';
import { SelectionMarker } from '../ui/SelectionMarker';
import { selectedCharacterSummary } from '../ui/selected-character';
import { sleepCompletionFeedback } from '../ui/sleep-feedback';
import { WorldInput } from '../ui/WorldInput';
import { ZoneGateOverlay } from '../ui/ZoneGate';
import { uiMetrics } from '../ui/ui-metrics';
import type { CompiledMapV2 } from '../world/maps/compiled-v2';
import { selectOwnerInteractionApproach } from '../world/maps/compiler';
import { resolveClickTarget, worldClickCandidates } from '../world/maps/hit-testing';
import { presentationGroundAt } from '../world/presentation/art-presentation';
import { tileKey, type TilePoint } from '../world/maps/schema';
import type { MapId } from '../world/maps/catalog';
import {
  cancelMovement,
  createMovementState,
  doorMotionPhases,
  requestMovement,
  type MovementState,
} from '../world/pathfinding/movement';
import {
  activeNpcTile,
  movementForNpc,
} from '../world/schedules/active-movement';
import { portalAtTile, portalZoneTiles } from '../world/transfers/portal-zone';
import {
  ATLAS_INDEX,
  CHARACTER_IDS,
  type AtlasRectangle,
  type CharacterId,
} from './atlas';
import {
  assertWorldZoom,
  MAX_WORLD_ZOOM,
  MIN_WORLD_ZOOM,
  stepWorldZoom,
  worldZoomPercentage,
} from '../domain/presentation/world-zoom';
import { mapEffectVisible } from './atmosphere';
import { snapWorldPoint, tileFootPoint } from '../world/movement/motion-clock';
import {
  centerCameraOnWorld,
  centerCameraOnTile,
  clampCamera,
  isScreenPointInsideMap,
  panCamera,
  resizeCameraPreservingCenter,
  screenToTile,
  worldToScreen,
  zoomCameraAt,
  type CameraState,
  type ViewportSize,
} from './camera';
import { automaticUiScale, automaticWorldZoom, type UiScale } from './responsive-layout';
import { ThreeWorldSurface } from './ThreeWorldSurface';
import type { RendererKind } from './renderer-selection';
import { measureResponsiveEvidence } from './responsive-evidence';
import { buildSmokeGeometryEvidence } from './smoke-geometry';
import { parseVfxEvidence } from './vfx/evidence';
import { PROCEDURAL_VFX_RENDER_NODE_COUNT } from './vfx/types';
import { advanceAmbientVfxClock, INITIAL_AMBIENT_VFX_CLOCK } from './vfx/clock';
import {
  VFX_KINDS,
  VFX_REVISION,
  VFX_STEP_MILLISECONDS,
  VFX_SUSPENSION_GAP_MILLISECONDS,
} from './vfx/types';
import { bottomPivotTransform, protagonistWobbleDegrees } from './protagonist-wobble';
import {
  buildWorldFrameState,
  DESTINATION_PULSE_MS,
  type WorldActors,
  type WorldCharacterPlacement,
  type WorldGroundedEntry,
  type WorldLayer,
  type WorldPropPlacement,
} from './world-frame';

const atlasImage = require('../../assets/generated/world-atlas.png') as number;
const MAP_PIXELS = { width: 64 * 32, height: 48 * 32 } as const;
const TILE_SIZE = 32;
/** How long the player stands on a portal zone before the world jumps to the next neighborhood. */
const PORTAL_GATE_DELAY_MS = 1_000;
type GroundedVisual = Readonly<{
  groundY: number;
  id: string;
  kind: 'character' | 'prop';
  placement: WorldPropPlacement | WorldCharacterPlacement;
}>;
type RuntimeViewState = Readonly<{
  movement: MovementState;
  npcMovements: Readonly<Record<string, MovementState>>;
  worldState: WorldState;
}>;


function groundedBatches(visuals: readonly GroundedVisual[]): readonly GroundedVisual[][] {
  return visuals.reduce<GroundedVisual[][]>((batches, visual) => {
    const batch = batches.at(-1);
    if (batch?.[0]?.kind === visual.kind) batch.push(visual);
    else batches.push([visual]);
    return batches;
  }, []);
}

function areaName(map: CompiledMapV2, tile: TilePoint): string {
  const area = map.source.areas.find(({ bounds }) => (
    tile.x >= bounds.x && tile.x < bounds.x + bounds.width &&
    tile.y >= bounds.y && tile.y < bounds.y + bounds.height
  ));
  return (area?.id ?? map.source.displayName).replaceAll('-', ' ').toUpperCase();
}

function visualIdForNpc(stateId: string, _tier: 'full_ai' | 'ambient'): CharacterId {
  const candidate = stateId.replaceAll('_', '-') as CharacterId;
  return CHARACTER_IDS.includes(candidate) ? candidate : 'generic-resident';
}

function actorTiles(
  state: WorldState,
  mapId: string,
  movements: Readonly<Record<string, MovementState>>,
  zoom: number,
  dpr: number,
  reducedMotion: boolean,
  selectedId: string,
  conversationNpcId: string | undefined,
  reactionId: string | undefined,
  poseFrame: 0 | 1,
): WorldActors {
  const output: Record<string, WorldActors[string]> = {};
  for (const [stateId, npc] of Object.entries(state.npcs)) {
    const tile = activeNpcTile(state, stateId, mapId);
    if (tile) {
      const movement = movements[stateId];
      output[stateId] = {
        tile,
        visualId: visualIdForNpc(stateId, npc.tier),
        direction: movement?.direction ?? 'down',
        visualFoot: snapWorldPoint(movement?.visualFoot ?? tileFootPoint(tile), zoom, dpr),
        walkFrame: movement?.walkFrame ?? 0,
        moving: movement?.segment !== undefined,
        reducedMotion,
        horizontalRunDistance: movement?.horizontalRunDistance ?? 0,
        pose: stateId === reactionId ? 'reaction' : stateId === conversationNpcId ? 'talk' : 'idle',
        poseFrame: stateId === selectedId || stateId === conversationNpcId ? poseFrame : 0,
      };
    }
  }
  return output;
}

function npcMovementState(state: WorldState): Readonly<Record<string, MovementState>> {
  const movements: Record<string, MovementState> = {};
  for (const stateId of Object.keys(state.npcs).sort()) {
    const movement = movementForNpc(state, stateId);
    if (movement) movements[stateId] = movement;
  }
  return movements;
}

function npcBlockers(state: WorldState, mapId: string, excludedNpcId?: string): Set<string> {
  const blockers = new Set<string>();
  for (const stateId of Object.keys(state.npcs).sort()) {
    if (stateId === excludedNpcId) continue;
    const presence = state.npcs[stateId]?.presence;
    if (presence?.kind === 'active_local' && presence.mapId === mapId) {
      blockers.add(tileKey({ x: presence.tileX, y: presence.tileY }));
    }
  }
  return blockers;
}

function stateNpcId(selectedId: string, state: WorldState): string | undefined {
  return state.npcs[selectedId] ? selectedId : undefined;
}

function npcLabel(selectedId: string, actors: WorldActors): string {
  const actor = actors[selectedId];
  if (!actor || selectedId === 'generic_resident') return 'Resident';
  if (actor.visualId === 'generic-resident') {
    return selectedId.split('_').map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`).join(' ');
  }
  return ATLAS_INDEX.characters[actor.visualId].displayName;
}

type WorldSceneProps = Readonly<{
  audioEnabled?: boolean;
  forceAmbientMotion?: boolean;
  initialConversationFixtureId?: CharacterId;
  initialFeedback: string;
  initialOpenPanel?: 'journal' | 'relationships';
  initialPresentationPreferences: PresentationPreferences;
  initialSaveGeneration: number | null;
  initialSaveStatus: string;
  initialState: WorldState;
  newGame: boolean;
  onPresentationPreferencesChange: (patch: RendererPresentationPatch) => void;
  onWorldReady?: () => void;
  playInterfaceSound?: (sound: InterfaceSoundId) => void;
  persistenceDisabled?: boolean;
  rendererKind?: RendererKind;
  surface: ViewportSize;
}>;

export function WorldScene({
  audioEnabled = false,
  forceAmbientMotion = false,
  initialConversationFixtureId,
  initialFeedback,
  initialOpenPanel,
  initialPresentationPreferences,
  initialSaveGeneration,
  initialSaveStatus,
  initialState,
  newGame,
  onPresentationPreferencesChange,
  onWorldReady = () => undefined,
  playInterfaceSound = () => undefined,
  persistenceDisabled = false,
  rendererKind = 'threejs-2d',
  surface,
}: WorldSceneProps) {
  const reducedMotion = useReducedMotion();
  const playVocalCue = useVocalCues();
  const initialTile = useMemo(() => ({
    x: initialState.protagonist.worldPosition.tileX,
    y: initialState.protagonist.worldPosition.tileY,
  }), [initialState]);
  const initialMapId = initialState.protagonist.worldPosition.mapId as MapId;
  const initialMap = WORLD_MAP_CATALOG[initialMapId];
  const initialZoom = initialPresentationPreferences.worldZoom ?? automaticWorldZoom(surface);
  const initialAnchor = newGame
    ? (initialMap.source.startComposition?.cameraAnchor ?? initialTile)
    : initialTile;
  const [runtime, setRuntime] = useState<RuntimeViewState>(() => ({
    movement: createMovementState(initialTile),
    npcMovements: npcMovementState(initialState),
    worldState: initialState,
  }));
  const [camera, setCamera] = useState<CameraState>(() => {
    const saved = initialPresentationPreferences.camera;
    return !newGame && saved?.mapId === initialMapId
      ? clampCamera({ x: saved.x, y: saved.y, zoom: initialZoom }, surface, MAP_PIXELS)
      : centerCameraOnTile(initialAnchor, initialZoom, surface, MAP_PIXELS);
  });
  const [explicitWorldZoom, setExplicitWorldZoom] = useState(initialPresentationPreferences.worldZoom !== null);
  const [uiScale, setUiScale] = useState<UiScale>(() => initialPresentationPreferences.uiScale ?? automaticUiScale(surface));
  const [explicitUiScale, setExplicitUiScale] = useState(initialPresentationPreferences.uiScale !== null);
  const [selected, setSelected] = useState<string>(initialConversationFixtureId ?? 'protagonist');
  const [reactionId, setReactionId] = useState<string>();
  const [poseFrame, setPoseFrame] = useState<0 | 1>(0);
  const [saveStatus, setSaveStatus] = useState(initialSaveStatus);
  const [transitioning, setTransitioning] = useState(false);
  const [armedPortalId, setArmedPortalId] = useState<string>();
  const [arrivalLock, setArrivalLock] = useState<string>();
  const [worldFeedback, setWorldFeedback] = useState<string | undefined>(initialFeedback);
  const [conversationNpcId, setConversationNpcId] = useState<string | undefined>(initialConversationFixtureId);
  const [conversationFixtureId, setConversationFixtureId] = useState<CharacterId | undefined>(initialConversationFixtureId);
  const [questOfferOpen, setQuestOfferOpen] = useState(false);
  const [authoredDialogueFixtureId, setAuthoredDialogueFixtureId] = useState<'linda-boyfriend'>();
  const [openPanel, setOpenPanel] = useState<'journal' | 'relationships' | undefined>(initialOpenPanel);
  const [audioCaption, setAudioCaption] = useState<string>();
  const [responsiveEvidence, setResponsiveEvidence] = useState('');
  const [vfxAgeStep, setVfxAgeStep] = useState(0);
  const [destinationMarker, setDestinationMarker] = useState<TilePoint>();
  const [destinationPulseElapsedMs, setDestinationPulseElapsedMs] = useState(0);
  const [rendererParityPulseFrozen, setRendererParityPulseFrozen] = useState(false);
  const [rendererContextState, setRendererContextState] = useState<'ready' | 'lost' | 'timed-out'>('ready');
  const rendererSuspended = rendererContextState !== 'ready';
  const conversationPort = useMemo(
    () => persistenceDisabled ? createBrowserConversationPort() : getDesktopBridge() ?? createBrowserConversationPort(),
    [persistenceDisabled],
  );
  const saveGeneration = useRef<number | null>(initialSaveGeneration);
  const vfxClock = useRef(INITIAL_AMBIENT_VFX_CLOCK);
  const handledSleepEventId = useRef<string | undefined>(undefined);
  const captionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const previousSurface = useRef(surface);
  const surfaceRef = useRef(surface);
  surfaceRef.current = surface;
  const runtimeRef = useRef(runtime);
  runtimeRef.current = runtime;
  const mapId = runtime.worldState.protagonist.worldPosition.mapId as MapId;
  const map = WORLD_MAP_CATALOG[mapId];
  const movementMaterialId = runtime.movement.segment
    ? presentationGroundAt(map.presentation, runtime.movement.segment.to, map.source.width).materialId
    : undefined;
  const doorPhases = useMemo(() => doorMotionPhases(runtime.movement), [runtime.movement]);
  useWorldAudio({
    absoluteMinute: runtime.worldState.clock.absoluteMinute,
    doorPhases,
    enabled: audioEnabled && !rendererSuspended,
    mapId,
    materialId: movementMaterialId,
    segment: runtime.movement.segment,
  });
  const artMode = typeof window !== 'undefined' && window.siWorldSmokeMode === true && window.siWorldArtMode === 'legacy'
    ? 'legacy' as const
    : 'enhanced' as const;
  const smokeMode = typeof window !== 'undefined' && window.siWorldSmokeMode === true;
  const vfxMode = smokeMode && window.siWorldVfxMode === 'circle'
    ? 'circle' as const
    : 'procedural' as const;
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio;
  const npcTiles = useMemo(() => actorTiles(
    runtime.worldState,
    mapId,
    runtime.npcMovements,
    camera.zoom,
    dpr,
    reducedMotion,
    selected,
    conversationNpcId,
    reactionId,
    poseFrame,
  ), [camera.zoom, conversationNpcId, dpr, mapId, poseFrame, reactionId, reducedMotion, runtime.npcMovements, runtime.worldState, selected]);
  const speed = effectiveSpeed(runtime.worldState.clock);
  const selectedNpcId = stateNpcId(selected, runtime.worldState);
  const lindaQuestActions = lindaContextActions(runtime.worldState, selectedNpcId);
  const contextualMissionActions = verbalMissionContextActions(runtime.worldState, selectedNpcId);
  const lindaOfferAction = lindaQuestActions.find(({ id }) => id === 'start');
  const lindaOfferReady = lindaOfferAction?.enabled ?? false;
  const metrics = useMemo(() => uiMetrics(uiScale), [uiScale]);

  useEffect(() => {
    vfxClock.current = INITIAL_AMBIENT_VFX_CLOCK;
    setVfxAgeStep(0);
  }, [mapId]);

  useEffect(() => {
    const running = !rendererSuspended && vfxMode === 'procedural' && (forceAmbientMotion || speed > 0);
    if (!running) {
      vfxClock.current = advanceAmbientVfxClock(vfxClock.current, 0, { running: false });
      return undefined;
    }
    let animationFrame = 0;
    let previousTime: number | undefined;
    const animate = (time: number) => {
      const rawDelta = previousTime === undefined ? 0 : time - previousTime;
      previousTime = time;
      vfxClock.current = advanceAmbientVfxClock(vfxClock.current, rawDelta, {
        running: true,
        resumedFromSuspension: rawDelta > VFX_SUSPENSION_GAP_MILLISECONDS,
      });
      const nextAgeStep = Math.floor(vfxClock.current.ageMilliseconds / VFX_STEP_MILLISECONDS);
      setVfxAgeStep((current) => current === nextAgeStep ? current : nextAgeStep);
      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [forceAmbientMotion, mapId, rendererSuspended, speed, vfxMode]);

  useEffect(() => {
    if (reducedMotion) {
      setPoseFrame(0);
      return undefined;
    }
    if (rendererSuspended) return undefined;
    const timer = setInterval(() => setPoseFrame((current) => current === 0 ? 1 : 0), 720);
    return () => clearInterval(timer);
  }, [reducedMotion, rendererSuspended]);

  const selectCharacter = useCallback((id: string) => {
    setSelected(id);
    setReactionId(id);
    setTimeout(() => setReactionId((current) => current === id ? undefined : current), 520);
  }, []);

  useLayoutEffect(() => {
    const previous = previousSurface.current;
    if (previous.width === surface.width && previous.height === surface.height) return;
    const nextZoom = explicitWorldZoom ? camera.zoom : automaticWorldZoom(surface);
    setCamera((current) => resizeCameraPreservingCenter(current, previous, surface, nextZoom, MAP_PIXELS));
    if (!explicitUiScale) setUiScale(automaticUiScale(surface));
    previousSurface.current = surface;
  }, [camera.zoom, explicitUiScale, explicitWorldZoom, surface]);

  useEffect(() => {
    const timer = setTimeout(() => onPresentationPreferencesChange({
      worldZoom: explicitWorldZoom ? camera.zoom : null,
      uiScale: explicitUiScale ? uiScale : null,
      camera: { mapId, x: camera.x, y: camera.y },
    }), 160);
    return () => clearTimeout(timer);
  }, [camera, explicitUiScale, explicitWorldZoom, mapId, onPresentationPreferencesChange, uiScale]);

  const triggerVocalCue = useCallback((cue: VocalCueId) => {
    playVocalCue(cue);
    setAudioCaption(VOCAL_CUE_CAPTIONS[cue]);
    if (captionTimer.current) clearTimeout(captionTimer.current);
    captionTimer.current = setTimeout(() => setAudioCaption(undefined), 1_500);
  }, [playVocalCue]);

  useEffect(() => () => {
    if (captionTimer.current) clearTimeout(captionTimer.current);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || window.siWorldSmokeMode !== true) return undefined;
    window.siWorldOpenConversationFixture = (characterId) => {
      if (!CHARACTER_IDS.includes(characterId)) throw new Error(`Unknown conversation fixture ${characterId}.`);
      setOpenPanel(undefined);
      setConversationFixtureId(characterId);
      setConversationNpcId(characterId);
    };
    window.siWorldCloseConversationFixture = () => {
      setConversationFixtureId(undefined);
      setConversationNpcId(undefined);
    };
    window.siWorldFreezeRendererParityFrame = () => {
      vfxClock.current = INITIAL_AMBIENT_VFX_CLOCK;
      setVfxAgeStep(0);
      setDestinationPulseElapsedMs(420);
      setRendererParityPulseFrozen(true);
    };
    window.siWorldSetRendererTestZoom = (zoom) => {
      setExplicitWorldZoom(true);
      setCamera((current) => zoomCameraAt(
        current,
        assertWorldZoom(zoom),
        { x: surfaceRef.current.width / 2, y: surfaceRef.current.height / 2 },
        surfaceRef.current,
        MAP_PIXELS,
      ));
    };
    window.siWorldSetAuthoredDialogueFixture = (characterId) => {
      setOpenPanel(undefined);
      setConversationFixtureId(undefined);
      setConversationNpcId(undefined);
      setAuthoredDialogueFixtureId(characterId);
      setQuestOfferOpen(true);
    };
    window.siWorldStartNaturalMovementFixture = () => {
      setRuntime((current) => {
        const linda = current.worldState.npcs.linda;
        if (!linda || linda.presence.kind !== 'active_local') {
          throw new Error('Natural-movement fixture requires active Linda.');
        }
        const worldState = parseWorldState({
          ...current.worldState,
          npcs: {
            ...current.worldState.npcs,
            linda: {
              ...linda,
              scheduleGoal: {
                mapId: 'northwest_residential',
                locationId: 'linda_villa',
                activityId: 'smoke-walk',
                tileX: 23,
                tileY: 28,
                scheduledMinute: current.worldState.clock.absoluteMinute,
              },
            },
          },
        });
        return { ...current, npcMovements: npcMovementState(worldState), worldState };
      });
      return { npcId: 'linda', source: 'fixture', target: { x: 23, y: 28 } };
    };
    window.siWorldOpenRendererFeedbackFixture = () => {
      setOpenPanel(undefined);
      setConversationFixtureId(undefined);
      setConversationNpcId(undefined);
      setSelected('protagonist');
      setReactionId(undefined);
      setDestinationMarker({ x: 22, y: 28 });
      setDestinationPulseElapsedMs(420);
      setRendererParityPulseFrozen(true);
      setRuntime((current) => ({
        movement: { ...current.movement, feedbackTile: { x: 24, y: 28 } },
        npcMovements: current.npcMovements,
        worldState: parseWorldState({
          ...current.worldState,
          journal: {
            ...current.worldState.journal,
            journal_renderer_parity: {
              id: 'journal_renderer_parity',
              subject: { kind: 'quest', questId: 'linda_boyfriend_check' },
              summary: 'Renderer parity marker.',
              locationPrecision: 'exact',
              locationId: 'linda_villa',
              markerVisible: true,
              source: { type: 'scene_observation', sourceId: 'renderer_parity_fixture' },
              resolutionState: 'open',
              outcomeReceipts: [],
            },
          },
        }),
      }));
      setCamera((current) => centerCameraOnTile({ x: 23, y: 28 }, current.zoom, surfaceRef.current, MAP_PIXELS));
    };
    window.siWorldOpenRendererMotionFixture = (fixture) => {
      const start = { x: 17, y: 23 };
      const target = fixture === 'door-transition' ? { x: 14, y: 23 } : { x: 20, y: 23 };
      const fixtureMap = WORLD_MAP_CATALOG.northwest_residential;
      setOpenPanel(undefined);
      setConversationFixtureId(undefined);
      setConversationNpcId(undefined);
      setSelected('protagonist');
      setDestinationMarker(target);
      setDestinationPulseElapsedMs(420);
      setRendererParityPulseFrozen(true);
      setRuntime((current) => {
        const worldState = parseWorldState({
          ...current.worldState,
          protagonist: {
            ...current.worldState.protagonist,
            locationId: 'protagonist_villa',
            worldPosition: { mapId: 'northwest_residential', tileX: start.x, tileY: start.y },
          },
        });
        let staged: RuntimeViewState = {
          movement: requestMovement(fixtureMap, createMovementState(start), target),
          npcMovements: npcMovementState(worldState),
          worldState,
        };
        for (let step = 0; step < 120; step += 1) {
          staged = advanceMovementFrame(staged, 16, 1, false);
          const activeDoor = Object.values(doorMotionPhases(staged.movement)).some((phase) => phase === 'opening');
          const walkingEast = staged.movement.status === 'moving' && staged.movement.direction === 'right' && staged.movement.walkFrame === 1;
          if ((fixture === 'door-transition' && activeDoor) || (fixture === 'walk-east-frame-1' && walkingEast)) return staged;
        }
        throw new Error(`Renderer motion fixture did not reach ${fixture}.`);
      });
      setCamera((current) => centerCameraOnTile(
        fixture === 'door-transition' ? { x: 15, y: 23 } : { x: 18, y: 23 },
        current.zoom,
        surfaceRef.current,
        MAP_PIXELS,
      ));
    };
    window.siWorldOpenVfxFixture = (fixtureMapId, effectId) => {
      const fixtureMap = WORLD_MAP_CATALOG[fixtureMapId];
      const effect = fixtureMap.source.effects.find(({ id }) => id === effectId);
      if (!effect) throw new Error(`Unknown VFX fixture ${fixtureMapId}/${effectId}.`);
      const effectTile = { ...effect.tile };
      const tile = [
        { x: effectTile.x, y: effectTile.y + 3 },
        { x: effectTile.x + 3, y: effectTile.y },
        { x: effectTile.x, y: effectTile.y - 3 },
        { x: effectTile.x - 3, y: effectTile.y },
      ].find((candidate) => (
        candidate.x >= 0 && candidate.x < fixtureMap.source.width &&
        candidate.y >= 0 && candidate.y < fixtureMap.source.height &&
        !fixtureMap.blockedKeys.has(tileKey(candidate))
      ));
      if (!tile) throw new Error(`VFX fixture ${fixtureMapId}/${effectId} has no nearby player tile.`);
      setOpenPanel(undefined);
      setConversationFixtureId(undefined);
      setConversationNpcId(undefined);
      setDestinationMarker(undefined);
      setSelected('protagonist');
      setArrivalLock(`${fixtureMapId}:${tile.x},${tile.y}`);
      setWorldFeedback(`VFX FIXTURE · ${effectId.toUpperCase()}`);
      setRuntime((current) => {
        const absoluteMinute = current.worldState.clock.absoluteMinute;
        const worldState = parseWorldState({
          ...current.worldState,
          clock: {
            ...current.worldState.clock,
            absoluteMinute: mapEffectVisible(effect.kind, absoluteMinute) ? absoluteMinute : 1_260,
          },
          protagonist: {
            ...current.worldState.protagonist,
            locationId: fixtureMapId,
            worldPosition: {
              mapId: fixtureMapId,
              tileX: tile.x,
              tileY: tile.y,
            },
          },
          maps: Object.fromEntries(Object.entries(current.worldState.maps).map(([id, state]) => [id, {
            ...state,
            active: id === fixtureMapId,
          }])),
          npcs: Object.fromEntries(Object.entries(current.worldState.npcs).map(([id, npc]) => [id, {
            ...npc,
            presence: npc.presence.kind === 'in_transit' ? npc.presence : {
              ...npc.presence,
              kind: npc.presence.mapId === fixtureMapId ? 'active_local' : 'inactive',
            },
          }])),
        });
        return {
          movement: createMovementState(tile),
          npcMovements: npcMovementState(worldState),
          worldState,
        };
      });
      setCamera((current) => centerCameraOnTile(effectTile, current.zoom, surfaceRef.current, MAP_PIXELS));
    };
    return () => {
      delete window.siWorldOpenConversationFixture;
      delete window.siWorldCloseConversationFixture;
      delete window.siWorldSetAuthoredDialogueFixture;
      delete window.siWorldOpenVfxFixture;
      delete window.siWorldStartNaturalMovementFixture;
      delete window.siWorldOpenRendererFeedbackFixture;
      delete window.siWorldOpenRendererMotionFixture;
      delete window.siWorldFreezeRendererParityFrame;
      delete window.siWorldSetRendererTestZoom;
    };
  }, []);

  const requestAutosave = useCallback(async (
    state: WorldState,
    trigger: 'sleep' | 'travel' | 'major_quest' | 'manual',
  ) => {
    if (rendererSuspended) return;
    if (persistenceDisabled) {
      setSaveStatus('DEV HARNESS · NO DISK SAVE');
      return;
    }
    const bridge = getDesktopBridge();
    if (!bridge) {
      setSaveStatus('BROWSER · NO DISK SAVE');
      return;
    }
    setSaveStatus('SAVING…');
    try {
      const result = trigger === 'manual'
        ? await bridge.requestSave({
          slotId: 'slot-001', expectedSaveGeneration: saveGeneration.current, trigger, state,
        })
        : await autosaveStableState({
          persistence: bridge,
          state,
          trigger,
          expectedSaveGeneration: saveGeneration.current,
        });
      if (result.status === 'saved') {
        saveGeneration.current = result.saveGeneration;
        setSaveStatus(`SAVED GEN ${result.saveGeneration}`);
        playInterfaceSound('save-complete');
      } else {
        setSaveStatus(`SAVE DEFERRED · ${result.blockingPauseTokens.length} BLOCK`);
      }
    } catch {
      setSaveStatus('SAVE FAILED');
    }
  }, [persistenceDisabled, playInterfaceSound, rendererSuspended]);

  useEffect(() => {
    if (rendererSuspended) return undefined;
    const timer = setInterval(() => {
      setRuntime((current) => questOfferOpen || effectiveSpeed(current.worldState.clock) === 0
        ? current
        : { ...current, worldState: tickWorld(current.worldState, 1_000) });
    }, 1_000);
    return () => clearInterval(timer);
  }, [questOfferOpen, rendererSuspended]);

  useEffect(() => {
    if (rendererSuspended || speed === 0 || transitioning || conversationNpcId || questOfferOpen || openPanel) return;
    let animationFrame = 0;
    let previousTime: number | undefined;
    const animate = (time: number) => {
      const elapsedMs = previousTime === undefined ? 0 : time - previousTime;
      previousTime = time;
      if (elapsedMs > 0) {
        setRuntime((current) => advanceMovementFrame(
          current,
          elapsedMs,
          effectiveSpeed(current.worldState.clock),
          window.siWorldFreezeNpcMotion !== true,
        ));
      }
      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [conversationNpcId, openPanel, questOfferOpen, rendererSuspended, speed, transitioning]);

  // Arms the portal zone the player stands on. The zone stays armed while the player is on it,
  // so the travel timer below runs once instead of restarting on every world tick.
  useEffect(() => {
    const position = runtime.worldState.protagonist.worldPosition;
    const portal = portalAtTile(map, { x: position.tileX, y: position.tileY });
    const key = portal ? `${position.mapId}:${portal.id}` : undefined;
    if (arrivalLock && arrivalLock !== key) setArrivalLock(undefined);
    const ready = portal !== undefined && !rendererSuspended && canStartPortalTransition({
      arrivalLocked: arrivalLock === key,
      transitioning,
      conversationOpen: conversationNpcId !== undefined || questOfferOpen,
      panelOpen: openPanel !== undefined,
    });
    setArmedPortalId(ready ? portal?.id : undefined);
  }, [arrivalLock, conversationNpcId, map, openPanel, questOfferOpen, rendererSuspended, runtime.worldState, transitioning]);

  useEffect(() => {
    if (armedPortalId === undefined) return undefined;
    const timer = setTimeout(() => {
      const state = runtimeRef.current.worldState;
      const portal = WORLD_MAP_CATALOG[state.protagonist.worldPosition.mapId as MapId].portalById.get(armedPortalId);
      if (!portal) return;
      setTransitioning(true);
      setWorldFeedback('TRAVELLING…');
      setRuntime((current) => ({ ...current, movement: cancelMovement(current.movement) }));
      const destinationBlockers = npcBlockers(state, portal.destinationMapId);
      void transitionNeighborhood({
        state,
        catalog: WORLD_MAP_CATALOG,
        sourcePortalId: portal.id,
        loadMap: async (destinationMapId) => WORLD_MAP_CATALOG[destinationMapId],
        destinationBlockers,
        onPaused: (paused) => setRuntime((current) => ({ ...current, worldState: paused })),
      }).then((result) => {
        const tile = { x: result.state.protagonist.worldPosition.tileX, y: result.state.protagonist.worldPosition.tileY };
        setRuntime({ movement: createMovementState(tile), npcMovements: npcMovementState(result.state), worldState: result.state });
        setCamera((current) => centerCameraOnTile(tile, current.zoom, surfaceRef.current, MAP_PIXELS));
        setSelected('protagonist');
        setDestinationMarker(undefined);
        const arrivalPortal = portalAtTile(result.map, tile);
        setArrivalLock(`${result.state.protagonist.worldPosition.mapId}:${arrivalPortal?.id ?? `${tile.x},${tile.y}`}`);
        setWorldFeedback(result.completed ? (result.feedback ?? 'NEIGHBORHOOD ARRIVED') : `TRAVEL FAILED · ${result.feedback}`);
        if (result.completed) void requestAutosave(result.state, 'travel');
      }).finally(() => setTransitioning(false));
    }, PORTAL_GATE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [armedPortalId, requestAutosave]);

  const requestTile = useCallback((target: TilePoint) => {
    setSelected('protagonist');
    setWorldFeedback(undefined);
    setRendererParityPulseFrozen(false);
    setDestinationMarker({ ...target });
    setRuntime((current) => {
      const currentMap = WORLD_MAP_CATALOG[current.worldState.protagonist.worldPosition.mapId as MapId];
      return {
        ...current,
        movement: requestMovement(
          currentMap,
          current.movement,
          target,
          npcBlockers(current.worldState, currentMap.source.id),
        ),
      };
    });
  }, []);

  const handlePrimary = useCallback((point: Readonly<{ x: number; y: number }>) => {
    if (conversationNpcId || questOfferOpen || openPanel) return;
    if (!isScreenPointInsideMap(camera, point, MAP_PIXELS)) return;
    const visibleNpc = Object.entries(npcTiles)
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .find(([, actor]) => {
        const foot = actor.visualFoot ?? tileFootPoint(actor.tile);
        const screen = worldToScreen(camera, foot);
        return point.x >= screen.x - 12 * camera.zoom && point.x <= screen.x + 12 * camera.zoom &&
          point.y >= screen.y - 27 * camera.zoom && point.y <= screen.y + 3 * camera.zoom;
      });
    if (visibleNpc) {
      selectCharacter(visibleNpc[0]);
      setRuntime((current) => ({ ...current, movement: cancelMovement(current.movement) }));
      return;
    }
    const tile = screenToTile(camera, point);
    if (tile.x < 0 || tile.y < 0 || tile.x >= map.source.width || tile.y >= map.source.height) return;
    const candidates = worldClickCandidates(
      map,
      Object.fromEntries(Object.entries(npcTiles).map(([id, actor]) => [id, actor.tile])),
      tile,
    );
    const resolved = resolveClickTarget(candidates);
    if (!resolved) return;
    if (resolved.kind === 'npc') {
      selectCharacter(resolved.id);
      setRuntime((current) => ({ ...current, movement: cancelMovement(current.movement) }));
      return;
    }
    if (resolved.kind === 'object') {
      const interactions = [...map.interactionById.values()].filter(({ ownerId }) => ownerId === resolved.id);
      if (interactions.length > 0) {
        const target = selectOwnerInteractionApproach(
          map,
          resolved.id,
          runtime.movement.player,
          npcBlockers(runtime.worldState, map.source.id),
        );
        if (target) requestTile(target.tile);
        else {
          setRuntime((current) => ({
            ...current,
            movement: { ...cancelMovement(current.movement), status: 'unreachable', feedbackTile: tile },
          }));
          setWorldFeedback('NO USABLE APPROACH');
        }
      } else requestTile(tile);
      return;
    }
    if (resolved.tile) requestTile(resolved.tile);
  }, [camera, conversationNpcId, map, npcTiles, openPanel, questOfferOpen, requestTile, runtime.movement.player, runtime.worldState, selectCharacter]);

  useEffect(() => {
    if (!destinationMarker || rendererSuspended || rendererParityPulseFrozen) return;
    let animationFrame = 0;
    let startedAt: number | undefined;
    const animate = (time: number) => {
      startedAt ??= time;
      const elapsedMs = time - startedAt;
      setDestinationPulseElapsedMs(elapsedMs);
      if (elapsedMs < DESTINATION_PULSE_MS) animationFrame = requestAnimationFrame(animate);
      else setDestinationMarker((current) => current === destinationMarker ? undefined : current);
    };
    setDestinationPulseElapsedMs(0);
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [destinationMarker, rendererParityPulseFrozen, rendererSuspended]);

  const handlePan = useCallback((delta: Readonly<{ x: number; y: number }>) => {
    if (conversationNpcId || questOfferOpen || openPanel) return;
    setCamera((current) => panCamera(current, delta, surface, MAP_PIXELS));
  }, [conversationNpcId, openPanel, questOfferOpen, surface]);
  const handleZoom = useCallback((direction: -1 | 1, anchor: Readonly<{ x: number; y: number }>) => {
    if (conversationNpcId || questOfferOpen || openPanel) return;
    setExplicitWorldZoom(true);
    setCamera((current) => zoomCameraAt(
      current,
      stepWorldZoom(current.zoom, direction),
      anchor,
      surface,
      MAP_PIXELS,
    ));
  }, [conversationNpcId, openPanel, questOfferOpen, surface]);
  const center = useCallback(() => {
    if (conversationNpcId || questOfferOpen || openPanel) return;
    setCamera((current) => centerCameraOnWorld(runtime.movement.visualFoot, current.zoom, surface, MAP_PIXELS));
  }, [conversationNpcId, openPanel, questOfferOpen, runtime.movement.visualFoot, surface]);
  const changeWorldZoom = useCallback((direction: -1 | 1) => {
    setExplicitWorldZoom(true);
    setCamera((current) => zoomCameraAt(
      current,
      stepWorldZoom(current.zoom, direction),
      { x: surface.width / 2, y: surface.height / 2 },
      surface,
      MAP_PIXELS,
    ));
  }, [surface]);
  const selectUiScale = useCallback((scale: UiScale) => {
    setExplicitUiScale(true);
    setUiScale(scale);
  }, []);
  const isPointInteractive = useCallback(
    (point: Readonly<{ x: number; y: number }>) => isScreenPointInsideMap(camera, point, MAP_PIXELS),
    [camera],
  );
  const cancel = useCallback(() => {
    if (questOfferOpen) {
      setAuthoredDialogueFixtureId(undefined);
      setQuestOfferOpen(false);
      setWorldFeedback(authoredDialogueFixtureId
        ? 'MARCUS CONVERSATION ENDED · LINDA QUEST NOT ACCEPTED'
        : 'LINDA QUEST NOT ACCEPTED · TALK TO HER AGAIN ANY TIME');
      playInterfaceSound('panel-close');
      return;
    }
    if (openPanel) {
      setOpenPanel(undefined);
      playInterfaceSound('panel-close');
      return;
    }
    if (conversationNpcId) return;
    playInterfaceSound('cancel');
    setRuntime((current) => ({ ...current, movement: cancelMovement(current.movement) }));
  }, [authoredDialogueFixtureId, conversationNpcId, openPanel, playInterfaceSound, questOfferOpen]);
  const toggleQuests = useCallback(() => {
    if (conversationNpcId || questOfferOpen) return;
    playInterfaceSound(openPanel === 'journal' ? 'panel-close' : 'panel-open');
    setOpenPanel((current) => current === 'journal' ? undefined : 'journal');
  }, [conversationNpcId, openPanel, playInterfaceSound, questOfferOpen]);
  const changeSpeed = useCallback((nextSpeed: 0 | 1 | 2) => {
    setRuntime((current) => ({ ...current, worldState: setWorldSpeed(current.worldState, nextSpeed) }));
  }, []);
  const sleep = useCallback((mode: 'nap' | 'overnight') => {
    setRuntime((current) => {
      const next = sleepWorld(current.worldState, mode);
      return {
        movement: cancelMovement(current.movement),
        npcMovements: npcMovementState(next),
        worldState: next,
      };
    });
  }, []);
  const applyConversationPause = useCallback((state: WorldState) => {
    setRuntime((current) => ({
      ...current,
      movement: cancelMovement(current.movement),
      worldState: state,
    }));
  }, []);
  const applyConversationStableState = useCallback((state: WorldState, committed: boolean) => {
    const sound = committed
      ? relationshipSound(runtime.worldState.relationships, state.relationships)
      : undefined;
    if (sound) playInterfaceSound(sound);
    setRuntime((current) => ({
      movement: cancelMovement(current.movement),
      npcMovements: npcMovementState(state),
      worldState: state,
    }));
    setWorldFeedback(committed ? 'CONVERSATION SAVED' : 'CONVERSATION CANCELLED');
    if (committed) void requestAutosave(state, 'manual');
  }, [playInterfaceSound, requestAutosave, runtime.worldState.relationships]);
  const purchaseSecurityReport = useCallback(() => {
    if (conversationNpcId) return;
    try {
      const result = reduceCommand(runtime.worldState, DomainCommandSchema.parse({
        type: 'purchase-social-option',
        commandId: `command-security-report-r${runtime.worldState.revision}`,
        eventId: `event-security-report-r${runtime.worldState.revision}`,
        scheduledMinute: runtime.worldState.clock.absoluteMinute,
        priority: 50,
        offerId: 'security_report',
      }));
      setRuntime((current) => ({ ...current, worldState: result.state }));
      setWorldFeedback(result.event?.type === 'social-option-purchased' && result.event.changed
        ? 'SECURITY REPORT PURCHASED · QUEST ADVANTAGE READY'
        : 'SECURITY REPORT ALREADY OWNED');
      void requestAutosave(result.state, 'manual');
    } catch {
      setWorldFeedback('SECURITY REPORT PURCHASE FAILED');
    }
  }, [conversationNpcId, requestAutosave, runtime.worldState]);
  const runQuestAction = useCallback((actionId: ContextQuestAction['id']) => {
    if (conversationNpcId || openPanel === 'relationships') return;
    try {
      const stableActionId = actionId.replaceAll('_', '-');
      if (actionId in VERBAL_MISSION_DISCOVERY_FACTS) {
        const record = verbalMissionDiscoveryRecord(runtime.worldState, actionId);
        const result = reduceCommand(runtime.worldState, DomainCommandSchema.parse({
          type: 'record-player-knowledge',
          commandId: `command-discover-${stableActionId}-r${runtime.worldState.revision}`,
          eventId: `event-discover-${stableActionId}-r${runtime.worldState.revision}`,
          scheduledMinute: runtime.worldState.clock.absoluteMinute,
          priority: 70,
          record,
        }));
        setRuntime((current) => ({ ...current, worldState: result.state }));
        setWorldFeedback(`${record.factId.replaceAll('_', ' ').toUpperCase()} · RECORDED`);
        void requestAutosave(result.state, 'manual');
        return;
      }
      const base = {
        commandId: `command-linda-quest-${stableActionId}-r${runtime.worldState.revision}`,
        eventId: `event-linda-quest-${stableActionId}-r${runtime.worldState.revision}`,
        scheduledMinute: runtime.worldState.clock.absoluteMinute,
        priority: 75,
      };
      const candidate = actionId === 'start'
        ? { ...base, type: 'start-linda-quest' as const, requestNpcId: 'linda' }
        : actionId === 'discover'
          ? { ...base, type: 'discover-linda-villa' as const }
          : { ...base, type: 'resolve-linda-quest' as const, approachId: actionId };
      const result = reduceCommand(runtime.worldState, DomainCommandSchema.parse(candidate));
      const sound = relationshipSound(runtime.worldState.relationships, result.state.relationships);
      if (sound) playInterfaceSound(sound);
      setRuntime((current) => ({
        movement: cancelMovement(current.movement),
        npcMovements: npcMovementState(result.state),
        worldState: result.state,
      }));
      if (result.event?.type === 'linda-quest-started') {
        setQuestOfferOpen(false);
        setWorldFeedback('LINDA QUEST STARTED · VAGUE LEAD ADDED');
      } else if (result.event?.type === 'linda-villa-discovered') {
        setWorldFeedback('LINDA VILLA CONFIRMED · THREE CHOICES READY');
      } else if (result.event?.type === 'linda-quest-resolved') {
        setWorldFeedback(`${result.event.resultId.replaceAll('_', ' ').toUpperCase()} · CONSEQUENCES SAVED`);
        triggerVocalCue('consequence');
      }
      void requestAutosave(
        result.state,
        result.event?.type === 'linda-quest-resolved' ? 'major_quest' : 'manual',
      );
    } catch (error) {
      setWorldFeedback(error instanceof Error ? `QUEST BLOCKED · ${error.message.toUpperCase()}` : 'QUEST ACTION FAILED');
    }
  }, [conversationNpcId, openPanel, playInterfaceSound, requestAutosave, runtime.worldState, triggerVocalCue]);
  const advancePoliceHook = useCallback(() => {
    const hook = runtime.worldState.policeAttention === 'noticed'
      ? 'officer_contact'
      : runtime.worldState.policeAttention === 'questioned'
        ? 'ignored_summons'
        : runtime.worldState.policeAttention === 'wanted'
          ? 'wanted_encounter'
          : undefined;
    const evidence = Object.values(runtime.worldState.evidence).find((record) => (
      record.witnessNpcIds.length > 0 && ['noticed', 'linked'].includes(record.status)
    ));
    if (!hook || !evidence) {
      setWorldFeedback('POLICE HOOK BLOCKED · NO MATCHING WITNESSED EVIDENCE');
      return;
    }
    try {
      const stableHook = hook.replaceAll('_', '-');
      const result = reduceCommand(runtime.worldState, DomainCommandSchema.parse({
        type: 'advance-police-attention',
        commandId: `command-police-${stableHook}-r${runtime.worldState.revision}`,
        eventId: `event-police-${stableHook}-r${runtime.worldState.revision}`,
        scheduledMinute: runtime.worldState.clock.absoluteMinute,
        priority: 75,
        evidenceId: evidence.id,
        hook,
      }));
      setRuntime((current) => ({ ...current, worldState: result.state }));
      setWorldFeedback(`POLICE ATTENTION · ${result.state.policeAttention.replaceAll('-', ' ').toUpperCase()}`);
      void requestAutosave(result.state, 'manual');
    } catch (error) {
      setWorldFeedback(error instanceof Error ? `POLICE HOOK FAILED · ${error.message.toUpperCase()}` : 'POLICE HOOK FAILED');
    }
  }, [requestAutosave, runtime.worldState]);

  useEffect(() => {
    const event = runtime.worldState.eventLedger.at(-1);
    if (!event || event.type !== 'sleep-completed' || handledSleepEventId.current === event.eventId) return;
    handledSleepEventId.current = event.eventId;
    setWorldFeedback(sleepCompletionFeedback(event));
    if (event.mode === 'overnight') void requestAutosave(runtime.worldState, 'sleep');
  }, [requestAutosave, runtime.worldState]);

  const playerVisualFoot = snapWorldPoint(runtime.movement.visualFoot, camera.zoom, dpr);
  const selectedFoot = selected === 'protagonist'
    ? playerVisualFoot
    : npcTiles[selected]?.visualFoot ?? tileFootPoint(npcTiles[selected]?.tile ?? runtime.movement.player);
  const worldFrame = useMemo(
    () => buildWorldFrameState(map, runtime.worldState, npcTiles, runtime.movement.direction, 0, {
      visualFoot: playerVisualFoot,
      walkFrame: runtime.movement.walkFrame,
      moving: runtime.movement.segment !== undefined,
      reducedMotion,
      horizontalRunDistance: runtime.movement.horizontalRunDistance,
      pose: selected === 'protagonist' ? (reactionId === 'protagonist' ? 'reaction' : 'idle') : 'idle',
      poseFrame: selected === 'protagonist' ? poseFrame : 0,
    }, {
      camera,
      viewport: surface,
      devicePixelRatio: dpr,
      artMode,
      movements: [runtime.movement, ...Object.values(runtime.npcMovements)],
      selectedFoot,
      destinationMarker,
      destinationPulseElapsedMs: rendererParityPulseFrozen ? 420 : destinationPulseElapsedMs,
      failureTile: runtime.movement.feedbackTile,
      reducedMotion,
      animationTimestampMilliseconds: rendererParityPulseFrozen ? 0 : vfxClock.current.ageMilliseconds,
      vfxAgeStep: rendererParityPulseFrozen ? 0 : vfxAgeStep,
      vfxMode,
    }),
    [artMode, camera, destinationMarker, destinationPulseElapsedMs, dpr, map, npcTiles, playerVisualFoot, poseFrame, reactionId, reducedMotion, rendererParityPulseFrozen, runtime.movement, runtime.npcMovements, runtime.worldState, selected, selectedFoot, surface, vfxAgeStep, vfxMode],
  );
  const propById = new Map(worldFrame.props.map((prop) => [prop.id, prop]));
  const characterById = new Map(worldFrame.characters.map((character) => [character.id, character]));
  const groundedVisuals = worldFrame.groundedOrder.flatMap((entry: WorldGroundedEntry): GroundedVisual[] => {
    const placement = entry.kind === 'prop' ? propById.get(entry.id) : characterById.get(entry.id);
    return placement ? [{ ...entry, placement }] : [];
  });
  const groundBatches = groundedBatches(groundedVisuals);
  const vfxCamera = useMemo(() => ({
    x: camera.x,
    y: camera.y,
    zoom: camera.zoom,
    dpr,
  }), [camera.x, camera.y, camera.zoom, dpr]);
  const drawCounts = worldFrame.drawCounts;
  const staticBatchCount = 1 + (worldFrame.groundDetails.length > 0 ? 1 : 0);
  const responsiveEvidenceInput = useRef({
    camera,
    mapId,
    artMode,
    presentationHash: map.presentation.hash,
    roofGroupId: worldFrame.hiddenRoofGroupId,
    uiScale,
    drawCounts,
    staticBatchCount,
  });
  responsiveEvidenceInput.current = {
    camera,
    mapId,
    artMode,
    presentationHash: map.presentation.hash,
    roofGroupId: worldFrame.hiddenRoofGroupId,
    uiScale,
    drawCounts,
    staticBatchCount,
  };
  const vfxEvidence = useMemo(() => {
    if (!smokeMode) return '';
    const primitiveCount = (kind: typeof VFX_KINDS[number]) => vfxMode === 'procedural'
      ? worldFrame.effects.filter((geometry) => geometry.kind === kind).reduce((total, geometry) => total + geometry.rects.length, 0) +
        worldFrame.fallbackEffects.filter((effect) => effect.kind === kind).length
      : worldFrame.fallbackEffects.filter((effect) => effect.kind === kind).length;
    const primitiveCounts = Object.fromEntries(VFX_KINDS.map((kind) => [kind, primitiveCount(kind)])) as Record<typeof VFX_KINDS[number], number>;
    return JSON.stringify(parseVfxEvidence({
      schemaVersion: 1,
      mode: vfxMode,
      mapId,
      vfxRevision: VFX_REVISION,
      ageStep: vfxAgeStep,
      reducedMotion,
      visibleEmitterIds: worldFrame.visibleEffectIds,
      culledEmitterIds: worldFrame.culledEffectIds,
      fallbackEmitterIds: worldFrame.fallbackEmitterIds,
      primitiveCounts: {
        ...primitiveCounts,
        total: Object.values(primitiveCounts).reduce((total, count) => total + count, 0),
      },
      renderNodeCount: vfxMode === 'procedural'
        ? PROCEDURAL_VFX_RENDER_NODE_COUNT + worldFrame.fallbackEffects.length
        : worldFrame.fallbackEffects.length,
      updateRateHz: vfxMode === 'procedural' && !reducedMotion ? 1_000 / VFX_STEP_MILLISECONDS : 0,
    }));
  }, [mapId, reducedMotion, smokeMode, vfxAgeStep, vfxMode, worldFrame]);
  const smokeGeometry = useMemo(
    () => smokeMode && map.source.id === 'northwest_residential' ? buildSmokeGeometryEvidence(map) : undefined,
    [map, smokeMode],
  );
  const rendererParityEvidence = useMemo(() => smokeMode ? JSON.stringify({
    mapId: worldFrame.mapId,
    mapHash: worldFrame.mapHash,
    presentationHash: worldFrame.presentationHash,
    atlasHash: worldFrame.atlasHash,
    camera: worldFrame.camera,
    viewport: worldFrame.viewport,
    devicePixelRatio: worldFrame.devicePixelRatio,
    hiddenRoofGroupId: worldFrame.hiddenRoofGroupId ?? null,
    characters: worldFrame.characters.filter(({ id }) => ['protagonist', 'linda', 'generic_resident'].includes(id)),
    doors: worldFrame.doors,
    doorPhases,
    movement: {
      direction: runtime.movement.direction,
      status: runtime.movement.status,
      walkFrame: runtime.movement.walkFrame,
      visualFoot: runtime.movement.visualFoot,
    },
    selectionRing: worldFrame.selectionRing,
    destinationPulse: worldFrame.destinationPulse ?? null,
    journalMarkers: worldFrame.journalMarkers,
    failureMarker: worldFrame.failureMarker ?? null,
    visibleEffectIds: worldFrame.visibleEffectIds,
    fallbackEmitterIds: worldFrame.fallbackEmitterIds,
    // Stage 3 amendment 2026-08-15: proves which effects the fallback-circle batch actually draws.
    fallbackEffectIds: worldFrame.fallbackEffects
      .map(({ id }) => id)
      .sort((left, right) => left.localeCompare(right, 'en')),
  }) : '', [doorPhases, runtime.movement, smokeMode, worldFrame]);
  const selectedScreen = worldToScreen(camera, {
    x: worldFrame.selectionRing.worldX,
    y: worldFrame.selectionRing.worldY,
  });
  const selectedName = selected === 'protagonist'
    ? runtime.worldState.protagonist.displayName
    : npcLabel(selected, npcTiles);
  const selectedSubtitle = selected === 'protagonist'
    ? 'YOU'
    : runtime.worldState.relationships[selected]?.stage.replaceAll('_', ' ') ?? 'RESIDENT';
  const selectedSummary = selectedCharacterSummary(
    runtime.worldState,
    selected,
    selected === 'protagonist'
      ? runtime.movement.status === 'moving'
      : runtime.npcMovements[selected]?.status === 'moving',
  );
  const feedbackScreen = worldFrame.failureMarker
    ? worldToScreen(camera, { x: worldFrame.failureMarker.worldX, y: worldFrame.failureMarker.worldY })
    : undefined;
  const portalZones = useMemo(() => map.source.portals.map((portal) => ({
    id: portal.id,
    label: WORLD_MAP_CATALOG[portal.destinationMapId as MapId]?.source.displayName ?? portal.destinationMapId,
    tiles: portalZoneTiles(map, portal),
  })), [map]);
  const zoneGates = portalZones.map((zone) => {
    const top = Math.min(...zone.tiles.map(({ y }) => y));
    const centerX = (Math.min(...zone.tiles.map(({ x }) => x)) + Math.max(...zone.tiles.map(({ x }) => x)) + 1) / 2;
    const anchor = worldToScreen(camera, { x: centerX * TILE_SIZE, y: top * TILE_SIZE });
    return {
      id: zone.id,
      label: zone.label,
      armed: armedPortalId === zone.id,
      cells: zone.tiles.map((tile) => {
        const screen = worldToScreen(camera, { x: tile.x * TILE_SIZE, y: tile.y * TILE_SIZE });
        return { key: `${tile.x},${tile.y}`, left: screen.x, top: screen.y };
      }),
      labelX: anchor.x,
      labelY: anchor.y - 30,
    };
  });
  const currentAreaName = areaName(map, runtime.movement.player);
  const inBedroom = mapId === 'northwest_residential' && currentAreaName === 'BEDROOM';
  const lighting = worldFrame.lighting;
  const shelterCells = worldFrame.shelterCells;

  useEffect(() => {
    if (!smokeMode || typeof document === 'undefined') return undefined;
    window.siWorldMeasureResponsiveEvidence = () => {
      const evidence = measureResponsiveEvidence(document, responsiveEvidenceInput.current);
      if (evidence) setResponsiveEvidence(JSON.stringify(evidence));
      return evidence;
    };
    window.siWorldMeasureResponsiveEvidence();
    return () => {
      delete window.siWorldMeasureResponsiveEvidence;
    };
  }, [smokeMode]);

  const handleRendererContextState = useCallback((state: 'lost' | 'restored' | 'timed-out') => {
    setRendererContextState(state === 'restored' ? 'ready' : state);
  }, []);

  return (
    <WorldInput
      disabled={rendererSuspended}
      isPointInteractive={isPointInteractive}
      onCancel={cancel}
      onCenter={center}
      onPan={handlePan}
      onPrimary={handlePrimary}
      onQuests={toggleQuests}
      onZoom={handleZoom}
    >
      <View
        accessibilityLabel={`${map.source.displayName}; tile ${runtime.movement.player.x},${runtime.movement.player.y}; minute ${runtime.worldState.clock.absoluteMinute}; speed ${runtime.worldState.clock.selectedSpeed}; world zoom ${worldZoomPercentage(camera.zoom)} percent; interface ${Math.round(uiScale * 100)} percent`}
        nativeID="world-state"
        style={[styles.frame, surface]}
      >
        <View nativeID="world-input-viewport" style={[styles.viewport, surface]}>
          <View nativeID="world-canvas" style={[styles.canvasHost, surface]}>
            <ThreeWorldSurface
              frame={worldFrame}
              onContextStateChange={handleRendererContextState}
              onReady={onWorldReady}
            />
            <ZoneGateOverlay
              accent={lighting.accent}
              gates={zoneGates}
              size={TILE_SIZE * camera.zoom}
              viewport={surface}
            />
            <SelectionMarker
              color={lighting.accent}
              label={selected === 'protagonist' ? undefined : selectedName}
              subtitle={selected === 'protagonist' ? undefined : selectedSubtitle}
              viewportWidth={surface.width}
              x={selectedScreen.x}
              y={selectedScreen.y}
              zoom={camera.zoom}
            />
          </View>
        </View>
        <View
          accessibilityLabel={`Art mode ${artMode}; presentation ${map.presentation.hash}`}
          nativeID="world-art-presentation"
          pointerEvents="none"
          style={styles.proofState}
        />
        <View
          accessibilityLabel={worldFrame.hiddenRoofGroupId ? 'Villa roof hidden' : 'Villa roof restored'}
          nativeID="world-roof-state"
          pointerEvents="none"
          style={styles.proofState}
        />
        <View
          accessibilityLabel={responsiveEvidence}
          nativeID="world-responsive-state"
          pointerEvents="none"
          style={styles.proofState}
        />
        <View
          accessibilityLabel={`Surface prop ${surface.width}x${surface.height}`}
          nativeID="world-surface-state"
          pointerEvents="none"
          style={styles.proofState}
        />
        <View
          accessibilityLabel={vfxEvidence}
          nativeID="world-vfx-state"
          pointerEvents="none"
          style={styles.proofState}
        />
        {smokeGeometry ? (
          <View
            accessibilityLabel={JSON.stringify(smokeGeometry)}
            nativeID="world-geometry-state"
            pointerEvents="none"
            style={styles.proofState}
          />
        ) : null}
        <View
          accessibilityLabel={`World camera ${camera.x},${camera.y} at ${camera.zoom}x`}
          nativeID="world-camera-state"
          pointerEvents="none"
          style={styles.proofState}
        />
        <View
          accessibilityLabel={`Linda ${npcTiles.linda?.tile.x ?? -1},${npcTiles.linda?.tile.y ?? -1}; Resident ${npcTiles.generic_resident?.tile.x ?? -1},${npcTiles.generic_resident?.tile.y ?? -1}; NPC count ${Object.keys(npcTiles).length}`}
          nativeID="world-npc-state"
          pointerEvents="none"
          style={styles.proofState}
        />
        {typeof window !== 'undefined' && window.siWorldSmokeMode === true ? (
          <View
            accessibilityLabel={JSON.stringify({
              reducedMotion,
              player: {
                committed: runtime.movement.player,
                visualFoot: runtime.movement.visualFoot,
                direction: runtime.movement.direction,
                walkFrame: runtime.movement.walkFrame,
                status: runtime.movement.status,
                target: runtime.movement.pendingTarget ?? runtime.movement.target ?? null,
                curveActive: Boolean(runtime.movement.latchedTurnCurve),
                horizontalRunDistance: runtime.movement.horizontalRunDistance,
                protagonistWobbleDegrees: protagonistWobbleDegrees({
                  direction: runtime.movement.direction,
                  status: runtime.movement.status,
                  horizontalRunDistance: runtime.movement.horizontalRunDistance,
                  reducedMotion,
                }),
              },
              npcs: Object.fromEntries(Object.entries(runtime.npcMovements).map(([id, movement]) => [id, {
                committed: movement.player,
                visualFoot: movement.visualFoot,
                direction: movement.direction,
                walkFrame: movement.walkFrame,
                status: movement.status,
                curveActive: Boolean(movement.latchedTurnCurve),
                horizontalRunDistance: movement.horizontalRunDistance,
                wobbleDegrees: protagonistWobbleDegrees({
                  direction: movement.direction,
                  status: movement.status,
                  horizontalRunDistance: movement.horizontalRunDistance,
                  reducedMotion,
                }),
              }])),
            })}
            nativeID="world-movement-state"
            pointerEvents="none"
            style={styles.proofState}
          />
        ) : null}
        {smokeMode ? (
          <View
            accessibilityLabel={rendererParityEvidence}
            nativeID="world-renderer-parity-state"
            pointerEvents="none"
            style={styles.proofState}
          />
        ) : null}
        <View
          accessibilityLabel={`Linda quest ${runtime.worldState.quests.linda_boyfriend_check?.status ?? 'missing'}; flags ${(runtime.worldState.quests.linda_boyfriend_check?.flagIds ?? []).join(',') || 'none'}; police ${runtime.worldState.policeAttention}; evidence ${Object.keys(runtime.worldState.evidence).length}`}
          nativeID="world-quest-state"
          pointerEvents="none"
          style={styles.proofState}
        />
        <View
          accessibilityLabel={`Protagonist ${runtime.worldState.protagonist.id}; name ${runtime.worldState.protagonist.displayName}; allowance ${runtime.worldState.economy.weeklyAllowance}; money ${runtime.worldState.inventory.money}`}
          nativeID="world-protagonist-state"
          pointerEvents="none"
          style={styles.proofState}
        />
        <View nativeID="world-ui-location" pointerEvents="none" style={styles.proofState}>
          <Text>{`${map.source.displayName} TILE ${runtime.movement.player.x},${runtime.movement.player.y}`}</Text>
        </View>
        <Hud
          accent={lighting.accent}
          areaName={currentAreaName}
          availableWidth={surface.width}
          hidden={questOfferOpen}
          mapName={map.source.displayName}
          onJournal={toggleQuests}
          onPressSound={() => playInterfaceSound('press')}
          onSave={() => void requestAutosave(runtime.worldState, 'manual')}
          onSocial={() => { playInterfaceSound('panel-open'); setOpenPanel('relationships'); }}
          onSpeed={changeSpeed}
          onUiScale={selectUiScale}
          onZoom={changeWorldZoom}
          saveStatus={saveStatus}
          saveDisabled={transitioning || runtime.movement.status === 'moving' || runtime.worldState.clock.pauseTokens.length > 0}
          state={runtime.worldState}
          uiScale={uiScale}
          zoom={camera.zoom}
          zoomInDisabled={camera.zoom >= MAX_WORLD_ZOOM}
          zoomOutDisabled={camera.zoom <= MIN_WORLD_ZOOM}
        />
        {!questOfferOpen ? <SelectedCharacterCard
          accent={lighting.accent}
          availableWidth={surface.width}
          compact={selected === 'protagonist' && reactionId !== 'protagonist'}
          onCenter={() => setCamera((current) => centerCameraOnWorld(selectedFoot, current.zoom, surface, MAP_PIXELS))}
          onTalk={selectedNpcId && !conversationNpcId && !questOfferOpen && !openPanel
            ? () => {
              if (selectedNpcId === 'linda' && lindaOfferReady) {
                setRuntime((current) => ({ ...current, movement: cancelMovement(current.movement) }));
                setQuestOfferOpen(true);
                playInterfaceSound('panel-open');
              } else if (selectedNpcId === 'linda' && lindaOfferAction?.disabledReason) {
                setWorldFeedback(lindaOfferAction.disabledReason.toUpperCase());
              } else setConversationNpcId(selectedNpcId);
            }
            : undefined}
          summary={selectedSummary}
          pose={reactionId === selected ? 'reaction' : conversationNpcId === selected ? 'talk' : 'idle'}
          uiScale={uiScale}
        /> : null}
        <Text
          accessibilityLiveRegion="polite"
          nativeID="world-ui-zoom-announcement"
          style={styles.proofState}
        >
          {`World zoom ${worldZoomPercentage(camera.zoom)} percent`}
        </Text>
        <Text
          accessibilityLiveRegion="polite"
          nativeID="world-ui-scale-announcement"
          style={styles.proofState}
        >
          {`Interface scale ${Math.round(uiScale * 100)} percent`}
        </Text>
        {inBedroom && !questOfferOpen ? (
          <BedActions
            disabled={transitioning || runtime.worldState.clock.pauseTokens.length > 0}
            minuteOfDay={runtime.worldState.clock.absoluteMinute % 1_440}
            onSleep={sleep}
            uiScale={uiScale}
          />
        ) : null}
        {!questOfferOpen ? <View nativeID="world-ui-help" pointerEvents="none" style={styles.bottomPlate}>
          <Text style={[styles.statusStrong, { fontSize: metrics.persistentText }]}>{worldFeedback ?? (runtime.movement.status === 'unreachable' ? 'NO ROUTE' : runtime.movement.status.toUpperCase())}</Text>
          <Text style={[styles.status, { fontSize: metrics.secondaryText }]}>CLICK MOVE · DRAG PAN · WHEEL ZOOM · F CENTER · Q QUESTS · ESC STOP</Text>
        </View> : null}
        {audioCaption ? (
          <Text accessibilityLiveRegion="polite" nativeID="world-audio-caption" style={styles.audioCaption}>{audioCaption}</Text>
        ) : null}
        {transitioning ? <View nativeID="world-transition-overlay" style={styles.transitionOverlay}><Text style={styles.transitionText}>CROSSING NEIGHBORHOOD…</Text></View> : null}
        {rendererContextState !== 'ready' ? (
          <View nativeID="world-renderer-recovery-overlay" style={styles.transitionOverlay}>
            <Text style={styles.transitionText}>{rendererContextState === 'lost' ? 'RESTORING GRAPHICS…' : 'GRAPHICS RESTART REQUIRED'}</Text>
          </View>
        ) : null}
        {conversationNpcId ? (
          <ConversationPanel
            accent={lighting.accent}
            fixtureDisplayName={conversationFixtureId ? ATLAS_INDEX.characters[conversationFixtureId].displayName : undefined}
            fixtureMode={conversationFixtureId === conversationNpcId}
            locationName={map.source.displayName}
            npcId={conversationNpcId}
            onDismiss={() => {
              setConversationFixtureId(undefined);
              setConversationNpcId(undefined);
            }}
            onPausedState={applyConversationPause}
            onStableState={applyConversationStableState}
            onVocalCue={triggerVocalCue}
            port={conversationPort}
            state={runtime.worldState}
            surface={surface}
            uiScale={uiScale}
          />
        ) : null}
        {questOfferOpen ? (
          <QuestOfferDialogue
            accent={lighting.accent}
            onAccept={() => {
              if (!authoredDialogueFixtureId) {
                runQuestAction('start');
                return;
              }
              setAuthoredDialogueFixtureId(undefined);
              setQuestOfferOpen(false);
              setWorldFeedback('MARCUS SHARED HIS SIDE · LINDA QUEST NOT ACCEPTED');
              playInterfaceSound('panel-close');
            }}
            onDecline={() => {
              setAuthoredDialogueFixtureId(undefined);
              setQuestOfferOpen(false);
              setWorldFeedback(authoredDialogueFixtureId
                ? 'MARCUS CONVERSATION ENDED · LINDA QUEST NOT ACCEPTED'
                : 'LINDA QUEST NOT ACCEPTED · TALK TO HER AGAIN ANY TIME');
              playInterfaceSound('panel-close');
            }}
            playerName={runtime.worldState.protagonist.displayName}
            speakerId={authoredDialogueFixtureId ?? 'linda'}
            speakerName={authoredDialogueFixtureId ? 'Marcus Vale' : 'Linda'}
            speakerText={authoredDialogueFixtureId
              ? 'Linda told you I frightened her? You have heard only one side. Ask what happened before you judge me.'
              : undefined}
            surface={surface}
            uiScale={uiScale}
          />
        ) : null}
        {openPanel === 'journal' ? (
          <JournalPanel
            accent={lighting.accent}
            actions={lindaQuestActions}
            contextActions={contextualMissionActions}
            onAction={runQuestAction}
            onDismiss={() => { playInterfaceSound('panel-close'); setOpenPanel(undefined); }}
            onAdvancePolice={advancePoliceHook}
            onPurchaseSecurityReport={purchaseSecurityReport}
            state={runtime.worldState}
            surface={surface}
            uiScale={uiScale}
          />
        ) : null}
        {openPanel === 'relationships' ? (
          <RelationshipPanel
            accent={lighting.accent}
            npcId={runtime.worldState.relationships[selected] ? selected : 'linda'}
            onDismiss={() => { playInterfaceSound('panel-close'); setOpenPanel(undefined); }}
            state={runtime.worldState}
            surface={surface}
            uiScale={uiScale}
          />
        ) : null}
      </View>
    </WorldInput>
  );
}

const styles = StyleSheet.create({
  audioCaption: { backgroundColor: '#181512dd', bottom: 48, color: '#fff0c7', fontFamily: 'Silkscreen', fontSize: 10, left: 12, paddingHorizontal: 8, paddingVertical: 5, position: 'absolute' },
  bottomPlate: {
    alignItems: 'center', backgroundColor: '#181914e8', borderColor: '#ad7640', borderTopWidth: 2,
    bottom: 0, flexDirection: 'row', gap: 16, left: 0, paddingHorizontal: 14, paddingVertical: 8,
    position: 'absolute', right: 0,
  },
  canvas: { backgroundColor: '#b77945' },
  buttonPressed: { opacity: 0.78, transform: [{ translateY: 1 }] },
      canvasHost: { overflow: 'hidden' },
      feedbackCanvas: { left: 0, position: 'absolute', top: 0 },
  frame: { overflow: 'hidden', position: 'relative' },
  loading: { alignItems: 'center', justifyContent: 'center' },
  proofState: { height: 1, left: 0, opacity: 0, position: 'absolute', top: 0, width: 1 },
  status: { color: '#c3b18f', fontFamily: 'Silkscreen', fontSize: 9 },
  statusStrong: { color: '#f1c65b', fontFamily: 'Silkscreen', fontSize: 10 },
  shelterShade: { position: 'absolute' },
  transitionOverlay: { alignItems: 'center', backgroundColor: '#171411dd', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0 },
  transitionText: { color: '#f1c65b', fontFamily: 'Silkscreen', fontSize: 16 },
  talkButton: { alignItems: 'center', backgroundColor: '#f1c65b', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  talkLabel: { color: '#d6c19a', fontFamily: 'Silkscreen', fontSize: 8 },
  talkPlate: { alignItems: 'center', backgroundColor: '#211d1aee', bottom: 42, flexDirection: 'row', gap: 10, padding: 6, position: 'absolute', right: 14 },
  talkText: { color: '#211d1a', fontFamily: 'Silkscreen', fontSize: 10 },
  viewport: { overflow: 'hidden' },
  zoomButtonDisabled: { opacity: 0.35 },
});
