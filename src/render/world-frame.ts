import type { WorldState } from '../domain/state/schema';
import type { CompiledMap, TilePoint } from '../world/maps/schema';
import { roofGroupAt } from '../world/maps/schema';
import type { MovementDirection } from '../world/pathfinding/movement';
import { movementPresentation, type CharacterId } from './atlas';
import { compareDepth, WORLD_DEPTH } from './depth';

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
  id: CharacterId;
  sprite: string;
  tile: TilePoint;
  worldX: number;
  worldY: number;
}>;

export type WorldFrameState = Readonly<{
  layerOrder: readonly WorldLayer[];
  characters: readonly WorldCharacterPlacement[];
  hiddenRoofGroupId?: string;
  visibleRoofGroupIds: readonly string[];
  signature: string;
}>;

export type WorldActorTiles = Readonly<Partial<Record<'linda' | 'generic-resident', TilePoint>>>;

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
  map: CompiledMap,
  state: WorldState,
  actorTiles: WorldActorTiles,
  direction: MovementDirection,
  frame: 0 | 1,
): WorldFrameState {
  const playerPosition = state.protagonist.worldPosition;
  if (playerPosition.mapId !== map.source.id) {
    throw new Error(`World frame map ${map.source.id} does not own the protagonist.`);
  }
  const playerTile = { x: playerPosition.tileX, y: playerPosition.tileY };
  const characterInputs: Readonly<{
    id: CharacterId;
    tile: TilePoint;
    direction: MovementDirection;
  }>[] = [{ id: 'protagonist', tile: playerTile, direction }];
  if (actorTiles.linda) characterInputs.push({ id: 'linda', tile: actorTiles.linda, direction: 'down' });
  if (actorTiles['generic-resident']) {
    characterInputs.push({ id: 'generic-resident', tile: actorTiles['generic-resident'], direction: 'left' });
  }
  const characters = characterInputs.map(({ id, tile, direction: actorDirection }) => {
    const presentation = movementPresentation(id, actorDirection, frame);
    return {
      id,
      sprite: presentation.sprite,
      tile: { ...tile },
      worldX: tile.x * TILE_SIZE + 4 + presentation.leanX,
      worldY: tile.y * TILE_SIZE + 2 + presentation.bounceY,
    };
  }).sort((left, right) => compareWorldLayerTiles(WORLD_DEPTH.character, left, right));
  const hiddenRoofGroupId = roofGroupAt(map, playerTile);
  const visibleRoofGroupIds = map.source.roofGroups
    .filter(({ id }) => id !== hiddenRoofGroupId)
    .map(({ id }) => id);

  const depthItems = [
    ...map.source.ground.regions.map(({ id, y }) => ({ id: `floor-${id}`, layer: WORLD_DEPTH.floor, tileY: y })),
    ...map.source.props.map(({ id, tile }) => ({ id, layer: WORLD_DEPTH.prop, tileY: tile.y })),
    ...characters.map(({ id, tile }) => ({ id: `shadow-${id}`, layer: WORLD_DEPTH.shadow, tileY: tile.y })),
    ...characters.map(({ id, tile }) => ({ id, layer: WORLD_DEPTH.character, tileY: tile.y })),
    ...map.source.effects.map(({ id, tile }) => ({ id, layer: WORLD_DEPTH.effect, tileY: tile.y })),
    ...map.wallTiles.map(({ id, tile }) => ({ id, layer: WORLD_DEPTH.wall, tileY: tile.y })),
    ...visibleRoofGroupIds.map((id) => ({
      id,
      layer: WORLD_DEPTH.roof,
      tileY: map.source.roofGroups.find((roof) => roof.id === id)?.bounds.y ?? 0,
    })),
  ].sort(compareDepth);
  const signature = JSON.stringify({
    mapId: map.source.id,
    revision: state.revision,
    playerTile,
    characters,
    hiddenRoofGroupId: hiddenRoofGroupId ?? null,
    depthItems,
  });
  return {
    layerOrder: WORLD_LAYER_ORDER,
    characters,
    hiddenRoofGroupId,
    visibleRoofGroupIds,
    signature,
  };
}
