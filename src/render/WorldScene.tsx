import {
  Atlas,
  Canvas,
  Circle,
  FilterMode,
  Group,
  Line,
  MipmapMode,
  RoundedRect,
  Skia,
  rect,
  useImage,
  vec,
} from '@shopify/react-native-skia';
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
import { parseWorldState, type WorldState } from '../domain/state/schema';
import { VOCAL_CUE_CAPTIONS, type VocalCueId } from '../audio/vocal-cue-policy';
import { useVocalCues } from '../audio/vocal-cues';
import { BedActions } from '../ui/BedActions';
import { ConversationPanel } from '../ui/ConversationPanel';
import { ContextActionMenu } from '../ui/ContextActionMenu';
import { Hud } from '../ui/Hud';
import { JournalPanel } from '../ui/JournalPanel';
import { RelationshipPanel } from '../ui/RelationshipPanel';
import { SelectedCharacterCard } from '../ui/SelectedCharacterCard';
import { SelectionMarker } from '../ui/SelectionMarker';
import { selectedCharacterSummary } from '../ui/selected-character';
import { sleepCompletionFeedback } from '../ui/sleep-feedback';
import { WorldInput } from '../ui/WorldInput';
import { uiMetrics } from '../ui/ui-metrics';
import { groundSpriteAtV2, type CompiledMapV2 } from '../world/maps/compiled-v2';
import { selectOwnerInteractionApproach } from '../world/maps/compiler';
import { resolveClickTarget, worldClickCandidates } from '../world/maps/hit-testing';
import { presentationGroundAt } from '../world/presentation/art-presentation';
import { visualBoundsIntersectTileWindow } from '../world/presentation/visual-bounds';
import { tileKey, type TilePoint } from '../world/maps/schema';
import type { MapId } from '../world/maps/catalog';
import {
  cancelMovement,
  createMovementState,
  requestMovement,
  type MovementState,
} from '../world/pathfinding/movement';
import {
  activeNpcTile,
  movementForNpc,
} from '../world/schedules/active-movement';
import {
  ATLAS_INDEX,
  CHARACTER_IDS,
  atlasRectangle,
  type CharacterId,
} from './atlas';
import {
  MAX_WORLD_ZOOM,
  MIN_WORLD_ZOOM,
  stepWorldZoom,
  worldZoomPercentage,
} from '../domain/presentation/world-zoom';
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
import { WORLD_DEPTH } from './depth';
import { automaticUiScale, automaticWorldZoom, UI_SCALES, type UiScale } from './responsive-layout';
import { AtmosphereOverlay } from './AtmosphereOverlay';
import { DistrictLightingOverlay } from './DistrictLightingOverlay';
import { districtLighting } from './district-lighting';
import { journalMapMarkers } from './journal-markers';
import { measureResponsiveEvidence } from './responsive-evidence';
import { buildSmokeGeometryEvidence } from './smoke-geometry';
import { parseVfxEvidence } from './vfx/evidence';
import { ProceduralMapEffects, PROCEDURAL_VFX_RENDER_NODE_COUNT } from './vfx/ProceduralMapEffects';
import { sampleVfxGeometry, vfxBoundsIntersectWorldRect } from './vfx/procedural-effects';
import { partitionVfxEmitters } from './vfx/seed';
import { VFX_REVISION, VFX_STEP_MILLISECONDS, type AuthoredMapEffect } from './vfx/types';
import { bottomPivotTransform, protagonistWobbleDegrees } from './protagonist-wobble';
import {
  buildWorldFrameState,
  compareWorldLayerTiles,
  type WorldActors,
  type WorldCharacterPlacement,
  type WorldLayer,
} from './world-frame';

const atlasImage = require('../../assets/generated/world-atlas.png') as number;
const NEAREST = { filter: FilterMode.Nearest, mipmap: MipmapMode.None } as const;
const MAP_PIXELS = { width: 64 * 32, height: 48 * 32 } as const;
const TILE_SIZE = 32;
type SpritePlacement = Readonly<{ id: string; sprite: string; worldX: number; worldY: number }>;
type RuntimeViewState = Readonly<{
  movement: MovementState;
  npcMovements: Readonly<Record<string, MovementState>>;
  worldState: WorldState;
}>;

type VisibleTileBounds = Readonly<{
  minimumX: number;
  minimumY: number;
  maximumX: number;
  maximumY: number;
}>;

function visibleTileBounds(camera: CameraState, viewport: ViewportSize, margin = 1): VisibleTileBounds {
  return {
    minimumX: Math.floor(camera.x / TILE_SIZE) - margin,
    minimumY: Math.floor(camera.y / TILE_SIZE) - margin,
    maximumX: Math.ceil((camera.x + viewport.width / camera.zoom) / TILE_SIZE) + margin,
    maximumY: Math.ceil((camera.y + viewport.height / camera.zoom) / TILE_SIZE) + margin,
  };
}

function isVisible(tile: TilePoint, bounds: VisibleTileBounds): boolean {
  return tile.x >= bounds.minimumX && tile.x <= bounds.maximumX &&
    tile.y >= bounds.minimumY && tile.y <= bounds.maximumY;
}

function atlasData(placements: readonly SpritePlacement[], zoom: number) {
  return {
    sprites: placements.map(({ sprite }) => {
      const source = atlasRectangle(sprite);
      return rect(source.x, source.y, source.width, source.height);
    }),
    transforms: placements.map(({ worldX, worldY }) => {
      return Skia.RSXform(zoom, 0, worldX * zoom, worldY * zoom);
    }),
  };
}

function characterAtlasData(placements: readonly WorldCharacterPlacement[], zoom: number) {
  return {
    sprites: placements.map(({ sprite }) => {
      const source = atlasRectangle(sprite);
      return rect(source.x, source.y, source.width, source.height);
    }),
    transforms: placements.map(({ worldX, worldY, angleDegrees = 0 }) => {
      if (angleDegrees === 0) return Skia.RSXform(zoom, 0, worldX * zoom, worldY * zoom);
      const transform = bottomPivotTransform({ worldX, worldY, zoom, angleDegrees });
      return Skia.RSXform(transform.scos, transform.ssin, transform.tx, transform.ty);
    }),
  };
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
        moving: movement?.status === 'moving',
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
  initialConversationFixtureId?: CharacterId;
  initialFeedback: string;
  initialOpenPanel?: 'journal' | 'relationships';
  initialPresentationPreferences: PresentationPreferences;
  initialSaveGeneration: number | null;
  initialSaveStatus: string;
  initialState: WorldState;
  newGame: boolean;
  onPresentationPreferencesChange: (patch: RendererPresentationPatch) => void;
  persistenceDisabled?: boolean;
  surface: ViewportSize;
}>;

export function WorldScene({
  initialConversationFixtureId,
  initialFeedback,
  initialOpenPanel,
  initialPresentationPreferences,
  initialSaveGeneration,
  initialSaveStatus,
  initialState,
  newGame,
  onPresentationPreferencesChange,
  persistenceDisabled = false,
  surface,
}: WorldSceneProps) {
  const image = useImage(atlasImage);
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
  const [selected, setSelected] = useState<string>('protagonist');
  const [reactionId, setReactionId] = useState<string>();
  const [poseFrame, setPoseFrame] = useState<0 | 1>(0);
  const [saveStatus, setSaveStatus] = useState(initialSaveStatus);
  const [transitioning, setTransitioning] = useState(false);
  const [arrivalLock, setArrivalLock] = useState<string>();
  const [worldFeedback, setWorldFeedback] = useState<string | undefined>(initialFeedback);
  const [conversationNpcId, setConversationNpcId] = useState<string | undefined>(initialConversationFixtureId);
  const [conversationFixtureId, setConversationFixtureId] = useState<CharacterId | undefined>(initialConversationFixtureId);
  const [openPanel, setOpenPanel] = useState<'journal' | 'relationships' | undefined>(initialOpenPanel);
  const [audioCaption, setAudioCaption] = useState<string>();
  const [responsiveEvidence, setResponsiveEvidence] = useState('');
  const [vfxAgeStep, setVfxAgeStep] = useState(0);
  const [destinationMarker, setDestinationMarker] = useState<TilePoint>();
  const conversationPort = useMemo(
    () => persistenceDisabled ? createBrowserConversationPort() : getDesktopBridge() ?? createBrowserConversationPort(),
    [persistenceDisabled],
  );
  const saveGeneration = useRef<number | null>(initialSaveGeneration);
  const handledSleepEventId = useRef<string | undefined>(undefined);
  const captionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const previousSurface = useRef(surface);
  const surfaceRef = useRef(surface);
  surfaceRef.current = surface;
  const mapId = runtime.worldState.protagonist.worldPosition.mapId as MapId;
  const map = WORLD_MAP_CATALOG[mapId];
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
  const questActions = lindaContextActions(runtime.worldState, stateNpcId(selected, runtime.worldState));
  const metrics = useMemo(() => uiMetrics(uiScale), [uiScale]);

  useEffect(() => setVfxAgeStep(0), [mapId]);

  useEffect(() => {
    if (reducedMotion) {
      setPoseFrame(0);
      return undefined;
    }
    const timer = setInterval(() => setPoseFrame((current) => current === 0 ? 1 : 0), 720);
    return () => clearInterval(timer);
  }, [reducedMotion]);

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
        const worldState = parseWorldState({
          ...current.worldState,
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
      delete window.siWorldOpenVfxFixture;
    };
  }, []);

  const requestAutosave = useCallback(async (
    state: WorldState,
    trigger: 'sleep' | 'travel' | 'major_quest' | 'manual',
  ) => {
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
      } else {
        setSaveStatus(`SAVE DEFERRED · ${result.blockingPauseTokens.length} BLOCK`);
      }
    } catch {
      setSaveStatus('SAVE FAILED');
    }
  }, [persistenceDisabled]);

  useEffect(() => {
    const timer = setInterval(() => {
      setRuntime((current) => effectiveSpeed(current.worldState.clock) === 0
        ? current
        : { ...current, worldState: tickWorld(current.worldState, 1_000) });
    }, 1_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (speed === 0 || transitioning || conversationNpcId || openPanel) return;
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
        ));
      }
      animationFrame = requestAnimationFrame(animate);
    };
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [conversationNpcId, openPanel, speed, transitioning]);

  useEffect(() => {
    const position = runtime.worldState.protagonist.worldPosition;
    const key = `${position.mapId}:${position.tileX},${position.tileY}`;
    if (arrivalLock && arrivalLock !== key) setArrivalLock(undefined);
    if (!canStartPortalTransition({
      arrivalLocked: arrivalLock === key,
      transitioning,
      movementStatus: runtime.movement.status,
      conversationOpen: conversationNpcId !== undefined,
      panelOpen: openPanel !== undefined,
    })) return;
    const portal = map.source.portals.find(({ tile }) => tile.x === position.tileX && tile.y === position.tileY);
    if (!portal) return;
    setTransitioning(true);
    setWorldFeedback('TRAVELLING…');
    const destinationBlockers = npcBlockers(runtime.worldState, portal.destinationMapId);
    void transitionNeighborhood({
      state: runtime.worldState,
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
      setArrivalLock(`${result.state.protagonist.worldPosition.mapId}:${tile.x},${tile.y}`);
      setWorldFeedback(result.completed ? (result.feedback ?? 'NEIGHBORHOOD ARRIVED') : `TRAVEL FAILED · ${result.feedback}`);
      if (result.completed) void requestAutosave(result.state, 'travel');
    }).finally(() => setTransitioning(false));
  }, [arrivalLock, conversationNpcId, map, openPanel, requestAutosave, runtime.movement.status, runtime.worldState, transitioning]);

  const requestTile = useCallback((target: TilePoint) => {
    setSelected('protagonist');
    setWorldFeedback(undefined);
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
    if (conversationNpcId || openPanel) return;
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
  }, [camera, conversationNpcId, map, npcTiles, openPanel, requestTile, runtime.movement.player, runtime.worldState, selectCharacter]);

  const requestedMarkerTarget = runtime.movement.status === 'unreachable'
    ? undefined
    : runtime.movement.pendingTarget ?? runtime.movement.target;
  useEffect(() => {
    if (!requestedMarkerTarget) return;
    setDestinationMarker({ ...requestedMarkerTarget });
    const timer = setTimeout(() => setDestinationMarker(undefined), 350);
    return () => clearTimeout(timer);
  }, [requestedMarkerTarget?.x, requestedMarkerTarget?.y]);

  const handlePan = useCallback((delta: Readonly<{ x: number; y: number }>) => {
    if (conversationNpcId || openPanel) return;
    setCamera((current) => panCamera(current, delta, surface, MAP_PIXELS));
  }, [conversationNpcId, openPanel, surface]);
  const handleZoom = useCallback((direction: -1 | 1, anchor: Readonly<{ x: number; y: number }>) => {
    if (conversationNpcId || openPanel) return;
    setExplicitWorldZoom(true);
    setCamera((current) => zoomCameraAt(
      current,
      stepWorldZoom(current.zoom, direction),
      anchor,
      surface,
      MAP_PIXELS,
    ));
  }, [conversationNpcId, openPanel, surface]);
  const center = useCallback(() => {
    if (conversationNpcId || openPanel) return;
    setCamera((current) => centerCameraOnWorld(runtime.movement.visualFoot, current.zoom, surface, MAP_PIXELS));
  }, [conversationNpcId, openPanel, runtime.movement.visualFoot, surface]);
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
    if (openPanel) {
      setOpenPanel(undefined);
      return;
    }
    if (conversationNpcId) return;
    setRuntime((current) => ({ ...current, movement: cancelMovement(current.movement) }));
  }, [conversationNpcId, openPanel]);
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
    setRuntime((current) => ({
      movement: cancelMovement(current.movement),
      npcMovements: npcMovementState(state),
      worldState: state,
    }));
    setWorldFeedback(committed ? 'CONVERSATION SAVED' : 'CONVERSATION CANCELLED');
    if (committed) void requestAutosave(state, 'manual');
  }, [requestAutosave]);
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
    if (conversationNpcId || openPanel) return;
    try {
      const stableActionId = actionId.replaceAll('_', '-');
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
      setRuntime((current) => ({
        movement: cancelMovement(current.movement),
        npcMovements: npcMovementState(result.state),
        worldState: result.state,
      }));
      if (result.event?.type === 'linda-quest-started') {
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
  }, [conversationNpcId, openPanel, requestAutosave, runtime.worldState, triggerVocalCue]);
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

  const visibility = visibleTileBounds(camera, surface);
  const visibleFloors = useMemo(() => {
    const placements: SpritePlacement[] = [];
    for (let y = 0; y < map.source.height; y += 1) {
      for (let x = 0; x < map.source.width; x += 1) {
        const tile = { x, y };
        const cell = presentationGroundAt(map.presentation, tile, map.source.width);
        if (visualBoundsIntersectTileWindow(tile, cell.visualBounds, visibility)) {
          placements.push({
            id: `floor-${x}-${y}`,
            sprite: artMode === 'legacy' ? groundSpriteAtV2(map, tile) : cell.sprite,
            worldX: x * TILE_SIZE,
            worldY: y * TILE_SIZE,
          });
        }
      }
    }
    return placements;
  }, [artMode, map, visibility.maximumX, visibility.maximumY, visibility.minimumX, visibility.minimumY]);
  const visibleGroundDetails = useMemo(() => {
    if (artMode === 'legacy') return [];
    const details = [
      ...map.presentation.transitions.flatMap((transition) => transition.sprite ? [{
        id: transition.id,
        offsetX: 0,
        offsetY: 0,
        sprite: transition.sprite,
        tile: transition.tile,
      }] : []),
      ...map.presentation.decals.map((decal) => ({
        id: decal.id,
        offsetX: decal.offsetX,
        offsetY: decal.offsetY,
        sprite: decal.sprite,
        tile: decal.tile,
      })),
    ];
    return details.filter(({ tile, sprite }) => visualBoundsIntersectTileWindow(
      tile,
      map.presentation.visualBoundsBySprite[sprite] ?? { left: 0, top: 0, right: 32, bottom: 32 },
      visibility,
    )).map((detail) => ({
      id: detail.id,
      sprite: detail.sprite,
      worldX: detail.tile.x * TILE_SIZE + detail.offsetX,
      worldY: detail.tile.y * TILE_SIZE + detail.offsetY,
    }));
  }, [artMode, map, visibility.maximumX, visibility.maximumY, visibility.minimumX, visibility.minimumY]);
  const visibleProps = useMemo(() => [
    ...[...map.objectPartById.values()].filter(({ tile, sprite }) => visualBoundsIntersectTileWindow(
      tile,
      map.presentation.visualBoundsBySprite[sprite] ?? { left: 0, top: 0, right: 32, bottom: 32 },
      visibility,
    )).map((part) => ({
      id: part.id,
      sprite: part.sprite,
      tile: part.depthAnchor,
      worldX: part.tile.x * TILE_SIZE,
      worldY: part.tile.y * TILE_SIZE,
    })),
    ...[...map.doorById.values()].filter(({ tile, sprite }) => visualBoundsIntersectTileWindow(
      tile,
      map.presentation.visualBoundsBySprite[sprite] ?? { left: 0, top: 0, right: 32, bottom: 32 },
      visibility,
    )).map((door) => ({
      id: door.id,
      sprite: door.sprite,
      tile: door.tile,
      worldX: door.tile.x * TILE_SIZE,
      worldY: door.tile.y * TILE_SIZE,
    })),
  ].sort((left, right) => compareWorldLayerTiles(WORLD_DEPTH.prop, left, right)), [
    map,
    visibility.maximumX,
    visibility.maximumY,
    visibility.minimumX,
    visibility.minimumY,
  ]);
  const visibleWalls = useMemo(() => map.wallTiles.filter(({ tile }) => isVisible(tile, visibility))
    .sort((left, right) => compareWorldLayerTiles(WORLD_DEPTH.wall, left, right))
    .map((wall) => ({ id: wall.id, sprite: wall.sprite, worldX: wall.tile.x * TILE_SIZE, worldY: wall.tile.y * TILE_SIZE })), [
    map,
    visibility.maximumX,
    visibility.maximumY,
    visibility.minimumX,
    visibility.minimumY,
  ]);
  const playerVisualFoot = snapWorldPoint(runtime.movement.visualFoot, camera.zoom, dpr);
  const worldFrame = useMemo(
    () => buildWorldFrameState(map, runtime.worldState, npcTiles, runtime.movement.direction, 0, {
      visualFoot: playerVisualFoot,
      walkFrame: runtime.movement.walkFrame,
      moving: runtime.movement.status === 'moving',
      reducedMotion,
      horizontalRunDistance: runtime.movement.horizontalRunDistance,
      pose: selected === 'protagonist' ? (reactionId === 'protagonist' ? 'reaction' : 'idle') : 'idle',
      poseFrame: selected === 'protagonist' ? poseFrame : 0,
    }),
    [map, npcTiles, playerVisualFoot, poseFrame, reactionId, reducedMotion, runtime.movement.direction, runtime.movement.horizontalRunDistance, runtime.movement.status, runtime.movement.walkFrame, runtime.worldState, selected],
  );
  const characters = useMemo(() => worldFrame.characters.filter(({ tile }) => isVisible(tile, visibility)), [
    visibility.maximumX,
    visibility.maximumY,
    visibility.minimumX,
    visibility.minimumY,
    worldFrame.characters,
  ]);
  const floorAtlas = useMemo(() => atlasData(visibleFloors, camera.zoom), [camera.zoom, visibleFloors]);
  const groundDetailAtlas = useMemo(() => atlasData(visibleGroundDetails, camera.zoom), [camera.zoom, visibleGroundDetails]);
  const propAtlas = useMemo(() => atlasData(visibleProps, camera.zoom), [camera.zoom, visibleProps]);
  const characterAtlas = useMemo(() => characterAtlasData(characters, camera.zoom), [camera.zoom, characters]);
  const wallAtlas = useMemo(() => atlasData(visibleWalls, camera.zoom), [camera.zoom, visibleWalls]);
  const visibleRoofTiles = useMemo(() => map.presentation.roofs
    .filter(({ roofGroupId }) => worldFrame.visibleRoofGroupIds.includes(roofGroupId))
    .filter(({ tile, visualBounds }) => visualBoundsIntersectTileWindow(tile, visualBounds, visibility))
    .map((roof) => ({
      id: roof.id,
      sprite: roof.sprite,
      worldX: roof.tile.x * TILE_SIZE,
      worldY: roof.tile.y * TILE_SIZE,
    })), [
    map,
    visibility.maximumX,
    visibility.maximumY,
    visibility.minimumX,
    visibility.minimumY,
    worldFrame.visibleRoofGroupIds,
  ]);
  const vfxViewport = useMemo(() => ({
    left: camera.x - TILE_SIZE,
    top: camera.y - TILE_SIZE,
    right: camera.x + surface.width / camera.zoom + TILE_SIZE,
    bottom: camera.y + surface.height / camera.zoom + TILE_SIZE,
  }), [camera.x, camera.y, camera.zoom, surface.height, surface.width]);
  const visibleEffects = useMemo(() => map.source.effects.filter((effect) => (
    vfxBoundsIntersectWorldRect(effect, vfxViewport)
  )), [map, vfxViewport]);
  const culledEffects = useMemo(() => map.source.effects.filter((effect) => (
    !vfxBoundsIntersectWorldRect(effect, vfxViewport)
  )), [map, vfxViewport]);
  const vfxEmitters = useMemo(
    () => partitionVfxEmitters(mapId, visibleEffects),
    [mapId, visibleEffects],
  );
  const vfxCamera = useMemo(() => ({
    x: camera.x,
    y: camera.y,
    zoom: camera.zoom,
    dpr,
  }), [camera.x, camera.y, camera.zoom, dpr]);
  const roofAtlas = useMemo(() => atlasData(visibleRoofTiles, camera.zoom), [camera.zoom, visibleRoofTiles]);
  const atlasCameraTransform = useMemo(() => [
    { translateX: -camera.x * camera.zoom },
    { translateY: -camera.y * camera.zoom },
  ], [camera.x, camera.y, camera.zoom]);
  const drawCounts = useMemo(() => {
    const counts = {
      floor: visibleFloors.length + visibleGroundDetails.length,
      prop: visibleProps.length,
      shadow: characters.length,
      character: characters.length,
      effect: visibleEffects.length,
      wall: visibleWalls.length,
      roof: visibleRoofTiles.length,
    } as const;
    return { ...counts, total: Object.values(counts).reduce((total, count) => total + count, 0) };
  }, [characters.length, visibleEffects.length, visibleFloors.length, visibleGroundDetails.length, visibleProps.length, visibleRoofTiles.length, visibleWalls.length]);
  const staticBatchCount = 1 + (visibleGroundDetails.length > 0 ? 1 : 0);
  const vfxEvidence = useMemo(() => {
    if (!smokeMode) return '';
    const geometries = vfxMode === 'procedural'
      ? vfxEmitters.valid.map((emitter) => sampleVfxGeometry(
        emitter,
        vfxAgeStep * VFX_STEP_MILLISECONDS,
        reducedMotion,
      ))
      : [];
    const firePrimitiveCount = vfxMode === 'procedural'
      ? geometries.filter(({ kind }) => kind === 'fire').reduce((total, geometry) => total + geometry.rects.length, 0) +
        vfxEmitters.fallback.filter(({ kind }) => kind === 'fire').length
      : visibleEffects.filter(({ kind }) => kind === 'fire').length;
    const sparklePrimitiveCount = vfxMode === 'procedural'
      ? geometries.filter(({ kind }) => kind === 'sparkle').reduce((total, geometry) => total + geometry.rects.length, 0) +
        vfxEmitters.fallback.filter(({ kind }) => kind === 'sparkle').length
      : visibleEffects.filter(({ kind }) => kind === 'sparkle').length;
    return JSON.stringify(parseVfxEvidence({
      schemaVersion: 1,
      mode: vfxMode,
      mapId,
      vfxRevision: VFX_REVISION,
      ageStep: vfxAgeStep,
      reducedMotion,
      visibleEmitterIds: visibleEffects.map(({ id }) => id).sort((left, right) => left.localeCompare(right, 'en')),
      culledEmitterIds: culledEffects.map(({ id }) => id).sort((left, right) => left.localeCompare(right, 'en')),
      fallbackEmitterIds: vfxEmitters.fallback.map(({ id }) => id).sort((left, right) => left.localeCompare(right, 'en')),
      primitiveCounts: {
        fire: firePrimitiveCount,
        sparkle: sparklePrimitiveCount,
        total: firePrimitiveCount + sparklePrimitiveCount,
      },
      renderNodeCount: vfxMode === 'procedural'
        ? PROCEDURAL_VFX_RENDER_NODE_COUNT + vfxEmitters.fallback.length
        : visibleEffects.length,
      updateRateHz: vfxMode === 'procedural' && !reducedMotion ? 1_000 / VFX_STEP_MILLISECONDS : 0,
    }));
  }, [culledEffects, mapId, reducedMotion, smokeMode, vfxAgeStep, vfxEmitters, vfxMode, visibleEffects]);
  const smokeGeometry = useMemo(
    () => smokeMode && map.source.id === 'northwest_residential' ? buildSmokeGeometryEvidence(map) : undefined,
    [map, smokeMode],
  );
  const selectedFoot = selected === 'protagonist'
    ? playerVisualFoot
    : npcTiles[selected]?.visualFoot ?? tileFootPoint(npcTiles[selected]?.tile ?? runtime.movement.player);
  const selectedScreen = worldToScreen(camera, selectedFoot);
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
  const feedbackScreen = runtime.movement.feedbackTile
    ? worldToScreen(camera, {
      x: runtime.movement.feedbackTile.x * TILE_SIZE + 16,
      y: runtime.movement.feedbackTile.y * TILE_SIZE + 16,
    })
    : undefined;
  const journalMarkers = useMemo(
    () => journalMapMarkers(runtime.worldState.journal, map),
    [map, runtime.worldState.journal],
  );
  const currentAreaName = areaName(map, runtime.movement.player);
  const inBedroom = mapId === 'northwest_residential' && currentAreaName === 'BEDROOM';
  const lighting = districtLighting(mapId, runtime.worldState.clock.absoluteMinute);
  const shelterCells = map.source.roofGroups.find(({ id }) => id === worldFrame.hiddenRoofGroupId)?.interiorCells ?? [];

  useEffect(() => {
    if (!smokeMode || typeof document === 'undefined') return;
    let frameId = 0;
    const timer = setTimeout(() => {
      frameId = requestAnimationFrame(() => {
        const evidence = measureResponsiveEvidence(document, {
          camera,
          mapId,
          artMode,
          presentationHash: map.presentation.hash,
          roofGroupId: worldFrame.hiddenRoofGroupId,
          uiScale,
          drawCounts,
          staticBatchCount,
        });
        if (evidence) setResponsiveEvidence(JSON.stringify(evidence));
      });
    }, 80);
    return () => {
      clearTimeout(timer);
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [artMode, camera, conversationNpcId, drawCounts, image, map.presentation.hash, mapId, openPanel, smokeMode, staticBatchCount, surface, uiScale, worldFrame.hiddenRoofGroupId]);

  if (!image) {
    return <View style={[styles.loading, surface]}><Text style={[styles.status, { fontSize: metrics.secondaryText }]}>DECODING WORLD STATE…</Text></View>;
  }

  const renderLayer = (layer: WorldLayer) => {
    switch (layer) {
      case 'floor':
        return (
          <Group key={layer} transform={atlasCameraTransform}>
            <Atlas image={image} sampling={NEAREST} sprites={floorAtlas.sprites} transforms={floorAtlas.transforms} />
            {visibleGroundDetails.length > 0 ? (
              <Atlas image={image} sampling={NEAREST} sprites={groundDetailAtlas.sprites} transforms={groundDetailAtlas.transforms} />
            ) : null}
          </Group>
        );
      case 'prop':
        return <Group key={layer} transform={atlasCameraTransform}><Atlas image={image} sampling={NEAREST} sprites={propAtlas.sprites} transforms={propAtlas.transforms} /></Group>;
      case 'shadow':
        return (
          <Group key={layer} transform={atlasCameraTransform}>
            {characters.map((character) => (
              <Group key={`shadow-${character.id}`}>
                <Line
                  color={lighting.shadow.color}
                  p1={vec((character.shadowWorldX + 5) * camera.zoom, (character.shadowWorldY + 1) * camera.zoom)}
                  p2={vec((character.shadowWorldX + lighting.shadow.x) * camera.zoom, (character.shadowWorldY + lighting.shadow.y) * camera.zoom)}
                  strokeCap="round"
                  strokeWidth={5 * camera.zoom}
                />
                <RoundedRect color="#14171170" height={5 * camera.zoom} r={2 * camera.zoom} width={18 * camera.zoom} x={(character.shadowWorldX - 2) * camera.zoom} y={(character.shadowWorldY - 1) * camera.zoom} />
                <RoundedRect color="#2019158f" height={3 * camera.zoom} r={camera.zoom} width={12 * camera.zoom} x={(character.shadowWorldX + 1) * camera.zoom} y={character.shadowWorldY * camera.zoom} />
              </Group>
            ))}
          </Group>
        );
      case 'character':
        return <Group key={layer} transform={atlasCameraTransform}><Atlas image={image} sampling={NEAREST} sprites={characterAtlas.sprites} transforms={characterAtlas.transforms} /></Group>;
      case 'effect': {
        const circleEffects: readonly AuthoredMapEffect[] = vfxMode === 'circle'
          ? visibleEffects
          : vfxEmitters.fallback;
        return (
          <Group key={layer}>
            {vfxMode === 'procedural' ? (
              <ProceduralMapEffects
                camera={vfxCamera}
                emitters={vfxEmitters.valid}
                key={mapId}
                mapEntryIdentity={mapId}
                onAgeStepChange={smokeMode ? setVfxAgeStep : undefined}
                reducedMotion={reducedMotion}
                running={speed > 0}
              />
            ) : null}
            {circleEffects.map((effect) => {
          const screen = worldToScreen(camera, { x: effect.tile.x * 32 + 16, y: effect.tile.y * 32 + 16 });
          return <Circle color={effect.kind === 'fire' ? '#f07832' : '#f5dd9d'} cx={screen.x} cy={screen.y} key={effect.id} r={3 * camera.zoom} />;
            })}
          </Group>
        );
      }
      case 'wall':
        return <Group key={layer} transform={atlasCameraTransform}><Atlas image={image} sampling={NEAREST} sprites={wallAtlas.sprites} transforms={wallAtlas.transforms} /></Group>;
      case 'roof':
        return <Group key={layer} transform={atlasCameraTransform}><Atlas image={image} sampling={NEAREST} sprites={roofAtlas.sprites} transforms={roofAtlas.transforms} /></Group>;
    }
  };

  return (
    <WorldInput
      isPointInteractive={isPointInteractive}
      onCancel={cancel}
      onCenter={center}
      onPan={handlePan}
      onPrimary={handlePrimary}
      onZoom={handleZoom}
    >
      <View
        accessibilityLabel={`${map.source.displayName}; tile ${runtime.movement.player.x},${runtime.movement.player.y}; minute ${runtime.worldState.clock.absoluteMinute}; speed ${runtime.worldState.clock.selectedSpeed}; world zoom ${worldZoomPercentage(camera.zoom)} percent; interface ${Math.round(uiScale * 100)} percent`}
        nativeID="world-state"
        style={[styles.frame, surface]}
      >
        <View nativeID="world-input-viewport" style={[styles.viewport, surface]}>
          <View nativeID="world-canvas" style={[styles.canvasHost, surface]}>
            <Canvas style={StyleSheet.flatten([styles.canvas, surface])}>
            {worldFrame.layerOrder.slice(0, 3).map(renderLayer)}
            {worldFrame.layerOrder.slice(3, 6).map(renderLayer)}
            {destinationMarker ? (() => {
              const screen = worldToScreen(camera, tileFootPoint(destinationMarker));
              return <Circle color="#f5dd9d88" cx={screen.x} cy={screen.y} r={Math.max(2, camera.zoom * 2)} style="stroke" strokeWidth={camera.zoom} />;
            })() : null}
            {worldFrame.layerOrder.slice(6).map(renderLayer)}
            {journalMarkers.map((marker) => {
              const foot = worldToScreen(camera, tileFootPoint(marker.tile));
              const centerX = foot.x - 10 * camera.zoom;
              const centerY = foot.y - 30 * camera.zoom;
              return (
                <Group key={`journal-marker-${marker.journalEntryId}`}>
                  <Line color="#201915" p1={vec(centerX, centerY + 4 * camera.zoom)} p2={vec(foot.x - 4 * camera.zoom, foot.y - 5 * camera.zoom)} strokeWidth={4 * camera.zoom} />
                  <Line color="#f1c65b" p1={vec(centerX, centerY + 4 * camera.zoom)} p2={vec(foot.x - 4 * camera.zoom, foot.y - 5 * camera.zoom)} strokeWidth={2 * camera.zoom} />
                  <Circle color="#201915" cx={centerX} cy={centerY} r={7 * camera.zoom} />
                  <Circle color="#f1c65b" cx={centerX} cy={centerY} r={5 * camera.zoom} />
                  <Circle color="#201915" cx={centerX} cy={centerY} r={2 * camera.zoom} />
                </Group>
              );
            })}
            {feedbackScreen ? (
              <>
                <Line color="#ef5b43" p1={vec(feedbackScreen.x - 7, feedbackScreen.y - 7)} p2={vec(feedbackScreen.x + 7, feedbackScreen.y + 7)} strokeWidth={3} />
                <Line color="#ef5b43" p1={vec(feedbackScreen.x + 7, feedbackScreen.y - 7)} p2={vec(feedbackScreen.x - 7, feedbackScreen.y + 7)} strokeWidth={3} />
              </>
            ) : null}
            </Canvas>
            {shelterCells.map((shelter) => {
              const shelterScreen = worldToScreen(camera, { x: shelter.x * TILE_SIZE, y: shelter.y * TILE_SIZE });
              return <View
                key={`${shelter.x},${shelter.y}`}
                pointerEvents="none"
                style={[
                  styles.shelterShade,
                  { backgroundColor: lighting.shelterShade },
                  {
                    height: shelter.height * TILE_SIZE * camera.zoom,
                    left: shelterScreen.x,
                    top: shelterScreen.y,
                    width: shelter.width * TILE_SIZE * camera.zoom,
                  },
                ]}
              />;
            })}
            <DistrictLightingOverlay
              absoluteMinute={runtime.worldState.clock.absoluteMinute}
              camera={camera}
              mapId={mapId}
              surface={surface}
            />
            <AtmosphereOverlay
              absoluteMinute={runtime.worldState.clock.absoluteMinute}
              reducedMotion={reducedMotion}
            />
            <SelectionMarker
              color={lighting.accent}
              label={selected === 'protagonist' ? undefined : selectedName}
              reducedMotion={reducedMotion}
              subtitle={selected === 'protagonist' ? undefined : selectedSubtitle}
              viewportWidth={surface.width}
              x={selectedScreen.x}
              y={selectedScreen.y}
              zoom={camera.zoom}
            />
          </View>
        </View>
        <View pointerEvents="none" style={styles.areaLabels}>
          {(map.source.roofGroups.length === 0 || worldFrame.hiddenRoofGroupId ? map.source.areas : []).map((area) => {
            const screen = worldToScreen(camera, {
              x: (area.bounds.x + area.bounds.width / 2) * TILE_SIZE,
              y: (area.bounds.y + area.bounds.height / 2) * TILE_SIZE,
            });
            return (
              <Text key={area.id} style={[styles.areaLabel, { left: screen.x - 48, top: screen.y - 9 }]}>
                {area.id.replaceAll('-', ' ').toUpperCase()}{area.id === 'ferry-terminal' ? ' · CLOSED' : ''}
              </Text>
            );
          })}
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
          areaName={currentAreaName}
          mapName={map.source.displayName}
          onSpeed={changeSpeed}
          saveStatus={saveStatus}
          state={runtime.worldState}
          uiScale={uiScale}
          zoom={camera.zoom}
        />
        <SelectedCharacterCard
          availableWidth={surface.width}
          onCenter={() => setCamera((current) => centerCameraOnWorld(selectedFoot, current.zoom, surface, MAP_PIXELS))}
          onTalk={stateNpcId(selected, runtime.worldState) && !conversationNpcId && !openPanel
            ? () => setConversationNpcId(stateNpcId(selected, runtime.worldState))
            : undefined}
          summary={selectedSummary}
          pose={reactionId === selected ? 'reaction' : conversationNpcId === selected ? 'talk' : 'idle'}
          uiScale={uiScale}
        />
        <View nativeID="world-ui-zoom" style={styles.zoomPlate}>
          <Text style={[styles.controlLabel, { fontSize: metrics.secondaryText }]}>VIEW</Text>
          <Pressable
            accessibilityLabel="Decrease world zoom"
            accessibilityState={{ disabled: camera.zoom <= MIN_WORLD_ZOOM }}
            disabled={camera.zoom <= MIN_WORLD_ZOOM}
            onPress={() => changeWorldZoom(-1)}
            style={({ pressed }) => [
              styles.zoomButton,
              { height: metrics.pointerTarget, width: metrics.pointerTarget },
              camera.zoom <= MIN_WORLD_ZOOM && styles.zoomButtonDisabled,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={[styles.zoomText, { fontSize: metrics.secondaryText }]}>-</Text>
          </Pressable>
          <View
            accessibilityLabel={`World zoom ${worldZoomPercentage(camera.zoom)} percent`}
            nativeID="world-ui-zoom-value"
            style={[styles.zoomValue, { height: metrics.pointerTarget, minWidth: metrics.pointerTarget + 18 }]}
          >
            <Text style={[styles.zoomText, { fontSize: metrics.secondaryText }]}>
              {worldZoomPercentage(camera.zoom)}%
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Increase world zoom"
            accessibilityState={{ disabled: camera.zoom >= MAX_WORLD_ZOOM }}
            disabled={camera.zoom >= MAX_WORLD_ZOOM}
            onPress={() => changeWorldZoom(1)}
            style={({ pressed }) => [
              styles.zoomButton,
              { height: metrics.pointerTarget, width: metrics.pointerTarget },
              camera.zoom >= MAX_WORLD_ZOOM && styles.zoomButtonDisabled,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={[styles.zoomText, { fontSize: metrics.secondaryText }]}>+</Text>
          </Pressable>
        </View>
        <Text
          accessibilityLiveRegion="polite"
          nativeID="world-ui-zoom-announcement"
          style={styles.proofState}
        >
          {`World zoom ${worldZoomPercentage(camera.zoom)} percent`}
        </Text>
        <View nativeID="world-ui-scale" style={[styles.uiScalePlate, { top: 22 + metrics.pointerTarget }]}>
          <Text style={[styles.controlLabel, { fontSize: metrics.secondaryText }]}>UI</Text>
          {UI_SCALES.map((scale) => (
            <Pressable
              accessibilityLabel={`Set ${Math.round(scale * 100)} percent interface scale`}
              key={scale}
              onPress={() => selectUiScale(scale)}
              style={({ pressed }) => [
                styles.uiScaleButton,
                { minHeight: metrics.pointerTarget, minWidth: metrics.pointerTarget + 10 },
                uiScale === scale && styles.zoomButtonActive,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={[styles.zoomText, { fontSize: metrics.secondaryText }, uiScale === scale && styles.zoomTextActive]}>
                {Math.round(scale * 100)}%
              </Text>
            </Pressable>
          ))}
        </View>
        <Text
          accessibilityLiveRegion="polite"
          nativeID="world-ui-scale-announcement"
          style={styles.proofState}
        >
          {`Interface scale ${Math.round(uiScale * 100)} percent`}
        </Text>
        {!conversationNpcId && !openPanel ? (
          <View nativeID="world-ui-social-nav" style={[styles.socialNav, { top: 32 + metrics.pointerTarget * 2 }]}>
            <Pressable accessibilityLabel="Open journal" onPress={() => setOpenPanel('journal')} style={({ pressed }) => [styles.socialButton, { minHeight: metrics.pointerTarget }, pressed && styles.buttonPressed]}>
              <Text style={[styles.socialText, { fontSize: metrics.secondaryText }]}>JOURNAL</Text>
            </Pressable>
            <Pressable accessibilityLabel="Open relationships" onPress={() => setOpenPanel('relationships')} style={({ pressed }) => [styles.socialButton, { minHeight: metrics.pointerTarget }, pressed && styles.buttonPressed]}>
              <Text style={[styles.socialText, { fontSize: metrics.secondaryText }]}>SOCIAL</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Save game"
              disabled={transitioning || runtime.movement.status === 'moving' || runtime.worldState.clock.pauseTokens.length > 0}
              onPress={() => void requestAutosave(runtime.worldState, 'manual')}
              style={({ pressed }) => [
                styles.socialButton,
                { minHeight: metrics.pointerTarget },
                (transitioning || runtime.movement.status === 'moving' || runtime.worldState.clock.pauseTokens.length > 0) && styles.zoomButtonDisabled,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={[styles.socialText, { fontSize: metrics.secondaryText }]}>SAVE</Text>
            </Pressable>
          </View>
        ) : null}
        {inBedroom ? (
          <BedActions
            disabled={transitioning || runtime.worldState.clock.pauseTokens.length > 0}
            minuteOfDay={runtime.worldState.clock.absoluteMinute % 1_440}
            onSleep={sleep}
            uiScale={uiScale}
          />
        ) : null}
        {!conversationNpcId && !openPanel && runtime.movement.status !== 'moving' ? (
          <ContextActionMenu actions={questActions} onAction={runQuestAction} surface={surface} uiScale={uiScale} />
        ) : null}
        <View nativeID="world-ui-help" pointerEvents="none" style={styles.bottomPlate}>
          <Text style={[styles.statusStrong, { fontSize: metrics.persistentText }]}>{worldFeedback ?? (runtime.movement.status === 'unreachable' ? 'NO ROUTE' : runtime.movement.status.toUpperCase())}</Text>
          <Text style={[styles.status, { fontSize: metrics.secondaryText }]}>CLICK MOVE · DRAG PAN · WHEEL ZOOM · F CENTER · ESC STOP</Text>
        </View>
        {audioCaption ? (
          <Text accessibilityLiveRegion="polite" nativeID="world-audio-caption" style={styles.audioCaption}>{audioCaption}</Text>
        ) : null}
        {transitioning ? <View nativeID="world-transition-overlay" style={styles.transitionOverlay}><Text style={styles.transitionText}>CROSSING NEIGHBORHOOD…</Text></View> : null}
        {conversationNpcId ? (
          <ConversationPanel
            fixtureDisplayName={conversationFixtureId ? ATLAS_INDEX.characters[conversationFixtureId].displayName : undefined}
            fixtureMode={conversationFixtureId === conversationNpcId}
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
        {openPanel === 'journal' ? (
          <JournalPanel
            onDismiss={() => setOpenPanel(undefined)}
            onAdvancePolice={advancePoliceHook}
            onPurchaseSecurityReport={purchaseSecurityReport}
            state={runtime.worldState}
            surface={surface}
            uiScale={uiScale}
          />
        ) : null}
        {openPanel === 'relationships' ? (
          <RelationshipPanel
            npcId={runtime.worldState.relationships[selected] ? selected : 'linda'}
            onDismiss={() => setOpenPanel(undefined)}
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
  areaLabel: {
    backgroundColor: '#211d1ac7', color: '#fff0c7', fontFamily: 'Silkscreen', fontSize: 9,
    paddingHorizontal: 4, paddingVertical: 2, position: 'absolute', textAlign: 'center', width: 96,
  },
  areaLabels: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  audioCaption: { backgroundColor: '#181512dd', bottom: 48, color: '#fff0c7', fontFamily: 'Silkscreen', fontSize: 10, left: 12, paddingHorizontal: 8, paddingVertical: 5, position: 'absolute' },
  bottomPlate: {
    alignItems: 'center', backgroundColor: '#181914e8', borderColor: '#ad7640', borderTopWidth: 2,
    bottom: 0, flexDirection: 'row', gap: 16, left: 0, paddingHorizontal: 14, paddingVertical: 8,
    position: 'absolute', right: 0,
  },
  canvas: { backgroundColor: '#b77945' },
  buttonPressed: { opacity: 0.78, transform: [{ translateY: 1 }] },
  canvasHost: { overflow: 'hidden' },
  controlLabel: { color: '#dfa85e', fontFamily: 'Silkscreen', marginHorizontal: 3 },
  frame: { overflow: 'hidden', position: 'relative' },
  loading: { alignItems: 'center', justifyContent: 'center' },
  proofState: { height: 1, left: 0, opacity: 0, position: 'absolute', top: 0, width: 1 },
  status: { color: '#c3b18f', fontFamily: 'Silkscreen', fontSize: 9 },
  statusStrong: { color: '#f1c65b', fontFamily: 'Silkscreen', fontSize: 10 },
  socialButton: { alignItems: 'center', backgroundColor: '#10130f', borderColor: '#665139', borderWidth: 1, justifyContent: 'center', minHeight: 29, paddingHorizontal: 9 },
  socialNav: { backgroundColor: '#181914f2', borderBottomColor: '#ad7640', borderBottomWidth: 2, flexDirection: 'row', gap: 4, padding: 5, position: 'absolute', right: 12, top: 52 },
  socialText: { color: '#d6c19a', fontFamily: 'Silkscreen', fontSize: 8 },
  shelterShade: { position: 'absolute' },
  transitionOverlay: { alignItems: 'center', backgroundColor: '#171411dd', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0 },
  transitionText: { color: '#f1c65b', fontFamily: 'Silkscreen', fontSize: 16 },
  talkButton: { alignItems: 'center', backgroundColor: '#f1c65b', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  talkLabel: { color: '#d6c19a', fontFamily: 'Silkscreen', fontSize: 8 },
  talkPlate: { alignItems: 'center', backgroundColor: '#211d1aee', bottom: 42, flexDirection: 'row', gap: 10, padding: 6, position: 'absolute', right: 14 },
  talkText: { color: '#211d1a', fontFamily: 'Silkscreen', fontSize: 10 },
  uiScaleButton: { alignItems: 'center', borderColor: '#665139', borderWidth: 1, justifyContent: 'center' },
  uiScalePlate: { alignItems: 'center', backgroundColor: '#181914f2', flexDirection: 'row', gap: 4, padding: 5, position: 'absolute', right: 12 },
  viewport: { overflow: 'hidden' },
  zoomButton: { alignItems: 'center', borderColor: '#665139', borderWidth: 1, height: 29, justifyContent: 'center', width: 36 },
  zoomButtonDisabled: { opacity: 0.35 },
  zoomButtonActive: { backgroundColor: '#f1c65b', borderColor: '#fff0c7' },
  zoomPlate: { alignItems: 'center', backgroundColor: '#181914f2', borderTopColor: '#ad7640', borderTopWidth: 2, flexDirection: 'row', gap: 4, padding: 5, position: 'absolute', right: 12, top: 12 },
  zoomText: { color: '#d6c19a', fontFamily: 'Silkscreen', fontSize: 10 },
  zoomTextActive: { color: '#211d1a' },
  zoomValue: { alignItems: 'center', borderColor: '#665139', borderWidth: 1, justifyContent: 'center' },
});
