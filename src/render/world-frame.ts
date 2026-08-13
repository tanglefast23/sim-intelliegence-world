import type { WorldState } from '../domain/state/schema';
import { roofGroupAtV2, type CompiledDoorV2, type CompiledMapV2 } from '../world/maps/compiled-v2';
import { tileKey, type TilePoint } from '../world/maps/schema';
import { activeDoorId, type MovementDirection, type MovementState } from '../world/pathfinding/movement';
import { movementPresentation, type CharacterId } from './atlas';
import { compareDepth } from './depth';
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
export type CharacterPose = 'idle' | 'reaction' | 'talk';
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
  pose?: CharacterPose;
  poseFrame?: 0 | 1;
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

export function doorSpriteForFrame(
  door: CompiledDoorV2,
  movements: readonly MovementState[],
): string {
  if (door.initialState !== 'closed-unlocked') return door.sprite;
  const open = movements.some((movement) => (
    activeDoorId(movement) === door.id || tileKey(movement.player) === tileKey(door.tile)
  ));
  return open ? door.sprite.replace('closed-door', 'open-door') : door.sprite;
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
    pose?: CharacterPose;
    poseFrame?: 0 | 1;
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
    pose: CharacterPose;
    poseFrame: 0 | 1;
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
      pose: playerPresentation?.pose ?? 'idle',
      poseFrame: playerPresentation?.poseFrame ?? 0,
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
      pose: actor.pose ?? 'idle',
      poseFrame: actor.poseFrame ?? 0,
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
    pose,
    poseFrame,
  }) => {
    const actorFrame = moving ? walkFrame : pose === 'idle' ? 0 : poseFrame;
    const presentation = movementPresentation(visualId, actorDirection, actorFrame);
    const foot = visualFoot ?? { x: tile.x * TILE_SIZE + 16, y: tile.y * TILE_SIZE + 29 };
    const leanX = reducedMotion ? 0 : presentation.leanX;
    const poseLift = reducedMotion || moving ? 0 : pose === 'reaction' ? -2 : poseFrame === 1 ? -1 : 0;
    const bounceY = reducedMotion ? 0 : presentation.bounceY + poseLift;
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
      angleDegrees: moving ? protagonistWobbleDegrees({
        direction: actorDirection,
        status: moving ? 'moving' : 'idle',
        horizontalRunDistance,
        reducedMotion,
      }) : reducedMotion ? 0 : pose === 'reaction' ? -4 : pose === 'talk' && poseFrame === 1 ? 2 : 0,
    };
  }).sort((left, right) => left.shadowWorldY - right.shadowWorldY || left.id.localeCompare(right.id, 'en'));
  const hiddenRoofGroupId = roofGroupAtV2(map, playerTile);
  const visibleRoofGroupIds = map.source.roofGroups
    .filter(({ id }) => id !== hiddenRoofGroupId)
    .map(({ id }) => id);

  return {
    layerOrder: WORLD_LAYER_ORDER,
    characters,
    hiddenRoofGroupId,
    visibleRoofGroupIds,
    presentationHash: map.presentation.hash,
  };
}
