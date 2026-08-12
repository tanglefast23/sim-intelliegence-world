import type { WorldState } from '../domain/state/schema';
import { roofGroupAtV2, type CompiledMapV2 } from '../world/maps/compiled-v2';
import { pointsInRect, type TilePoint } from '../world/maps/schema';
import type { MovementDirection } from '../world/pathfinding/movement';
import { movementPresentation, type CharacterId } from './atlas';
import { compareDepth, WORLD_DEPTH } from './depth';
import { protagonistWobbleDegrees } from './protagonist-wobble';

const TILE_SIZE = 32;

export const WORLD_LAYER_ORDER = [
  'floor',
  'prop',
  'shadow',
  'character',
  'effect',
  'wall',
  'roof',
] as const;

export type WorldLayer = typeof WORLD_LAYER_ORDER[number];
export type WorldCharacterPlacement = Readonly<{
  id: string;
  visualId: CharacterId;
  sprite: string;
  tile: TilePoint;
  worldX: number;
  worldY: number;
  shadowWorldX: number;
  shadowWorldY: number;
  angleDegrees?: number;
}>;

export type WorldFrameState = Readonly<{
  layerOrder: readonly WorldLayer[];
  characters: readonly WorldCharacterPlacement[];
  hiddenRoofGroupId?: string;
  visibleRoofGroupIds: readonly string[];
  presentationHash: string;
  signature: string;
}>;

export type WorldActor = Readonly<{
  tile: TilePoint;
  visualId: CharacterId;
  direction?: MovementDirection;
  visualFoot?: Readonly<{ x: number; y: number }>;
  walkFrame?: 0 | 1;
  moving?: boolean;
  reducedMotion?: boolean;
  horizontalRunDistance?: number;
}>;

export type WorldActors = Readonly<Record<string, WorldActor>>;

export function compareWorldLayerTiles(
  layer: number,
  left: Readonly<{ id: string; tile: TilePoint }>,
  right: Readonly<{ id: string; tile: TilePoint }>,
): number {
  return compareDepth(
    { id: left.id, layer, tileY: left.tile.y },
    { id: right.id, layer, tileY: right.tile.y },
  );
}

export function buildWorldFrameState(
  map: CompiledMapV2,
  state: WorldState,
  actors: WorldActors,
  direction: MovementDirection,
  frame: 0 | 1,
  playerPresentation?: Readonly<{
    visualFoot: Readonly<{ x: number; y: number }>;
    walkFrame: 0 | 1;
    moving: boolean;
    reducedMotion: boolean;
    horizontalRunDistance?: number;
  }>,
): WorldFrameState {
  const playerPosition = state.protagonist.worldPosition;
  if (playerPosition.mapId !== map.source.id) {
    throw new Error(`World frame map ${map.source.id} does not own the protagonist.`);
  }
  const playerTile = { x: playerPosition.tileX, y: playerPosition.tileY };
  const characterInputs: Readonly<{
    id: string;
    visualId: CharacterId;
    tile: TilePoint;
    direction: MovementDirection;
    visualFoot?: Readonly<{ x: number; y: number }>;
    walkFrame: 0 | 1;
    moving: boolean;
    reducedMotion: boolean;
    horizontalRunDistance: number;
  }>[] = [
    {
      id: 'protagonist',
      visualId: 'protagonist',
      tile: playerTile,
      direction,
      visualFoot: playerPresentation?.visualFoot,
      walkFrame: playerPresentation?.walkFrame ?? frame,
      moving: playerPresentation?.moving ?? frame === 1,
      reducedMotion: playerPresentation?.reducedMotion ?? false,
      horizontalRunDistance: playerPresentation?.horizontalRunDistance ?? 0,
    },
    ...Object.entries(actors).sort(([left], [right]) => left.localeCompare(right, 'en')).map(([id, actor]) => ({
      id,
      visualId: actor.visualId,
      tile: actor.tile,
      direction: actor.direction ?? 'down',
      visualFoot: actor.visualFoot,
      walkFrame: actor.walkFrame ?? 0,
      moving: actor.moving ?? false,
      reducedMotion: actor.reducedMotion ?? false,
      horizontalRunDistance: actor.horizontalRunDistance ?? 0,
    })),
  ];
  const characters = characterInputs.map(({
    id,
    visualId,
    tile,
    direction: actorDirection,
    visualFoot,
    walkFrame,
    moving,
    reducedMotion,
    horizontalRunDistance,
  }) => {
    const actorFrame = moving ? walkFrame : 0;
    const presentation = movementPresentation(visualId, actorDirection, actorFrame);
    const foot = visualFoot ?? { x: tile.x * TILE_SIZE + 16, y: tile.y * TILE_SIZE + 29 };
    const leanX = reducedMotion ? 0 : presentation.leanX;
    const bounceY = reducedMotion ? 0 : presentation.bounceY;
    const shadowX = reducedMotion ? 0 : presentation.shadowX;
    return {
      id,
      visualId,
      sprite: presentation.sprite,
      tile: { ...tile },
      worldX: foot.x - 12 + leanX,
      worldY: foot.y - 27 + bounceY,
      shadowWorldX: foot.x - 7 + shadowX,
      shadowWorldY: foot.y,
      angleDegrees: protagonistWobbleDegrees({
        direction: actorDirection,
        status: moving ? 'moving' : 'idle',
        horizontalRunDistance,
        reducedMotion,
      }),
    };
  }).sort((left, right) => left.shadowWorldY - right.shadowWorldY || left.id.localeCompare(right.id, 'en'));
  const hiddenRoofGroupId = roofGroupAtV2(map, playerTile);
  const visibleRoofGroupIds = map.source.roofGroups
    .filter(({ id }) => id !== hiddenRoofGroupId)
    .map(({ id }) => id);

  const depthItems = [
    ...map.source.ground.regions.map(({ id, y }) => ({ id: `floor-${id}`, layer: WORLD_DEPTH.floor, tileY: y })),
    ...[...map.objectPartById.values()].map(({ id, depthAnchor }) => ({ id, layer: WORLD_DEPTH.prop, tileY: depthAnchor.y })),
    ...[...map.doorById.values()].map(({ id, tile }) => ({ id, layer: WORLD_DEPTH.prop, tileY: tile.y })),
    ...characters.map(({ id, tile }) => ({ id: `shadow-${id}`, layer: WORLD_DEPTH.shadow, tileY: tile.y })),
    ...characters.map(({ id, tile }) => ({ id, layer: WORLD_DEPTH.character, tileY: tile.y })),
    ...map.source.effects.map(({ id, tile }) => ({ id, layer: WORLD_DEPTH.effect, tileY: tile.y })),
    ...map.wallTiles.map(({ id, tile }) => ({ id, layer: WORLD_DEPTH.wall, tileY: tile.y })),
    ...visibleRoofGroupIds.map((id) => ({
      id,
      layer: WORLD_DEPTH.roof,
      tileY: Math.min(...(map.source.roofGroups.find((roof) => roof.id === id)?.cells
        .flatMap(pointsInRect).map(({ y }) => y) ?? [0])),
    })),
  ].sort(compareDepth);
  const signature = JSON.stringify({
    mapId: map.source.id,
    revision: state.revision,
    playerTile,
    characters,
    hiddenRoofGroupId: hiddenRoofGroupId ?? null,
    presentationHash: map.presentation.hash,
    depthItems,
  });
  return {
    layerOrder: WORLD_LAYER_ORDER,
    characters,
    hiddenRoofGroupId,
    visibleRoofGroupIds,
    presentationHash: map.presentation.hash,
    signature,
  };
}
