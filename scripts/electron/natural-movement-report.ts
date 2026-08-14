import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

import { DeterministicMovementTraceSchema } from '../../src/render/movement-evidence';
import { validateScreenshotBuffers } from './package-smoke-utils';

const TileSchema = z.object({ x: z.number().int(), y: z.number().int() }).strict();
const PointSchema = z.object({ x: z.number(), y: z.number() }).strict();
const ActorSchema = z.object({
  committed: TileSchema,
  visualFoot: PointSchema,
  direction: z.enum(['up', 'down', 'left', 'right']),
  walkFrame: z.union([z.literal(0), z.literal(1)]),
  status: z.enum(['idle', 'moving', 'waiting', 'unreachable']),
  target: TileSchema.nullable().optional(),
  curveActive: z.boolean(),
}).strict();
const PlayerActorSchema = ActorSchema.extend({
  horizontalRunDistance: z.number().nonnegative(),
  protagonistWobbleDegrees: z.number(),
}).strict();
const NpcActorSchema = ActorSchema.omit({ target: true }).extend({
  horizontalRunDistance: z.number().nonnegative(),
  wobbleDegrees: z.number(),
}).strict();
const PackageSampleSchema = z.object({
  player: PlayerActorSchema,
  npcs: z.record(z.string(), NpcActorSchema),
  reducedMotion: z.boolean(),
  evidenceTag: z.literal('interruption').optional(),
}).strict();
const PackagePassSchema = z.object({
  schemaVersion: z.literal(3),
  mode: z.enum(['standard', 'reduced']),
  npcMotionSource: z.literal('fixture'),
  npcMotionNpcId: z.literal('linda'),
  samples: z.array(PackageSampleSchema).min(2),
  firstSegmentUniquePositions: z.number().int().nonnegative(),
  curveObserved: z.boolean(),
  interruptionObserved: z.boolean(),
  playerWalkFrames: z.array(z.union([z.literal(0), z.literal(1)])),
  npcWalkFrames: z.array(z.union([z.literal(0), z.literal(1)])),
  rendererFps: z.number().nonnegative().nullable(),
  displayRafFps: z.number().nonnegative().nullable(),
  screenshotNames: z.array(z.string().min(1)).min(1),
}).strict();

const NaturalMovementSmokeProfileSchema = z.enum(['qualification', 'platform-shell']);
const NaturalMovementFpsEvidenceSchema = z.object({
  measuredFps: z.number().positive(),
  profile: NaturalMovementSmokeProfileSchema,
  thresholdFps: z.literal(55),
  thresholdPassed: z.boolean(),
  thresholdRequired: z.boolean(),
}).strict();

export const NaturalMovementReportSchema = z.object({
  schemaVersion: z.literal(4),
  testedCommit: z.string().regex(/^[a-f0-9]{40}$/u),
  evidenceSource: z.object({
    baseCommit: z.string().regex(/^[a-f0-9]{40}$/u),
    sourceSha256: z.string().regex(/^[a-f0-9]{64}$/u),
    sourcePaths: z.array(z.string().min(1)).min(1),
  }).strict(),
  traceDeterministic: z.literal(true),
  trace: DeterministicMovementTraceSchema,
  package: z.object({ standard: PackagePassSchema, reduced: PackagePassSchema }).strict(),
  rendererFpsEvidence: NaturalMovementFpsEvidenceSchema,
}).strict();

export type NaturalMovementReport = z.infer<typeof NaturalMovementReportSchema>;

export function evaluateNaturalMovementRendererFps(
  value: unknown,
  requestedProfile: unknown,
): NaturalMovementReport['rendererFpsEvidence'] {
  const profile = NaturalMovementSmokeProfileSchema.parse(requestedProfile);
  const measuredFps = Number(value);
  if (!Number.isFinite(measuredFps) || measuredFps <= 0) {
    throw new Error(`Natural-movement renderer FPS measurement is invalid: ${String(value)}.`);
  }
  const thresholdFps = 55 as const;
  const thresholdPassed = measuredFps >= thresholdFps;
  const thresholdRequired = profile === 'qualification';
  if (thresholdRequired && !thresholdPassed) {
    throw new Error(`Natural-movement packaged renderer FPS is below 55: ${String(value)}.`);
  }
  return { measuredFps, profile, thresholdFps, thresholdPassed, thresholdRequired };
}

export function validateNaturalMovementReport(
  candidate: unknown,
  evidenceRoot: string,
  options: Readonly<{
    validateScreenshots?: boolean;
    requiredProfile?: NaturalMovementReport['rendererFpsEvidence']['profile'];
  }> = {},
): NaturalMovementReport {
  const report = NaturalMovementReportSchema.parse(candidate);
  const { trace, package: packaged } = report;
  if (!trace.path.some((tile, index) => {
    const prior = index === 0 ? trace.start : trace.path[index - 1]!;
    return prior.x !== tile.x && prior.y !== tile.y;
  })) throw new Error('Natural-movement trace does not contain a diagonal path node.');
  const firstCommitIndex = trace.samples.findIndex(({ committedThisStep }) => committedThisStep.length > 0);
  const firstSegmentSamples = firstCommitIndex < 0 ? trace.samples : trace.samples.slice(0, firstCommitIndex);
  const uniqueFirstSegment = new Set(firstSegmentSamples.map(({ visualFoot }) => `${visualFoot.x},${visualFoot.y}`));
  if (uniqueFirstSegment.size < 5) throw new Error('Natural-movement trace has fewer than five first-segment positions.');
  if (!trace.samples.some(({ curveActive }) => curveActive)) throw new Error('Natural-movement trace did not use a safe turn curve.');
  if (new Set(trace.samples.map(({ walkFrame }) => walkFrame)).size !== 2) {
    throw new Error('Natural-movement trace did not use both walking frames.');
  }
  const packageSummary = (samples: NaturalMovementReport['package']['standard']['samples']) => {
    const firstCommitted = samples[0]?.player.committed;
    const firstSegmentPositions = new Set(samples.filter(({ player }) => (
      player.committed.x === firstCommitted?.x && player.committed.y === firstCommitted?.y
    )).map(({ player }) => `${player.visualFoot.x},${player.visualFoot.y}`));
    const playerFrames = [...new Set(samples.map(({ player }) => player.walkFrame))].sort();
    const npcFrames = [...new Set(samples.flatMap(({ npcs }) => (
      Object.values(npcs).map(({ walkFrame }) => walkFrame)
    )))].sort();
    const curveObserved = samples.some(({ player }) => player.curveActive);
    const interruptionObserved = samples.some(({ evidenceTag, player }) => (
      evidenceTag === 'interruption' && player.status === 'moving' && player.target != null &&
      (player.committed.x !== player.target.x || player.committed.y !== player.target.y)
    ));
    const independentDirectionObserved = samples.some(({ player, npcs }) => (
      Object.values(npcs).some(({ direction }) => direction !== player.direction)
    ));
    const independentWalkPhaseObserved = samples.some(({ player, npcs }) => (
      Object.values(npcs).some(({ walkFrame }) => walkFrame !== player.walkFrame)
    ));
    return {
      firstSegmentPositions,
      playerFrames,
      npcFrames,
      curveObserved,
      interruptionObserved,
      independentDirectionObserved,
      independentWalkPhaseObserved,
    };
  };
  const standardSummary = packageSummary(packaged.standard.samples);
  const reducedSummary = packageSummary(packaged.reduced.samples);
  if (!packaged.standard.samples.some(({ player }) => player.protagonistWobbleDegrees !== 0)) {
    throw new Error('Packaged protagonist never showed a horizontal wobble angle.');
  }
  if (!packaged.reduced.samples.every(({ player }) => player.protagonistWobbleDegrees === 0)) {
    throw new Error('Reduced-motion protagonist did not remain upright.');
  }
  if (!packaged.reduced.samples.every(({ npcs }) => (
    Object.values(npcs).every(({ wobbleDegrees }) => wobbleDegrees === 0)
  ))) throw new Error('Reduced-motion NPC did not remain upright.');
  for (const sample of [...packaged.standard.samples, ...packaged.reduced.samples]) {
    if (
      [0, 32, 64, 96].includes(sample.player.horizontalRunDistance) &&
      sample.player.protagonistWobbleDegrees !== 0
    ) throw new Error('Packaged protagonist was not exactly upright at a horizontal tile boundary.');
    for (const npc of Object.values(sample.npcs)) {
      if ([0, 32, 64, 96].includes(npc.horizontalRunDistance) && npc.wobbleDegrees !== 0) {
        throw new Error('Packaged NPC was not exactly upright at a horizontal tile boundary.');
      }
    }
  }
  if (standardSummary.firstSegmentPositions.size < 5) {
    throw new Error('Packaged movement has fewer than five first-segment positions.');
  }
  if (!standardSummary.curveObserved || !standardSummary.interruptionObserved) {
    throw new Error('Packaged movement did not prove a curve and a bounded interruption.');
  }
  if (standardSummary.playerFrames.length !== 2) {
    throw new Error('Packaged protagonist did not use both walking frames.');
  }
  if (standardSummary.npcFrames.length !== 2) {
    throw new Error('Packaged NPC did not use both walking frames.');
  }
  if (!standardSummary.independentDirectionObserved || !standardSummary.independentWalkPhaseObserved) {
    throw new Error('Packaged actors did not prove independent direction and walking phase.');
  }
  if (
    packaged.standard.firstSegmentUniquePositions !== standardSummary.firstSegmentPositions.size ||
    packaged.standard.curveObserved !== standardSummary.curveObserved ||
    packaged.standard.interruptionObserved !== standardSummary.interruptionObserved ||
    JSON.stringify(packaged.standard.playerWalkFrames) !== JSON.stringify(standardSummary.playerFrames) ||
    JSON.stringify(packaged.standard.npcWalkFrames) !== JSON.stringify(standardSummary.npcFrames)
  ) throw new Error('Packaged movement summary does not match its recorded samples.');
  if (!packaged.reduced.samples.every(({ reducedMotion }) => reducedMotion)) {
    throw new Error('Reduced-motion package pass did not activate the reduced-motion policy.');
  }
  if (reducedSummary.firstSegmentPositions.size < 5) {
    throw new Error('Reduced-motion movement was not continuous.');
  }
  if (!reducedSummary.independentDirectionObserved || !reducedSummary.independentWalkPhaseObserved) {
    throw new Error('Reduced-motion actors did not prove independent direction and walking phase.');
  }
  if (
    packaged.reduced.firstSegmentUniquePositions !== reducedSummary.firstSegmentPositions.size ||
    packaged.reduced.curveObserved !== reducedSummary.curveObserved ||
    packaged.reduced.interruptionObserved !== reducedSummary.interruptionObserved ||
    JSON.stringify(packaged.reduced.playerWalkFrames) !== JSON.stringify(reducedSummary.playerFrames) ||
    JSON.stringify(packaged.reduced.npcWalkFrames) !== JSON.stringify(reducedSummary.npcFrames)
  ) throw new Error('Reduced-motion movement summary does not match its recorded samples.');
  const rendererFpsEvidence = evaluateNaturalMovementRendererFps(
    packaged.standard.rendererFps,
    report.rendererFpsEvidence.profile,
  );
  if (options.requiredProfile && rendererFpsEvidence.profile !== options.requiredProfile) {
    throw new Error(
      `Natural-movement report profile ${rendererFpsEvidence.profile} does not match required profile ${options.requiredProfile}.`,
    );
  }
  if (JSON.stringify(report.rendererFpsEvidence) !== JSON.stringify(rendererFpsEvidence)) {
    throw new Error('Natural-movement renderer FPS evidence does not match the measured package result.');
  }
  if (options.validateScreenshots !== false) {
    const names = [...packaged.standard.screenshotNames, ...packaged.reduced.screenshotNames];
    const buffers = names.map((name) => readFileSync(join(evidenceRoot, name)));
    for (let index = 1; index < buffers.length; index += 1) {
      validateScreenshotBuffers(buffers[index - 1]!, buffers[index]!);
    }
  }
  return report;
}
