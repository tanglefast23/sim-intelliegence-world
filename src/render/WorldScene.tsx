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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import northwestMapJson from '../../content/maps/northwest.json';
import { advanceWorldMovement } from '../application/runtime/world-runtime';
import { createInitialState } from '../domain/state/initial-state';
import type { WorldState } from '../domain/state/schema';
import { WorldInput } from '../ui/WorldInput';
import { compileWorldMap, groundSpriteAt, pointsInRect, tileKey, type TilePoint } from '../world/maps/schema';
import { resolveClickTarget, type ClickCandidate } from '../world/maps/hit-testing';
import {
  cancelMovement,
  createMovementState,
  requestMovement,
  type MovementState,
} from '../world/pathfinding/movement';
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
import { buildWorldFrameState, compareWorldLayerTiles, type WorldLayer } from './world-frame';

const atlasImage = require('../../assets/generated/world-atlas.png') as number;
const NEAREST = { filter: FilterMode.Nearest, mipmap: MipmapMode.None } as const;
const VIEWPORT = { width: 1120, height: 620 } as const;
const MAP_PIXELS = { width: 64 * 32, height: 48 * 32 } as const;
const TILE_SIZE = 32;

const MAP = compileWorldMap(northwestMapJson, new Set(ATLAS_INDEX.tiles));

type SpritePlacement = Readonly<{ id: string; sprite: string; worldX: number; worldY: number }>;
type RuntimeViewState = Readonly<{ movement: MovementState; worldState: WorldState }>;

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

function areaName(tile: TilePoint): string {
  const area = MAP.source.areas.find(({ bounds }) => (
    tile.x >= bounds.x && tile.x < bounds.x + bounds.width &&
    tile.y >= bounds.y && tile.y < bounds.y + bounds.height
  ));
  return area ? area.id.toUpperCase() : 'SUNWARD VILLAS';
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
    worldState: initialState,
  }));
  const [camera, setCamera] = useState<CameraState>(() =>
    centerCameraOnTile(initialTile, 2, VIEWPORT, MAP_PIXELS));
  const [frame, setFrame] = useState<0 | 1>(0);
  const [selected, setSelected] = useState<string>('protagonist');

  const npcTiles = useMemo(() => ({
    linda: MAP.source.spawns.linda,
    'generic-resident': MAP.source.spawns.genericResident,
  }), []);
  const dynamicBlockers = useMemo(() => new Set(Object.values(npcTiles).map(tileKey)), [npcTiles]);

  useEffect(() => {
    if (runtime.movement.status !== 'moving') {
      setFrame(0);
      return;
    }
    const timer = setInterval(() => setFrame((current) => current === 0 ? 1 : 0), WALK_FRAME_MILLISECONDS);
    return () => clearInterval(timer);
  }, [runtime.movement.status]);
  useEffect(() => {
    if (!image) return;
    let active = true;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (active) onReady();
    }));
    return () => { active = false; };
  }, [image, onReady]);
  useEffect(() => {
    if (runtime.movement.status !== 'moving') return;
    const timer = setTimeout(() => {
      setRuntime((current) => advanceWorldMovement(MAP, current.movement, current.worldState, dynamicBlockers));
    }, WALK_FRAME_MILLISECONDS);
    return () => clearTimeout(timer);
  }, [dynamicBlockers, runtime.movement]);

  const requestTile = useCallback((target: TilePoint) => {
    setSelected('protagonist');
    setRuntime((current) => ({
      ...current,
      movement: requestMovement(MAP, current.movement, target, dynamicBlockers),
    }));
  }, [dynamicBlockers]);

  const handlePrimary = useCallback((point: Readonly<{ x: number; y: number }>) => {
    const tile = screenToTile(camera, point);
    if (tile.x < 0 || tile.y < 0 || tile.x >= MAP.source.width || tile.y >= MAP.source.height) return;
    const candidates: ClickCandidate[] = [{ id: `floor-${tileKey(tile)}`, kind: 'floor', tile }];
    for (const [id, npcTile] of Object.entries(npcTiles)) {
      if (tileKey(npcTile) === tileKey(tile)) candidates.push({ id, kind: 'npc', tile: npcTile });
    }
    for (const prop of MAP.source.props) {
      if (tileKey(prop.tile) === tileKey(tile)) candidates.push({ id: prop.id, kind: 'object', tile: prop.tile });
    }
    for (const interaction of MAP.source.interactions) {
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
      const interaction = MAP.source.interactions.find(({ hitTile }) => tileKey(hitTile) === tileKey(tile));
      if (interaction) requestTile(interaction.targetTile);
      else requestTile(tile);
      return;
    }
    if (resolved.tile) requestTile(resolved.tile);
  }, [camera, npcTiles, requestTile]);

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

  const visibleFloors = useMemo(() => {
    const placements: SpritePlacement[] = [];
    for (let y = 0; y < MAP.source.height; y += 1) {
      for (let x = 0; x < MAP.source.width; x += 1) {
        const tile = { x, y };
        if (isVisible(tile, camera)) {
          placements.push({ id: `floor-${x}-${y}`, sprite: groundSpriteAt(MAP, tile), worldX: x * TILE_SIZE, worldY: y * TILE_SIZE });
        }
      }
    }
    return placements;
  }, [camera]);
  const visibleProps = MAP.source.props.filter(({ tile }) => isVisible(tile, camera))
    .sort((left, right) => compareWorldLayerTiles(WORLD_DEPTH.prop, left, right))
    .map((prop) => ({
    id: prop.id, sprite: prop.sprite, worldX: prop.tile.x * TILE_SIZE, worldY: prop.tile.y * TILE_SIZE,
  }));
  const visibleWalls = MAP.wallTiles.filter(({ tile }) => isVisible(tile, camera))
    .sort((left, right) => compareWorldLayerTiles(WORLD_DEPTH.wall, left, right))
    .map((wall) => ({
    id: wall.id, sprite: wall.sprite, worldX: wall.tile.x * TILE_SIZE, worldY: wall.tile.y * TILE_SIZE,
  }));
  const worldFrame = buildWorldFrameState(MAP, runtime.worldState, npcTiles, runtime.movement.direction, frame);
  const characters = worldFrame.characters.filter(({ tile }) => isVisible(tile, camera));
  const floorAtlas = atlasData(visibleFloors, camera);
  const propAtlas = atlasData(visibleProps, camera);
  const characterAtlas = atlasData(characters, camera);
  const wallAtlas = atlasData(visibleWalls, camera);
  const visibleRoofTiles = MAP.source.roofGroups
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
    : selected === 'linda'
      ? npcTiles.linda
      : npcTiles['generic-resident'];
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

  if (!image) return <View style={styles.loading}><Text style={styles.status}>DECODING WORLD ATLAS…</Text></View>;

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
        return MAP.source.effects.filter(({ tile }) => isVisible(tile, camera)).map((effect) => {
          const screen = worldToScreen(camera, { x: effect.tile.x * 32 + 16, y: effect.tile.y * 32 + 16 });
          return <Circle color={effect.kind === 'fire' ? '#f07832' : '#f5dd9d'} cx={screen.x} cy={screen.y} key={effect.id} r={3 * camera.zoom} />;
        });
      case 'wall':
        return <Atlas image={image} key={layer} sampling={NEAREST} sprites={wallAtlas.sprites} transforms={wallAtlas.transforms} />;
      case 'roof':
        return (
          <>
            <Atlas image={image} key="roof-atlas" sampling={NEAREST} sprites={roofAtlas.sprites} transforms={roofAtlas.transforms} />
            {MAP.source.roofGroups.filter(({ id }) => worldFrame.visibleRoofGroupIds.includes(id)).map((roof) => {
              const screen = worldToScreen(camera, { x: roof.bounds.x * 32, y: roof.bounds.y * 32 });
              return <Rect color="#4b211f55" height={roof.bounds.height * 32 * camera.zoom} key={roof.id} width={roof.bounds.width * 32 * camera.zoom} x={screen.x} y={screen.y} />;
            })}
          </>
        );
    }
  };

  return (
    <WorldInput
      onCancel={cancel}
      onCenter={center}
      onPan={handlePan}
      onPrimary={handlePrimary}
      onZoom={handleZoom}
    >
      <View
        accessibilityLabel={`World camera ${camera.x},${camera.y} at ${camera.zoom}x`}
        nativeID="world-camera-state"
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
          {(worldFrame.hiddenRoofGroupId ? MAP.source.areas : []).map((area) => {
            const screen = worldToScreen(camera, {
              x: (area.bounds.x + area.bounds.width / 2) * TILE_SIZE,
              y: (area.bounds.y + area.bounds.height / 2) * TILE_SIZE,
            });
            return (
              <Text
                key={area.id}
                style={[
                  styles.areaLabel,
                  {
                    fontSize: Math.min(11, 7 + (camera.zoom - 1) * 2),
                    left: screen.x - 44,
                    top: screen.y - 9,
                  },
                ]}
              >
                {area.id.toUpperCase()}
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
        <View nativeID="world-ui-location" style={styles.topPlate}>
          <Text style={styles.eyebrow}>NORTHWEST / RESIDENTIAL</Text>
          <Text style={styles.location}>{areaName(runtime.movement.player)}</Text>
          <Text style={styles.coordinates}>TILE {runtime.movement.player.x},{runtime.movement.player.y} · CAMERA {camera.zoom}×</Text>
        </View>
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
        <View nativeID="world-ui-help" style={styles.bottomPlate}>
          <Text style={styles.statusStrong}>{runtime.movement.status === 'unreachable' ? 'NO ROUTE' : runtime.movement.status.toUpperCase()}</Text>
          <Text style={styles.status}>LEFT CLICK MOVE / MIDDLE DRAG PAN / WHEEL ZOOM / F CENTER / ESC STOP</Text>
        </View>
      </View>
    </WorldInput>
  );
}

const styles = StyleSheet.create({
  areaLabel: {
    backgroundColor: '#211d1ac7',
    color: '#fff0c7',
    fontFamily: 'Silkscreen',
    paddingHorizontal: 4,
    paddingVertical: 2,
    position: 'absolute',
    textAlign: 'center',
    width: 88,
  },
  areaLabels: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  bottomPlate: {
    alignItems: 'center',
    backgroundColor: '#211d1adf',
    borderColor: '#ad7640',
    borderTopWidth: 2,
    bottom: 0,
    flexDirection: 'row',
    gap: 16,
    left: 0,
    paddingHorizontal: 14,
    paddingVertical: 8,
    position: 'absolute',
    right: 0,
  },
  canvas: { backgroundColor: '#b77945', height: VIEWPORT.height, width: VIEWPORT.width },
  coordinates: { color: '#bda77e', fontFamily: 'Silkscreen', fontSize: 9, marginTop: 3 },
  eyebrow: { color: '#dfa85e', fontFamily: 'Silkscreen', fontSize: 9 },
  frame: {
    borderColor: '#0f1412',
    borderWidth: 3,
    height: VIEWPORT.height + 6,
    overflow: 'hidden',
    position: 'relative',
    width: VIEWPORT.width + 6,
  },
  loading: { alignItems: 'center', height: VIEWPORT.height, justifyContent: 'center', width: VIEWPORT.width },
  location: { color: '#fff0c7', fontFamily: 'Silkscreen', fontSize: 15, marginTop: 2 },
  proofState: { height: 1, left: 0, opacity: 0, position: 'absolute', top: 0, width: 1 },
  status: { color: '#c3b18f', fontFamily: 'Silkscreen', fontSize: 9 },
  statusStrong: { color: '#f1c65b', fontFamily: 'Silkscreen', fontSize: 10 },
  topPlate: {
    backgroundColor: '#211d1ae8',
    borderBottomColor: '#ad7640',
    borderBottomWidth: 2,
    left: 14,
    paddingHorizontal: 13,
    paddingVertical: 9,
    position: 'absolute',
    top: 0,
    width: 240,
  },
  viewport: { height: VIEWPORT.height, width: VIEWPORT.width },
  zoomButton: { alignItems: 'center', borderColor: '#665139', borderWidth: 1, height: 29, justifyContent: 'center', width: 36 },
  zoomButtonActive: { backgroundColor: '#f1c65b', borderColor: '#fff0c7' },
  zoomPlate: { backgroundColor: '#211d1ae8', flexDirection: 'row', gap: 4, padding: 5, position: 'absolute', right: 12, top: 12 },
  zoomText: { color: '#d6c19a', fontFamily: 'Silkscreen', fontSize: 10 },
  zoomTextActive: { color: '#211d1a' },
});
