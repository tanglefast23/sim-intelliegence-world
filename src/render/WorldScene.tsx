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
import { autosaveStableState } from '../application/runtime/autosave';
import { WORLD_MAP_CATALOG } from '../application/runtime/map-catalog';
import { setWorldSpeed, sleepWorld, tickWorld } from '../application/runtime/tick';
import { transitionNeighborhood } from '../application/runtime/transitions';
import { advanceWorldMovement } from '../application/runtime/world-runtime';
import { effectiveSpeed } from '../domain/clock/clock';
import { createInitialState } from '../domain/state/initial-state';
import type { WorldState } from '../domain/state/schema';
import { BedActions } from '../ui/BedActions';
import { Hud } from '../ui/Hud';
import { WorldInput } from '../ui/WorldInput';
import { resolveClickTarget, type ClickCandidate } from '../world/maps/hit-testing';
import { groundSpriteAt, pointsInRect, tileKey, type CompiledMap, type TilePoint } from '../world/maps/schema';
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
  WALK_FRAME_MILLISECONDS,
  ZOOM_LEVELS,
  atlasRectangle,
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
  type WorldActorTiles,
  type WorldLayer,
} from './world-frame';

const atlasImage = require('../../assets/generated/world-atlas.png') as number;
const NEAREST = { filter: FilterMode.Nearest, mipmap: MipmapMode.None } as const;
const VIEWPORT = { width: 1120, height: 620 } as const;
const MAP_PIXELS = { width: 64 * 32, height: 48 * 32 } as const;
const TILE_SIZE = 32;
const NPC_VISUAL_IDS = [
  { stateId: 'generic_resident', visualId: 'generic-resident' },
  { stateId: 'linda', visualId: 'linda' },
] as const;

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

function areaName(map: CompiledMap, tile: TilePoint): string {
  const area = map.source.areas.find(({ bounds }) => (
    tile.x >= bounds.x && tile.x < bounds.x + bounds.width &&
    tile.y >= bounds.y && tile.y < bounds.y + bounds.height
  ));
  return (area?.id ?? map.source.displayName).replaceAll('-', ' ').toUpperCase();
}

function actorTiles(state: WorldState, mapId: string): WorldActorTiles {
  const output: Partial<Record<'linda' | 'generic-resident', TilePoint>> = {};
  const linda = activeNpcTile(state, 'linda', mapId);
  const resident = activeNpcTile(state, 'generic_resident', mapId);
  if (linda) output.linda = linda;
  if (resident) output['generic-resident'] = resident;
  return output;
}

function npcMovementState(state: WorldState): Readonly<Record<string, MovementState>> {
  const movements: Record<string, MovementState> = {};
  for (const { stateId } of NPC_VISUAL_IDS) {
    const movement = movementForNpc(state, stateId);
    if (movement) movements[stateId] = movement;
  }
  return movements;
}

function npcBlockers(state: WorldState, mapId: string, excludedNpcId?: string): Set<string> {
  const blockers = new Set<string>();
  for (const { stateId } of NPC_VISUAL_IDS) {
    if (stateId === excludedNpcId) continue;
    const presence = state.npcs[stateId]?.presence;
    if (presence && presence.kind !== 'in_transit' && presence.mapId === mapId) {
      blockers.add(tileKey({ x: presence.tileX, y: presence.tileY }));
    }
  }
  return blockers;
}

type WorldSceneProps = Readonly<{ onReady: () => void }>;

export function WorldScene({ onReady }: WorldSceneProps) {
  const image = useImage(atlasImage);
  const initialState = useMemo(() => createInitialState(), []);
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
  const [saveStatus, setSaveStatus] = useState('SAVE READY');
  const [persistenceReady, setPersistenceReady] = useState(() => !getDesktopBridge());
  const [transitioning, setTransitioning] = useState(false);
  const [arrivalLock, setArrivalLock] = useState<string>();
  const [worldFeedback, setWorldFeedback] = useState<string>();
  const saveGeneration = useRef<number | null>(null);
  const handledSleepEventId = useRef<string | undefined>(undefined);
  const mapId = runtime.worldState.protagonist.worldPosition.mapId as MapId;
  const map = WORLD_MAP_CATALOG[mapId];
  const npcTiles = useMemo(() => actorTiles(runtime.worldState, mapId), [mapId, runtime.worldState]);
  const dynamicBlockers = useMemo(() => new Set(Object.values(npcTiles).filter(Boolean).map((tile) => tileKey(tile!))), [npcTiles]);
  const speed = effectiveSpeed(runtime.worldState.clock);

  const applyLoadedState = useCallback((state: WorldState) => {
    const tile = { x: state.protagonist.worldPosition.tileX, y: state.protagonist.worldPosition.tileY };
    setRuntime({ movement: createMovementState(tile), npcMovements: npcMovementState(state), worldState: state });
    setCamera((current) => centerCameraOnTile(tile, current.zoom, VIEWPORT, MAP_PIXELS));
  }, []);

  useEffect(() => {
    const bridge = getDesktopBridge();
    if (!bridge) return;
    let active = true;
    void bridge.loadSave('slot-001').then((result) => {
      if (!active) return;
      if (result.status === 'loaded') {
        saveGeneration.current = result.saveGeneration;
        applyLoadedState(result.state);
        setSaveStatus(`LOADED GEN ${result.saveGeneration}`);
      } else if (result.status === 'unrecoverable') {
        setSaveStatus('SAVE RECOVERY FAILED');
      }
      setPersistenceReady(true);
    }).catch(() => {
      if (active) {
        setSaveStatus('SAVE LOAD FAILED');
        setPersistenceReady(true);
      }
    });
    return () => { active = false; };
  }, [applyLoadedState]);

  const requestAutosave = useCallback(async (state: WorldState, trigger: 'sleep' | 'travel') => {
    const bridge = getDesktopBridge();
    if (!bridge) {
      setSaveStatus('BROWSER · NO DISK SAVE');
      return;
    }
    setSaveStatus('SAVING…');
    try {
      const result = await autosaveStableState({
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
    if (runtime.movement.status !== 'moving' || speed === 0) {
      setFrame(0);
      return;
    }
    const timer = setInterval(() => setFrame((current) => current === 0 ? 1 : 0), WALK_FRAME_MILLISECONDS);
    return () => clearInterval(timer);
  }, [runtime.movement.status, speed]);

  useEffect(() => {
    if (!image || !persistenceReady) return;
    let active = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (active) onReady();
    }));
    return () => { active = false; };
  }, [image, onReady, persistenceReady]);

  useEffect(() => {
    if (!persistenceReady) return;
    const timer = setInterval(() => {
      setRuntime((current) => effectiveSpeed(current.worldState.clock) === 0
        ? current
        : { ...current, worldState: tickWorld(current.worldState, 1_000) });
    }, 1_000);
    return () => clearInterval(timer);
  }, [persistenceReady]);

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
        for (const { stateId } of NPC_VISUAL_IDS) {
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
    if (arrivalLock === key || transitioning || runtime.movement.status === 'moving') return;
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
  }, [arrivalLock, map, requestAutosave, runtime.movement.status, runtime.worldState, transitioning]);

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
    const tile = screenToTile(camera, point);
    if (tile.x < 0 || tile.y < 0 || tile.x >= map.source.width || tile.y >= map.source.height) return;
    const candidates: ClickCandidate[] = [{ id: `floor-${tileKey(tile)}`, kind: 'floor', tile }];
    for (const [id, npcTile] of Object.entries(npcTiles)) {
      if (npcTile && tileKey(npcTile) === tileKey(tile)) candidates.push({ id, kind: 'npc', tile: npcTile });
    }
    for (const prop of map.source.props) {
      if (tileKey(prop.tile) === tileKey(tile)) candidates.push({ id: prop.id, kind: 'object', tile: prop.tile });
    }
    for (const interaction of map.source.interactions) {
      if (tileKey(interaction.hitTile) === tileKey(tile)) {
        candidates.push({ id: interaction.id, kind: 'interaction', tile: interaction.targetTile });
      }
    }
    const resolved = resolveClickTarget(candidates);
    if (!resolved) return;
    if (resolved.kind === 'npc') {
      setSelected(resolved.id);
      setRuntime((current) => ({ ...current, movement: cancelMovement(current.movement) }));
      return;
    }
    if (resolved.kind === 'object') {
      const interaction = map.source.interactions.find(({ hitTile }) => tileKey(hitTile) === tileKey(tile));
      requestTile(interaction?.targetTile ?? tile);
      return;
    }
    if (resolved.tile) requestTile(resolved.tile);
  }, [camera, map, npcTiles, requestTile]);

  const handlePan = useCallback((delta: Readonly<{ x: number; y: number }>) => {
    setCamera((current) => panCamera(current, delta, VIEWPORT, MAP_PIXELS));
  }, []);
  const handleZoom = useCallback((direction: -1 | 1, anchor: Readonly<{ x: number; y: number }>) => {
    setCamera((current) => {
      const index = ZOOM_LEVELS.indexOf(current.zoom);
      const nextIndex = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, index + direction));
      return zoomCameraAt(current, ZOOM_LEVELS[nextIndex] as ZoomLevel, anchor, VIEWPORT, MAP_PIXELS);
    });
  }, []);
  const center = useCallback(() => {
    setCamera((current) => centerCameraOnTile(runtime.movement.player, current.zoom, VIEWPORT, MAP_PIXELS));
  }, [runtime.movement.player]);
  const cancel = useCallback(() => {
    setRuntime((current) => ({ ...current, movement: cancelMovement(current.movement) }));
  }, []);
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
          placements.push({ id: `floor-${x}-${y}`, sprite: groundSpriteAt(map, tile), worldX: x * TILE_SIZE, worldY: y * TILE_SIZE });
        }
      }
    }
    return placements;
  }, [camera, map]);
  const visibleProps = map.source.props.filter(({ tile }) => isVisible(tile, camera))
    .sort((left, right) => compareWorldLayerTiles(WORLD_DEPTH.prop, left, right))
    .map((prop) => ({ id: prop.id, sprite: prop.sprite, worldX: prop.tile.x * TILE_SIZE, worldY: prop.tile.y * TILE_SIZE }));
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
    .flatMap((roof) => pointsInRect(roof.bounds).map((tile) => ({
      id: `${roof.id}-${tileKey(tile)}`,
      sprite: 'tile.boardwalk',
      worldX: tile.x * TILE_SIZE,
      worldY: tile.y * TILE_SIZE,
    })))
    .filter(({ worldX, worldY }) => isVisible({ x: worldX / TILE_SIZE, y: worldY / TILE_SIZE }, camera));
  const roofAtlas = atlasData(visibleRoofTiles, camera);
  const selectedCharacter = selected === 'protagonist'
    ? runtime.movement.player
    : npcTiles[selected as keyof WorldActorTiles] ?? runtime.movement.player;
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

  if (!image || !persistenceReady) {
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
            {map.source.roofGroups.filter(({ id }) => worldFrame.visibleRoofGroupIds.includes(id)).map((roof) => {
              const screen = worldToScreen(camera, { x: roof.bounds.x * 32, y: roof.bounds.y * 32 });
              return <Rect color="#4b211f55" height={roof.bounds.height * 32 * camera.zoom} key={roof.id} width={roof.bounds.width * 32 * camera.zoom} x={screen.x} y={screen.y} />;
            })}
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
        {inBedroom ? (
          <BedActions
            disabled={transitioning || runtime.worldState.clock.pauseTokens.length > 0}
            minuteOfDay={runtime.worldState.clock.absoluteMinute % 1_440}
            onSleep={sleep}
          />
        ) : null}
        <View nativeID="world-ui-help" pointerEvents="none" style={styles.bottomPlate}>
          <Text style={styles.statusStrong}>{worldFeedback ?? (runtime.movement.status === 'unreachable' ? 'NO ROUTE' : runtime.movement.status.toUpperCase())}</Text>
          <Text style={styles.status}>LEFT CLICK MOVE / MIDDLE DRAG PAN / WHEEL ZOOM / F CENTER / ESC STOP</Text>
        </View>
        {transitioning ? <View nativeID="world-transition-overlay" style={styles.transitionOverlay}><Text style={styles.transitionText}>CROSSING NEIGHBORHOOD…</Text></View> : null}
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
  transitionOverlay: { alignItems: 'center', backgroundColor: '#171411dd', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0 },
  transitionText: { color: '#f1c65b', fontFamily: 'Silkscreen', fontSize: 16 },
  viewport: { height: VIEWPORT.height, width: VIEWPORT.width },
  zoomButton: { alignItems: 'center', borderColor: '#665139', borderWidth: 1, height: 29, justifyContent: 'center', width: 36 },
  zoomButtonActive: { backgroundColor: '#f1c65b', borderColor: '#fff0c7' },
  zoomPlate: { backgroundColor: '#211d1aee', flexDirection: 'row', gap: 4, padding: 5, position: 'absolute', right: 12, top: 12 },
  zoomText: { color: '#d6c19a', fontFamily: 'Silkscreen', fontSize: 10 },
  zoomTextActive: { color: '#211d1a' },
});
