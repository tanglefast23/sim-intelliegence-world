import type { CompiledMap, TilePoint } from '../maps/schema';
import { tileKey } from '../maps/schema';
import { findCardinalPath } from './astar';

export type MovementDirection = 'up' | 'down' | 'left' | 'right';

export type MovementState = Readonly<{
  player: TilePoint;
  target?: TilePoint;
  path: readonly TilePoint[];
  direction: MovementDirection;
  status: 'idle' | 'moving' | 'unreachable';
  feedbackTile?: TilePoint;
}>;

function mergedBlockers(map: CompiledMap, dynamicBlockers: ReadonlySet<string>): Set<string> {
  return new Set([...map.blockedKeys, ...dynamicBlockers]);
}

export function createMovementState(player: TilePoint): MovementState {
  return { player: { ...player }, path: [], direction: 'down', status: 'idle' };
}

export function requestMovement(
  map: CompiledMap,
  state: MovementState,
  target: TilePoint,
  dynamicBlockers: ReadonlySet<string> = new Set(),
): MovementState {
  const blockers = mergedBlockers(map, dynamicBlockers);
  blockers.delete(tileKey(state.player));
  const result = findCardinalPath({
    width: map.source.width,
    height: map.source.height,
    start: state.player,
    target,
    blockedKeys: blockers,
  });
  if (result.status === 'unreachable') {
    return { ...state, target, path: [], status: 'unreachable', feedbackTile: { ...target } };
  }
  return {
    ...state,
    target: { ...target },
    path: result.path,
    status: result.path.length === 0 ? 'idle' : 'moving',
    feedbackTile: undefined,
  };
}

export function cancelMovement(state: MovementState): MovementState {
  return { ...state, target: undefined, path: [], status: 'idle', feedbackTile: undefined };
}

export function stepMovement(
  map: CompiledMap,
  state: MovementState,
  dynamicBlockers: ReadonlySet<string> = new Set(),
): MovementState {
  if (state.status !== 'moving' || state.path.length === 0) return state;
  const next = state.path[0];
  if (!next) return { ...state, path: [], status: 'idle' };
  if (dynamicBlockers.has(tileKey(next))) {
    if (!state.target) return cancelMovement(state);
    return requestMovement(map, { ...state, path: [] }, state.target, dynamicBlockers);
  }
  const deltaX = next.x - state.player.x;
  const deltaY = next.y - state.player.y;
  const direction: MovementDirection = deltaX < 0 ? 'left' : deltaX > 0 ? 'right' : deltaY < 0 ? 'up' : 'down';
  const path = state.path.slice(1);
  return {
    ...state,
    player: { ...next },
    path,
    direction,
    status: path.length === 0 ? 'idle' : 'moving',
    feedbackTile: undefined,
  };
}
