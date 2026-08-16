import { z } from 'zod';

import type { CompiledMapV2 } from '../world/maps/compiled-v2';
import type { TilePoint } from '../world/maps/schema';
import { reservedTileKeys } from '../world/movement/reservations';
import { snapWorldPoint } from '../world/movement/motion-clock';
import { findPath } from '../world/pathfinding/astar';
import {
  advanceMovement,
  createMovementState,
  requestMovement,
} from '../world/pathfinding/movement';
import { actorFootPlant, gaitBobPixels } from './gait';
import { protagonistWobbleDegrees } from './protagonist-wobble';

const TileSchema = z.object({ x: z.number().int(), y: z.number().int() }).strict();
const PointSchema = z.object({ x: z.number(), y: z.number() }).strict();

export const MovementTraceSampleSchema = z.object({
  step: z.number().int().nonnegative(),
  submittedMs: z.number().int().nonnegative(),
  committed: TileSchema,
  committedThisStep: z.array(TileSchema),
  visualFoot: PointSchema,
  snapped: z.object({ oneX: PointSchema, twoX: PointSchema, threeX: PointSchema }).strict(),
  direction: z.enum(['up', 'down', 'left', 'right']),
  walkFrame: z.union([z.literal(0), z.literal(1)]),
  status: z.enum(['idle', 'moving', 'waiting', 'unreachable']),
  horizontalRunDistance: z.number().nonnegative(),
  protagonistWobbleDegrees: z.number(),
  // The RAW stride bob, before the device-pixel snap the renderer applies. This trace has no camera,
  // and the curve is what determinism is being proved about.
  gaitBobPixels: z.number(),
  footPlantIndex: z.number().int().nonnegative().nullable(),
  curveActive: z.boolean(),
  reservedKeys: z.array(z.string()),
}).strict();

export const DeterministicMovementTraceSchema = z.object({
  schemaVersion: z.literal(3),
  fixedStepMs: z.literal(16),
  start: TileSchema,
  target: TileSchema,
  path: z.array(TileSchema).min(1),
  totalCost: z.number().int().positive(),
  visitedNodes: z.number().int().positive(),
  samples: z.array(MovementTraceSampleSchema).min(2),
}).strict();

export type DeterministicMovementTrace = z.infer<typeof DeterministicMovementTraceSchema>;

function roundedPoint(point: Readonly<{ x: number; y: number }>) {
  return {
    x: Math.round(point.x * 1_000_000) / 1_000_000,
    y: Math.round(point.y * 1_000_000) / 1_000_000,
  };
}

export function buildDeterministicMovementTrace(
  map: CompiledMapV2,
  start: TilePoint,
  target: TilePoint,
): DeterministicMovementTrace {
  const route = findPath({
    width: map.source.width,
    height: map.source.height,
    start,
    target,
    blockedKeys: map.blockedKeys,
  });
  if (route.status !== 'found' || route.path.length === 0) {
    throw new Error(`Natural-movement evidence route is not reachable: ${route.status}.`);
  }

  let movement = requestMovement(map, createMovementState(start), target);
  const samples: z.infer<typeof MovementTraceSampleSchema>[] = [];
  let submittedMs = 0;
  for (let step = 0; step < 512; step += 1) {
    const result = advanceMovement(map, movement, 16);
    movement = result.movement;
    submittedMs += 16;
    samples.push({
      step,
      submittedMs,
      committed: { ...movement.player },
      committedThisStep: result.committedTiles.map((tile) => ({ ...tile })),
      visualFoot: roundedPoint(movement.visualFoot),
      snapped: {
        oneX: roundedPoint(snapWorldPoint(movement.visualFoot, 1, 2)),
        twoX: roundedPoint(snapWorldPoint(movement.visualFoot, 2, 2)),
        threeX: roundedPoint(snapWorldPoint(movement.visualFoot, 3, 2)),
      },
      direction: movement.direction,
      walkFrame: movement.walkFrame,
      status: movement.status,
      horizontalRunDistance: movement.horizontalRunDistance,
      protagonistWobbleDegrees: protagonistWobbleDegrees({
        direction: movement.direction,
        status: movement.status,
        horizontalRunDistance: movement.horizontalRunDistance,
        reducedMotion: false,
      }),
      gaitBobPixels: gaitBobPixels({
        travelDistance: movement.travelDistance,
        moving: movement.status === 'moving',
        reducedMotion: false,
      }),
      footPlantIndex: actorFootPlant('protagonist', movement)?.index ?? null,
      curveActive: Boolean(movement.latchedTurnCurve),
      reservedKeys: [...reservedTileKeys(movement)],
    });
    if (movement.status === 'idle') break;
  }
  if (movement.status !== 'idle' || movement.player.x !== target.x || movement.player.y !== target.y) {
    throw new Error('Natural-movement evidence trace did not reach its target within 512 fixed steps.');
  }
  return DeterministicMovementTraceSchema.parse({
    schemaVersion: 3,
    fixedStepMs: 16,
    start,
    target,
    path: route.path,
    totalCost: route.totalCost,
    visitedNodes: route.visitedNodes,
    samples,
  });
}
