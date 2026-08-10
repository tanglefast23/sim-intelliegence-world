import {
  Atlas,
  Canvas,
  Circle,
  FilterMode,
  Line,
  MipmapMode,
  Rect,
  RoundedRect,
  Skia,
  rect,
  useImage,
  vec,
} from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getDesktopBridge } from '../application/DesktopBridge';
import { useReducedMotion } from '../application/accessibility';
import { createBrowserConversationPort } from '../ai/conversation/browser-port';
import { autosaveStableState } from '../application/runtime/autosave';
import { WORLD_MAP_CATALOG } from '../application/runtime/map-catalog';
import { setWorldSpeed, sleepWorld, tickWorld } from '../application/runtime/tick';
import { canStartPortalTransition, transitionNeighborhood } from '../application/runtime/transitions';
import { advanceWorldMovement } from '../application/runtime/world-runtime';
import { effectiveSpeed } from '../domain/clock/clock';
import { reduceCommand } from '../domain/commands/reducer';
import { DomainCommandSchema } from '../domain/commands/types';
import { lindaContextActions, type ContextQuestAction } from '../domain/quests/quest-machine';
import type { WorldState } from '../domain/state/schema';
import { VOCAL_CUE_CAPTIONS, type VocalCueId } from '../audio/vocal-cue-policy';
import { useVocalCues } from '../audio/vocal-cues';
import { BedActions } from '../ui/BedActions';
import { ConversationPanel } from '../ui/ConversationPanel';
import { ContextActionMenu } from '../ui/ContextActionMenu';
import { Hud } from '../ui/Hud';
import { JournalPanel } from '../ui/JournalPanel';
import { RelationshipPanel } from '../ui/RelationshipPanel';
import { WorldInput } from '../ui/WorldInput';
import { groundSpriteAtV2, type CompiledMapV2 } from '../world/maps/compiled-v2';
import { selectOwnerInteractionApproach } from '../world/maps/compiler';
import { resolveClickTarget, worldClickCandidates } from '../world/maps/hit-testing';
import { pointsInRect, tileKey, type TilePoint } from '../world/maps/schema';
import type { MapId } from '../world/maps/catalog';
import {
  cancelMovement,
  createMovementState,
  requestMovement,
  type MovementState,
} from '../world/pathfinding/movement';
import {
  activeNpcTile,
  advanceActiveNpcMovement,
  movementForNpc,
} from '../world/schedules/active-movement';
import {
  ATLAS_INDEX,
  CHARACTER_IDS,
  WALK_FRAME_MILLISECONDS,
  ZOOM_LEVELS,
  atlasRectangle,
  type CharacterId,
  type ZoomLevel,
} from './atlas';
import {
  centerCameraOnTile,
  panCamera,
  screenToTile,
  worldToScreen,
  zoomCameraAt,
  type CameraState,
} from './camera';
import { WORLD_DEPTH } from './depth';
import {
  buildWorldFrameState,
  compareWorldLayerTiles,
  type WorldActors,
  type WorldLayer,
} from './world-frame';

const atlasImage = require('../../assets/generated/world-atlas.png') as number;
const NEAREST = { filter: FilterMode.Nearest, mipmap: MipmapMode.None } as const;
const VIEWPORT = { width: 1120, height: 620 } as const;
const MAP_PIXELS = { width: 64 * 32, height: 48 * 32 } as const;
const TILE_SIZE = 32;
type SpritePlacement = Readonly<{ id: string; sprite: string; worldX: number; worldY: number }>;
type RuntimeViewState = Readonly<{
  movement: MovementState;
  npcMovements: Readonly<Record<string, MovementState>>;
  worldState: WorldState;
}>;

function isVisible(tile: TilePoint, camera: CameraState, margin = 1): boolean {
  const minimumX = Math.floor(camera.x / TILE_SIZE) - margin;
  const minimumY = Math.floor(camera.y / TILE_SIZE) - margin;
  const maximumX = Math.ceil((camera.x + VIEWPORT.width / camera.zoom) / TILE_SIZE) + margin;
  const maximumY = Math.ceil((camera.y + VIEWPORT.height / camera.zoom) / TILE_SIZE) + margin;
  return tile.x >= minimumX && tile.x <= maximumX && tile.y >= minimumY && tile.y <= maximumY;
}

function atlasData(placements: readonly SpritePlacement[], camera: CameraState) {
  return {
    sprites: placements.map(({ sprite }) => {
      const source = atlasRectangle(sprite);
      return rect(source.x, source.y, source.width, source.height);
    }),
    transforms: placements.map(({ worldX, worldY }) => {
      const screen = worldToScreen(camera, { x: worldX, y: worldY });
      return Skia.RSXform(camera.zoom, 0, screen.x, screen.y);
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

function visualIdForNpc(stateId: string, tier: 'full_ai' | 'ambient'): CharacterId {
  if (tier === 'ambient') return 'generic-resident';
  const candidate = stateId.replaceAll('_', '-') as CharacterId;
  return CHARACTER_IDS.includes(candidate) ? candidate : 'generic-resident';
}

function actorTiles(state: WorldState, mapId: string): WorldActors {
  const output: Record<string, WorldActors[string]> = {};
  for (const [stateId, npc] of Object.entries(state.npcs)) {
    const tile = activeNpcTile(state, stateId, mapId);
    if (tile) output[stateId] = { tile, visualId: visualIdForNpc(stateId, npc.tier) };
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
  initialFeedback: string;
  initialSaveGeneration: number | null;
  initialSaveStatus: string;
  initialState: WorldState;
}>;

export function WorldScene({
  initialFeedback, initialSaveGeneration, initialSaveStatus, initialState,
}: WorldSceneProps) {
  const image = useImage(atlasImage);
  const reducedMotion = useReducedMotion();
  const playVocalCue = useVocalCues();
  const initialTile = useMemo(() => ({
    x: initialState.protagonist.worldPosition.tileX,
    y: initialState.protagonist.worldPosition.tileY,
  }), [initialState]);
  const [runtime, setRuntime] = useState<RuntimeViewState>(() => ({
    movement: createMovementState(initialTile),
    npcMovements: npcMovementState(initialState),
    worldState: initialState,
  }));
  const [camera, setCamera] = useState<CameraState>(() => centerCameraOnTile(initialTile, 2, VIEWPORT, MAP_PIXELS));
  const [frame, setFrame] = useState<0 | 1>(0);
  const [selected, setSelected] = useState<string>('protagonist');
  const [saveStatus, setSaveStatus] = useState(initialSaveStatus);
  const [transitioning, setTransitioning] = useState(false);
  const [arrivalLock, setArrivalLock] = useState<string>();
  const [worldFeedback, setWorldFeedback] = useState<string | undefined>(initialFeedback);
  const [conversationNpcId, setConversationNpcId] = useState<string>();
  const [openPanel, setOpenPanel] = useState<'journal' | 'relationships'>();
  const [audioCaption, setAudioCaption] = useState<string>();
  const conversationPort = useMemo(() => getDesktopBridge() ?? createBrowserConversationPort(), []);
  const saveGeneration = useRef<number | null>(initialSaveGeneration);
  const handledSleepEventId = useRef<string | undefined>(undefined);
  const captionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mapId = runtime.worldState.protagonist.worldPosition.mapId as MapId;
  const map = WORLD_MAP_CATALOG[mapId];
  const npcTiles = useMemo(() => actorTiles(runtime.worldState, mapId), [mapId, runtime.worldState]);
  const speed = effectiveSpeed(runtime.worldState.clock);
  const questActions = lindaContextActions(runtime.worldState, stateNpcId(selected, runtime.worldState));

  const triggerVocalCue = useCallback((cue: VocalCueId) => {
    playVocalCue(cue);
    setAudioCaption(VOCAL_CUE_CAPTIONS[cue]);
    if (captionTimer.current) clearTimeout(captionTimer.current);
    captionTimer.current = setTimeout(() => setAudioCaption(undefined), 1_500);
  }, [playVocalCue]);

  useEffect(() => () => {
    if (captionTimer.current) clearTimeout(captionTimer.current);
  }, []);

  const requestAutosave = useCallback(async (
    state: WorldState,
    trigger: 'sleep' | 'travel' | 'major_quest' | 'manual',
  ) => {
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
  }, []);

  useEffect(() => {
    if (reducedMotion || runtime.movement.status !== 'moving' || speed === 0) {
      setFrame(0);
      return;
    }
    const timer = setInterval(() => setFrame((current) => current === 0 ? 1 : 0), WALK_FRAME_MILLISECONDS);
    return () => clearInterval(timer);
  }, [reducedMotion, runtime.movement.status, speed]);

  useEffect(() => {
    const timer = setInterval(() => {
      setRuntime((current) => effectiveSpeed(current.worldState.clock) === 0
        ? current
        : { ...current, worldState: tickWorld(current.worldState, 1_000) });
    }, 1_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (runtime.movement.status !== 'moving' || speed === 0 || transitioning) return;
    const timer = setTimeout(() => {
      setRuntime((current) => {
        const result = advanceWorldMovement(
          WORLD_MAP_CATALOG[current.worldState.protagonist.worldPosition.mapId as MapId],
          current.movement,
          current.worldState,
          npcBlockers(current.worldState, current.worldState.protagonist.worldPosition.mapId),
        );
        return { ...current, movement: result.movement, worldState: result.worldState };
      });
    }, Math.round(WALK_FRAME_MILLISECONDS / speed));
    return () => clearTimeout(timer);
  }, [runtime.movement, speed, transitioning]);

  useEffect(() => {
    if (speed === 0 || transitioning) return;
    const timer = setInterval(() => {
      setRuntime((current) => {
        const currentMapId = current.worldState.protagonist.worldPosition.mapId as MapId;
        const currentMap = WORLD_MAP_CATALOG[currentMapId];
        let state = current.worldState;
        const movements = { ...current.npcMovements };
        for (const stateId of Object.keys(state.npcs).sort()) {
          const base = movements[stateId] ?? movementForNpc(state, stateId);
          if (!base) {
            delete movements[stateId];
            continue;
          }
          const blockers = npcBlockers(state, currentMapId, stateId);
          blockers.add(tileKey(current.movement.player));
          const result = advanceActiveNpcMovement(currentMap, base, state, stateId, blockers);
          movements[stateId] = result.movement;
          state = result.worldState;
        }
        return { ...current, npcMovements: movements, worldState: state };
      });
    }, Math.round(WALK_FRAME_MILLISECONDS / speed));
    return () => clearInterval(timer);
  }, [speed, transitioning]);

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
      setCamera((current) => centerCameraOnTile(tile, current.zoom, VIEWPORT, MAP_PIXELS));
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
      setSelected(resolved.id);
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
  }, [camera, conversationNpcId, map, npcTiles, openPanel, requestTile, runtime.movement.player, runtime.worldState]);

  const handlePan = useCallback((delta: Readonly<{ x: number; y: number }>) => {
    if (conversationNpcId || openPanel) return;
    setCamera((current) => panCamera(current, delta, VIEWPORT, MAP_PIXELS));
  }, [conversationNpcId, openPanel]);
  const handleZoom = useCallback((direction: -1 | 1, anchor: Readonly<{ x: number; y: number }>) => {
    if (conversationNpcId || openPanel) return;
    setCamera((current) => {
      const index = ZOOM_LEVELS.indexOf(current.zoom);
      const nextIndex = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, index + direction));
      return zoomCameraAt(current, ZOOM_LEVELS[nextIndex] as ZoomLevel, anchor, VIEWPORT, MAP_PIXELS);
    });
  }, [conversationNpcId, openPanel]);
  const center = useCallback(() => {
    if (conversationNpcId || openPanel) return;
    setCamera((current) => centerCameraOnTile(runtime.movement.player, current.zoom, VIEWPORT, MAP_PIXELS));
  }, [conversationNpcId, openPanel, runtime.movement.player]);
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
    setWorldFeedback(event.mode === 'nap' ? 'NAP COMPLETE · +25 ENERGY' : 'RESTED UNTIL 08:00 · +80 ENERGY');
    if (event.mode === 'overnight') void requestAutosave(runtime.worldState, 'sleep');
  }, [requestAutosave, runtime.worldState]);

  const visibleFloors = useMemo(() => {
    const placements: SpritePlacement[] = [];
    for (let y = 0; y < map.source.height; y += 1) {
      for (let x = 0; x < map.source.width; x += 1) {
        const tile = { x, y };
        if (isVisible(tile, camera)) {
          placements.push({ id: `floor-${x}-${y}`, sprite: groundSpriteAtV2(map, tile), worldX: x * TILE_SIZE, worldY: y * TILE_SIZE });
        }
      }
    }
    return placements;
  }, [camera, map]);
  const visibleProps = [
    ...[...map.objectPartById.values()].filter(({ tile }) => isVisible(tile, camera)).map((part) => ({
      id: part.id,
      sprite: part.sprite,
      tile: part.depthAnchor,
      worldX: part.tile.x * TILE_SIZE,
      worldY: part.tile.y * TILE_SIZE,
    })),
    ...[...map.doorById.values()].filter(({ tile }) => isVisible(tile, camera)).map((door) => ({
      id: door.id,
      sprite: door.sprite,
      tile: door.tile,
      worldX: door.tile.x * TILE_SIZE,
      worldY: door.tile.y * TILE_SIZE,
    })),
  ].sort((left, right) => compareWorldLayerTiles(WORLD_DEPTH.prop, left, right));
  const visibleWalls = map.wallTiles.filter(({ tile }) => isVisible(tile, camera))
    .sort((left, right) => compareWorldLayerTiles(WORLD_DEPTH.wall, left, right))
    .map((wall) => ({ id: wall.id, sprite: wall.sprite, worldX: wall.tile.x * TILE_SIZE, worldY: wall.tile.y * TILE_SIZE }));
  const worldFrame = buildWorldFrameState(map, runtime.worldState, npcTiles, runtime.movement.direction, frame);
  const characters = worldFrame.characters.filter(({ tile }) => isVisible(tile, camera));
  const floorAtlas = atlasData(visibleFloors, camera);
  const propAtlas = atlasData(visibleProps, camera);
  const characterAtlas = atlasData(characters, camera);
  const wallAtlas = atlasData(visibleWalls, camera);
  const visibleRoofTiles = map.source.roofGroups
    .filter(({ id }) => worldFrame.visibleRoofGroupIds.includes(id))
    .flatMap((roof) => roof.cells.flatMap(pointsInRect).map((tile) => ({
      id: `${roof.id}-${tileKey(tile)}`,
      sprite: 'tile.boardwalk',
      worldX: tile.x * TILE_SIZE,
      worldY: tile.y * TILE_SIZE,
    })))
    .filter(({ worldX, worldY }) => isVisible({ x: worldX / TILE_SIZE, y: worldY / TILE_SIZE }, camera));
  const roofAtlas = atlasData(visibleRoofTiles, camera);
  const selectedCharacter = selected === 'protagonist'
    ? runtime.movement.player
    : npcTiles[selected]?.tile ?? runtime.movement.player;
  const selectedScreen = worldToScreen(camera, {
    x: selectedCharacter.x * TILE_SIZE + 16,
    y: selectedCharacter.y * TILE_SIZE + 27,
  });
  const feedbackScreen = runtime.movement.feedbackTile
    ? worldToScreen(camera, {
      x: runtime.movement.feedbackTile.x * TILE_SIZE + 16,
      y: runtime.movement.feedbackTile.y * TILE_SIZE + 16,
    })
    : undefined;
  const currentAreaName = areaName(map, runtime.movement.player);
  const inBedroom = mapId === 'northwest_residential' && currentAreaName === 'BEDROOM';

  if (!image) {
    return <View style={styles.loading}><Text style={styles.status}>DECODING WORLD STATE…</Text></View>;
  }

  const renderLayer = (layer: WorldLayer) => {
    switch (layer) {
      case 'floor':
        return <Atlas image={image} key={layer} sampling={NEAREST} sprites={floorAtlas.sprites} transforms={floorAtlas.transforms} />;
      case 'prop':
        return <Atlas image={image} key={layer} sampling={NEAREST} sprites={propAtlas.sprites} transforms={propAtlas.transforms} />;
      case 'shadow':
        return characters.map((character) => {
          const screen = worldToScreen(camera, { x: character.worldX + 5, y: character.worldY + 27 });
          return <RoundedRect color="#20191566" height={3 * camera.zoom} key={`shadow-${character.id}`} r={camera.zoom} width={14 * camera.zoom} x={screen.x} y={screen.y} />;
        });
      case 'character':
        return <Atlas image={image} key={layer} sampling={NEAREST} sprites={characterAtlas.sprites} transforms={characterAtlas.transforms} />;
      case 'effect':
        return map.source.effects.filter(({ tile }) => isVisible(tile, camera)).map((effect) => {
          const screen = worldToScreen(camera, { x: effect.tile.x * 32 + 16, y: effect.tile.y * 32 + 16 });
          return <Circle color={effect.kind === 'fire' ? '#f07832' : '#f5dd9d'} cx={screen.x} cy={screen.y} key={effect.id} r={3 * camera.zoom} />;
        });
      case 'wall':
        return <Atlas image={image} key={layer} sampling={NEAREST} sprites={wallAtlas.sprites} transforms={wallAtlas.transforms} />;
      case 'roof':
        return (
          <>
            <Atlas image={image} key="roof-atlas" sampling={NEAREST} sprites={roofAtlas.sprites} transforms={roofAtlas.transforms} />
            {map.source.roofGroups.filter(({ id }) => worldFrame.visibleRoofGroupIds.includes(id)).flatMap((roof) => (
              roof.cells.map((cell, index) => {
                const screen = worldToScreen(camera, { x: cell.x * 32, y: cell.y * 32 });
                return <Rect color="#4b211f55" height={cell.height * 32 * camera.zoom} key={`${roof.id}-${index}`} width={cell.width * 32 * camera.zoom} x={screen.x} y={screen.y} />;
              })
            ))}
          </>
        );
    }
  };

  return (
    <WorldInput onCancel={cancel} onCenter={center} onPan={handlePan} onPrimary={handlePrimary} onZoom={handleZoom}>
      <View
        accessibilityLabel={`${map.source.displayName}; tile ${runtime.movement.player.x},${runtime.movement.player.y}; minute ${runtime.worldState.clock.absoluteMinute}; speed ${runtime.worldState.clock.selectedSpeed}`}
        nativeID="world-state"
        style={styles.frame}
      >
        <View nativeID="world-input-viewport" style={styles.viewport}>
          <Canvas style={styles.canvas}>
            {worldFrame.layerOrder.slice(0, 3).map(renderLayer)}
            <Circle color="#f1c65b" cx={selectedScreen.x} cy={selectedScreen.y} r={10 * camera.zoom} style="stroke" strokeWidth={camera.zoom} />
            {worldFrame.layerOrder.slice(3, 6).map(renderLayer)}
            {runtime.movement.path.map((tile, index) => {
              const screen = worldToScreen(camera, { x: tile.x * 32 + 16, y: tile.y * 32 + 16 });
              return <Circle color="#f5dd9d88" cx={screen.x} cy={screen.y} key={`path-${index}`} r={Math.max(1, camera.zoom)} />;
            })}
            {worldFrame.layerOrder.slice(6).map(renderLayer)}
            {feedbackScreen ? (
              <>
                <Line color="#ef5b43" p1={vec(feedbackScreen.x - 7, feedbackScreen.y - 7)} p2={vec(feedbackScreen.x + 7, feedbackScreen.y + 7)} strokeWidth={3} />
                <Line color="#ef5b43" p1={vec(feedbackScreen.x + 7, feedbackScreen.y - 7)} p2={vec(feedbackScreen.x - 7, feedbackScreen.y + 7)} strokeWidth={3} />
              </>
            ) : null}
          </Canvas>
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
          accessibilityLabel={worldFrame.hiddenRoofGroupId ? 'Villa roof hidden' : 'Villa roof restored'}
          nativeID="world-roof-state"
          pointerEvents="none"
          style={styles.proofState}
        />
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
          zoom={camera.zoom}
        />
        <View nativeID="world-ui-zoom" style={styles.zoomPlate}>
          {ZOOM_LEVELS.map((zoom) => (
            <Pressable
              accessibilityLabel={`Set ${zoom}x zoom`}
              key={zoom}
              onPress={() => setCamera((current) => zoomCameraAt(current, zoom, { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 }, VIEWPORT, MAP_PIXELS))}
              style={[styles.zoomButton, camera.zoom === zoom && styles.zoomButtonActive]}
            >
              <Text style={[styles.zoomText, camera.zoom === zoom && styles.zoomTextActive]}>{zoom}×</Text>
            </Pressable>
          ))}
        </View>
        {!conversationNpcId && !openPanel ? (
          <View nativeID="world-ui-social-nav" style={styles.socialNav}>
            <Pressable accessibilityLabel="Open journal" onPress={() => setOpenPanel('journal')} style={styles.socialButton}>
              <Text style={styles.socialText}>JOURNAL</Text>
            </Pressable>
            <Pressable accessibilityLabel="Open relationships" onPress={() => setOpenPanel('relationships')} style={styles.socialButton}>
              <Text style={styles.socialText}>SOCIAL</Text>
            </Pressable>
          </View>
        ) : null}
        {inBedroom ? (
          <BedActions
            disabled={transitioning || runtime.worldState.clock.pauseTokens.length > 0}
            minuteOfDay={runtime.worldState.clock.absoluteMinute % 1_440}
            onSleep={sleep}
          />
        ) : null}
        {stateNpcId(selected, runtime.worldState) && !conversationNpcId && !openPanel ? (
          <View nativeID="world-ui-talk" style={styles.talkPlate}>
            <Text style={styles.talkLabel}>{npcLabel(selected, npcTiles).toUpperCase()} SELECTED</Text>
            <Pressable
              accessibilityLabel={`Talk to ${npcLabel(selected, npcTiles)}`}
              onPress={() => setConversationNpcId(stateNpcId(selected, runtime.worldState))}
              style={styles.talkButton}
            >
              <Text style={styles.talkText}>TALK</Text>
            </Pressable>
          </View>
        ) : null}
        {!conversationNpcId && !openPanel && runtime.movement.status !== 'moving' ? (
          <ContextActionMenu actions={questActions} onAction={runQuestAction} />
        ) : null}
        <View nativeID="world-ui-help" pointerEvents="none" style={styles.bottomPlate}>
          <Text style={styles.statusStrong}>{worldFeedback ?? (runtime.movement.status === 'unreachable' ? 'NO ROUTE' : runtime.movement.status.toUpperCase())}</Text>
          <Text style={styles.status}>LEFT CLICK MOVE / MIDDLE DRAG PAN / WHEEL ZOOM / F CENTER / ESC STOP</Text>
        </View>
        {audioCaption ? (
          <Text accessibilityLiveRegion="polite" nativeID="world-audio-caption" style={styles.audioCaption}>{audioCaption}</Text>
        ) : null}
        {transitioning ? <View nativeID="world-transition-overlay" style={styles.transitionOverlay}><Text style={styles.transitionText}>CROSSING NEIGHBORHOOD…</Text></View> : null}
        {conversationNpcId ? (
          <ConversationPanel
            npcId={conversationNpcId}
            onDismiss={() => setConversationNpcId(undefined)}
            onPausedState={applyConversationPause}
            onStableState={applyConversationStableState}
            onVocalCue={triggerVocalCue}
            port={conversationPort}
            state={runtime.worldState}
          />
        ) : null}
        {openPanel === 'journal' ? (
          <JournalPanel
            onDismiss={() => setOpenPanel(undefined)}
            onAdvancePolice={advancePoliceHook}
            onPurchaseSecurityReport={purchaseSecurityReport}
            state={runtime.worldState}
          />
        ) : null}
        {openPanel === 'relationships' ? (
          <RelationshipPanel
            npcId={runtime.worldState.relationships[selected] ? selected : 'linda'}
            onDismiss={() => setOpenPanel(undefined)}
            state={runtime.worldState}
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
    alignItems: 'center', backgroundColor: '#211d1adf', borderColor: '#ad7640', borderTopWidth: 2,
    bottom: 0, flexDirection: 'row', gap: 16, left: 0, paddingHorizontal: 14, paddingVertical: 8,
    position: 'absolute', right: 0,
  },
  canvas: { backgroundColor: '#b77945', height: VIEWPORT.height, width: VIEWPORT.width },
  frame: { borderColor: '#0f1412', borderWidth: 3, height: VIEWPORT.height + 6, overflow: 'hidden', position: 'relative', width: VIEWPORT.width + 6 },
  loading: { alignItems: 'center', height: VIEWPORT.height, justifyContent: 'center', width: VIEWPORT.width },
  proofState: { height: 1, left: 0, opacity: 0, position: 'absolute', top: 0, width: 1 },
  status: { color: '#c3b18f', fontFamily: 'Silkscreen', fontSize: 9 },
  statusStrong: { color: '#f1c65b', fontFamily: 'Silkscreen', fontSize: 10 },
  socialButton: { alignItems: 'center', borderColor: '#665139', borderWidth: 1, justifyContent: 'center', minHeight: 29, paddingHorizontal: 9 },
  socialNav: { backgroundColor: '#211d1aee', flexDirection: 'row', gap: 4, padding: 5, position: 'absolute', right: 12, top: 52 },
  socialText: { color: '#d6c19a', fontFamily: 'Silkscreen', fontSize: 8 },
  transitionOverlay: { alignItems: 'center', backgroundColor: '#171411dd', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0 },
  transitionText: { color: '#f1c65b', fontFamily: 'Silkscreen', fontSize: 16 },
  talkButton: { alignItems: 'center', backgroundColor: '#f1c65b', justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 8 },
  talkLabel: { color: '#d6c19a', fontFamily: 'Silkscreen', fontSize: 8 },
  talkPlate: { alignItems: 'center', backgroundColor: '#211d1aee', bottom: 42, flexDirection: 'row', gap: 10, padding: 6, position: 'absolute', right: 14 },
  talkText: { color: '#211d1a', fontFamily: 'Silkscreen', fontSize: 10 },
  viewport: { height: VIEWPORT.height, width: VIEWPORT.width },
  zoomButton: { alignItems: 'center', borderColor: '#665139', borderWidth: 1, height: 29, justifyContent: 'center', width: 36 },
  zoomButtonActive: { backgroundColor: '#f1c65b', borderColor: '#fff0c7' },
  zoomPlate: { backgroundColor: '#211d1aee', flexDirection: 'row', gap: 4, padding: 5, position: 'absolute', right: 12, top: 12 },
  zoomText: { color: '#d6c19a', fontFamily: 'Silkscreen', fontSize: 10 },
  zoomTextActive: { color: '#211d1a' },
});
