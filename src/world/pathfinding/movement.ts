import type { CompiledMapV2 } from '../maps/compiled-v2';
import type { TilePoint } from '../maps/schema';
import { tileKey } from '../maps/schema';
import {
  MAX_MOVEMENT_FRAME_MS,
  sampleSegment,
  segmentDuration,
  segmentLength,
  tileFootPoint,
  type MotionSegment,
  type WorldPoint,
} from '../movement/motion-clock';
import {
  buildTurnCurve,
  sampleQuadraticByDistance,
  TURN_RADIUS,
  type TurnCurve,
} from '../movement/turn-curve';
import { findPath } from './astar';

export type MovementDirection = 'up' | 'down' | 'left' | 'right';

export type MovementState = Readonly<{
  player: TilePoint;
  target?: TilePoint;
  pendingTarget?: TilePoint;
  resumeTarget?: TilePoint;
  previousTile?: TilePoint;
  path: readonly TilePoint[];
  segment?: MotionSegment;
  visualFoot: WorldPoint;
  direction: MovementDirection;
  travelDistance: number;
  walkFrame: 0 | 1;
  blockedTileKey?: string;
  blockedElapsedMs: number;
  blockedReplanAttempted: boolean;
  blockedAttempts: number;
  latchedTurnCurve?: TurnCurve;
  latchedTurnCorner?: TilePoint;
  stopAfterSegment: boolean;
  status: 'idle' | 'moving' | 'waiting' | 'unreachable';
  feedbackTile?: TilePoint;
}>;

export function createMovementState(player: TilePoint): MovementState {
  return {
    player: { ...player },
    path: [],
    visualFoot: tileFootPoint(player),
    direction: 'down',
    travelDistance: 0,
    walkFrame: 0,
    blockedElapsedMs: 0,
    blockedReplanAttempted: false,
    blockedAttempts: 0,
    stopAfterSegment: false,
    status: 'idle',
  };
}

export function requestMovement(
  map: CompiledMapV2,
  state: MovementState,
  target: TilePoint,
  dynamicBlockers: ReadonlySet<string> = new Set(),
): MovementState {
  if (state.segment) {
    return {
      ...state,
      pendingTarget: { ...target },
      resumeTarget: undefined,
      stopAfterSegment: false,
      feedbackTile: undefined,
    };
  }
  const blockers = new Set([...map.blockedKeys, ...dynamicBlockers]);
  blockers.delete(tileKey(state.player));
  const result = findPath({
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
    pendingTarget: undefined,
    resumeTarget: undefined,
    segment: undefined,
    visualFoot: tileFootPoint(state.player),
    travelDistance: 0,
    walkFrame: 0,
    status: result.path.length === 0 ? 'idle' : 'moving',
    stopAfterSegment: false,
    blockedTileKey: undefined,
    blockedElapsedMs: 0,
    blockedReplanAttempted: false,
    blockedAttempts: 0,
    latchedTurnCurve: undefined,
    latchedTurnCorner: undefined,
    feedbackTile: undefined,
  };
}

export function cancelMovement(state: MovementState): MovementState {
  if (state.segment) {
    return { ...state, pendingTarget: undefined, stopAfterSegment: true, feedbackTile: undefined };
  }
  return {
    ...state,
    target: undefined,
    pendingTarget: undefined,
    resumeTarget: undefined,
    path: [],
    segment: undefined,
    visualFoot: tileFootPoint(state.player),
    travelDistance: 0,
    walkFrame: 0,
    blockedTileKey: undefined,
    blockedElapsedMs: 0,
    blockedReplanAttempted: false,
    blockedAttempts: 0,
    latchedTurnCurve: undefined,
    latchedTurnCorner: undefined,
    stopAfterSegment: false,
    status: 'idle',
    feedbackTile: undefined,
  };
}

export type MovementAdvance = Readonly<{
  movement: MovementState;
  committedTiles: readonly TilePoint[];
}>;

function movementDirection(from: TilePoint, to: TilePoint, previous: MovementDirection): MovementDirection {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  if (deltaY < 0) return 'up';
  if (deltaY > 0) return 'down';
  if (deltaX < 0) return 'left';
  if (deltaX > 0) return 'right';
  return previous;
}

function beginSegment(
  map: CompiledMapV2,
  state: MovementState,
  dynamicBlockers: ReadonlySet<string>,
): MovementState {
  const next = state.path[0];
  if (!next) return { ...state, target: undefined, status: 'idle', walkFrame: 0 };
  if (dynamicBlockers.has(tileKey(next))) {
    return { ...state, status: 'waiting' };
  }
  const segment = { from: state.player, to: next, elapsedMs: 0, durationMs: segmentDuration(state.player, next) };
  return {
    ...state,
    segment,
    direction: movementDirection(state.player, next, state.direction),
    status: 'moving',
    blockedTileKey: undefined,
    blockedElapsedMs: 0,
    blockedReplanAttempted: false,
    blockedAttempts: 0,
  };
}

const BLOCKED_CLAIM_RETRY_MS = 145;
const BLOCKED_CLAIM_BUDGET = 4;
const BLOCKED_REPLAN_MS = BLOCKED_CLAIM_RETRY_MS * BLOCKED_CLAIM_BUDGET;

function findYieldRoute(
  map: CompiledMapV2,
  state: MovementState,
  dynamicBlockers: ReadonlySet<string>,
): Readonly<{ target: TilePoint; path: readonly TilePoint[] }> | undefined {
  const blockers = new Set([...map.blockedKeys, ...dynamicBlockers]);
  blockers.delete(tileKey(state.player));
  for (let radius = 1; radius <= 6; radius += 1) {
    for (let y = state.player.y - radius; y <= state.player.y + radius; y += 1) {
      for (let x = state.player.x - radius; x <= state.player.x + radius; x += 1) {
        if (Math.max(Math.abs(x - state.player.x), Math.abs(y - state.player.y)) !== radius) continue;
        const target = { x, y };
        if (blockers.has(tileKey(target)) || tileKey(target) === state.blockedTileKey) continue;
        const result = findPath({
          width: map.source.width,
          height: map.source.height,
          start: state.player,
          target,
          blockedKeys: blockers,
        });
        if (result.status === 'found' && result.path.length > 0) return { target, path: result.path };
      }
    }
  }
  return undefined;
}

function waitOrReplan(
  map: CompiledMapV2,
  state: MovementState,
  submittedMs: number,
  dynamicBlockers: ReadonlySet<string>,
): MovementState {
  const blockedTile = state.path[0];
  if (!blockedTile) return { ...state, status: 'idle', target: undefined };
  const blockedTileKey = tileKey(blockedTile);
  const sameBlocker = state.blockedTileKey === blockedTileKey;
  const blockedElapsedMs = (sameBlocker ? state.blockedElapsedMs : 0) + submittedMs;
  const blockedAttempts = Math.min(
    BLOCKED_CLAIM_BUDGET,
    Math.floor(blockedElapsedMs / BLOCKED_CLAIM_RETRY_MS),
  );
  const replanAttempted = sameBlocker && state.blockedReplanAttempted;
  if (blockedElapsedMs < BLOCKED_REPLAN_MS || replanAttempted) {
    return {
      ...state,
      status: 'waiting',
      blockedTileKey,
      blockedElapsedMs,
      blockedReplanAttempted: replanAttempted,
      blockedAttempts,
    };
  }
  const target = state.target;
  if (!target) return { ...state, status: 'idle', path: [] };
  const blockers = new Set([...map.blockedKeys, ...dynamicBlockers]);
  blockers.delete(tileKey(state.player));
  const result = findPath({
    width: map.source.width,
    height: map.source.height,
    start: state.player,
    target,
    blockedKeys: blockers,
  });
  if (result.status === 'found' && result.path.length > 0) {
    return {
      ...state,
      path: result.path,
      status: 'moving',
      blockedTileKey: undefined,
      blockedElapsedMs: 0,
      blockedReplanAttempted: false,
      blockedAttempts: 0,
    };
  }
  const yieldRoute = findYieldRoute(map, { ...state, blockedTileKey }, dynamicBlockers);
  if (yieldRoute) {
    return {
      ...state,
      target: yieldRoute.target,
      resumeTarget: state.resumeTarget ?? state.target,
      path: yieldRoute.path,
      status: 'moving',
      blockedTileKey: undefined,
      blockedElapsedMs: 0,
      blockedReplanAttempted: false,
      blockedAttempts: 0,
    };
  }
  return {
    ...state,
    status: 'waiting',
    blockedTileKey,
    blockedElapsedMs,
    blockedReplanAttempted: true,
    blockedAttempts,
  };
}

type VisualSample = Readonly<{
  visualFoot: WorldPoint;
  latchedTurnCurve?: TurnCurve;
  latchedTurnCorner?: TilePoint;
}>;

function sampleVisualFoot(
  map: CompiledMapV2,
  state: MovementState,
  segment: MotionSegment,
  dynamicBlockers: ReadonlySet<string>,
): VisualSample {
  const length = segmentLength(segment.from, segment.to);
  const distance = length * Math.max(0, Math.min(1, segment.elapsedMs / segment.durationMs));
  const fromKey = tileKey(segment.from);
  const toKey = tileKey(segment.to);
  const latchedCornerKey = state.latchedTurnCorner ? tileKey(state.latchedTurnCorner) : undefined;
  if (state.latchedTurnCurve && latchedCornerKey === fromKey && distance <= TURN_RADIUS) {
    return {
      visualFoot: sampleQuadraticByDistance(state.latchedTurnCurve, 0.5 + (distance / TURN_RADIUS) * 0.5),
      latchedTurnCurve: state.latchedTurnCurve,
      latchedTurnCorner: state.latchedTurnCorner,
    };
  }
  if (state.latchedTurnCurve && latchedCornerKey === toKey && distance >= length - TURN_RADIUS) {
    return {
      visualFoot: sampleQuadraticByDistance(
        state.latchedTurnCurve,
        ((distance - (length - TURN_RADIUS)) / TURN_RADIUS) * 0.5,
      ),
      latchedTurnCurve: state.latchedTurnCurve,
      latchedTurnCorner: state.latchedTurnCorner,
    };
  }
  if (state.pendingTarget || state.stopAfterSegment) return { visualFoot: sampleSegment(segment) };
  const next = state.path[1];
  if (next && distance >= length - TURN_RADIUS) {
    const curve = buildTurnCurve(map, segment.from, segment.to, next, dynamicBlockers);
    if (curve) return {
      visualFoot: sampleQuadraticByDistance(curve, ((distance - (length - TURN_RADIUS)) / TURN_RADIUS) * 0.5),
      latchedTurnCurve: curve,
      latchedTurnCorner: segment.to,
    };
  }
  return { visualFoot: sampleSegment(segment) };
}

export function advanceMovement(
  map: CompiledMapV2,
  state: MovementState,
  elapsedMs: number,
  speed = 1,
  dynamicBlockers: ReadonlySet<string> = new Set(),
): MovementAdvance {
  if (speed <= 0 || state.status === 'idle' || state.status === 'unreachable') {
    return { movement: state, committedTiles: [] };
  }
  const submitted = Math.max(0, Math.min(MAX_MOVEMENT_FRAME_MS, elapsedMs)) * speed;
  let current = state.segment ? state : beginSegment(map, state, dynamicBlockers);
  if (!current.segment && current.status === 'waiting') {
    current = waitOrReplan(map, current, submitted, dynamicBlockers);
    if (current.status === 'moving') current = beginSegment(map, current, dynamicBlockers);
  }
  if (!current.segment) return { movement: current, committedTiles: [] };
  const remaining = current.segment.durationMs - current.segment.elapsedMs;
  const consumed = Math.min(remaining, submitted);
  const distance = segmentLength(current.segment.from, current.segment.to) * (consumed / current.segment.durationMs);
  const segment = { ...current.segment, elapsedMs: current.segment.elapsedMs + consumed };
  const travelDistance = current.travelDistance + distance;
  const visualSample = sampleVisualFoot(map, current, segment, dynamicBlockers);
  current = {
    ...current,
    segment,
    visualFoot: visualSample.visualFoot,
    latchedTurnCurve: visualSample.latchedTurnCurve,
    latchedTurnCorner: visualSample.latchedTurnCorner,
    travelDistance,
    walkFrame: Math.floor(travelDistance / 32) % 2 as 0 | 1,
  };
  if (segment.elapsedMs < segment.durationMs) return { movement: current, committedTiles: [] };
  if (dynamicBlockers.has(tileKey(segment.to))) {
    return {
      movement: {
        ...current,
        segment: undefined,
        visualFoot: tileFootPoint(current.player),
        status: 'waiting',
        walkFrame: 0,
      },
      committedTiles: [],
    };
  }
  const path = current.path.slice(1);
  const committed = { ...segment.to };
  let completed: MovementState = {
    ...current,
    player: committed,
    previousTile: segment.from,
    path,
    segment: undefined,
    visualFoot: tileFootPoint(committed),
    status: path.length === 0 ? 'idle' : 'moving',
  };
  if (current.stopAfterSegment) completed = cancelMovement({ ...completed, stopAfterSegment: false });
  else if (current.pendingTarget) {
    const pending = current.pendingTarget;
    completed = requestMovement(map, { ...completed, pendingTarget: undefined }, pending, dynamicBlockers);
  } else if (path.length === 0 && current.resumeTarget) {
    completed = requestMovement(
      map,
      { ...completed, target: undefined, resumeTarget: undefined },
      current.resumeTarget,
      dynamicBlockers,
    );
  } else if (path.length === 0) {
    completed = {
      ...completed,
      target: undefined,
      travelDistance: 0,
      walkFrame: 0,
      latchedTurnCurve: undefined,
      latchedTurnCorner: undefined,
    };
  }
  return { movement: completed, committedTiles: [committed] };
}

export function stepMovement(
  map: CompiledMapV2,
  state: MovementState,
  dynamicBlockers: ReadonlySet<string> = new Set(),
): MovementState {
  let current = state;
  for (let index = 0; index < 8; index += 1) {
    const result = advanceMovement(map, current, MAX_MOVEMENT_FRAME_MS, 1, dynamicBlockers);
    current = result.movement;
    if (result.committedTiles.length > 0 || current.status === 'idle' || current.status === 'unreachable' || current.status === 'waiting') break;
  }
  return current;
}
