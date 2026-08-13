import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { arch, cpus, platform, totalmem } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import { z } from 'zod';

import { ModelManifestSchema, verifyArtifact } from '../../electron/model/model-manifest';
import { ModelSupervisor } from '../../electron/model/model-supervisor';
import { buildActorSpikePrompt, buildMoveReaderPrompt, moveReaderCandidates, moveReaderUserMessage } from '../../src/ai/conversation/verbal-mission-prompts';
import { parseVerbalMoveJson, verbalMoveJsonSchemaForCandidates } from '../../src/ai/schemas/verbal-move';
import { parseBoundedJson } from '../../src/ai/schemas/safe-json';
import { parsePolicyResponseJson, policyResponseJsonSchema } from '../../src/ai/schemas/policy-response';
import {
  VERBAL_MISSION_READER_CORPUS,
  VERBAL_MISSION_SPIKE_FACTS,
  VERBAL_MISSION_SPIKE_REFERENTS,
  verbalMissionSpikeFixtureMatches,
} from '../../tests/fixtures/ai-capability/verbal-missions';
import { resolveTestedCommit } from './tested-commit';

const ActorSpikeSchema = z.object({
  dialogue: z.string().trim().min(1).max(240),
  reactionId: z.string().regex(/^[a-z][a-z0-9_]*$/u),
}).strict();
const actorSpikeJsonSchema = z.toJSONSchema(ActorSpikeSchema, { target: 'draft-7' });
const FORBIDDEN_ACTOR_RESULT = /\b(?:sold|agreed|deal is done|take it|it is yours)\b|\$80\b/iu;

function requiredModelRoot(): string {
  const root = process.env.SI_WORLD_MODEL_ROOT;
  if (!root || !isAbsolute(root)) throw new Error('SI_WORLD_MODEL_ROOT must be an absolute external directory.');
  return root;
}

function percentile(values: readonly number[], ratio: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)] ?? null;
}

async function main(): Promise<void> {
  const root = requiredModelRoot();
  const requested = process.argv[2] ?? '4b';
  if (requested !== '4b' && requested !== '9b') {
    throw new Error('Usage: run-verbal-mission-spike.ts [4b|9b] [output-file]');
  }
  const outputPath = resolve(process.cwd(), process.argv[3] ?? `artifacts/verbal-missions/model-spike-${requested}.json`);
  const requestedPrefixes = (process.env.SI_WORLD_VERBAL_CASE_PREFIXES ?? '')
    .split(',').map((prefix: string) => prefix.trim()).filter(Boolean);
  const fixtures = requestedPrefixes.length === 0
    ? VERBAL_MISSION_READER_CORPUS
    : VERBAL_MISSION_READER_CORPUS.filter(({ id }) => requestedPrefixes.some(
      (prefix: string) => id.startsWith(`${prefix}_`),
    ));
  if (fixtures.length === 0) throw new Error('SI_WORLD_VERBAL_CASE_PREFIXES matched no qualification cases.');
  const manifest = ModelManifestSchema.parse(JSON.parse(await readFile(join(root, 'model-manifest.json'), 'utf8')) as unknown);
  const model = manifest.models.find(({ id }) => id === `qwen3.5-${requested}`);
  if (!model) throw new Error(`Manifest does not contain qwen3.5-${requested}.`);
  const platformId = `${platform()}-${arch()}`;
  const runtimeRoot = join(root, 'runtime', platformId);
  const server = manifest.llamaCpp.artifacts.find(({ platform: target }) => target === platformId);
  const guard = manifest.llamaCpp.parentGuards.find(({ platform: target }) => target === platformId);
  if (!server || !guard) throw new Error(`Manifest does not contain runtime artifacts for ${platformId}.`);
  const supervisor = new ModelSupervisor({
    executablePath: await verifyArtifact(runtimeRoot, server),
    parentGuardPath: await verifyArtifact(runtimeRoot, guard),
    modelPath: await verifyArtifact(join(root, 'models', 'gguf'), model.artifact),
    workingDirectory: runtimeRoot,
    temporaryRoot: join(root, 'temporary', `verbal-mission-spike-${requested}`),
  });
  const samples: Array<Record<string, unknown>> = [];
  try {
    await supervisor.start();
    for (const fixture of fixtures) {
      const readerPrompt = buildMoveReaderPrompt({
        playerMessage: fixture.playerMessage,
        referents: VERBAL_MISSION_SPIKE_REFERENTS,
        facts: VERBAL_MISSION_SPIKE_FACTS,
      });
      const readerCandidates = moveReaderCandidates({
        playerMessage: fixture.playerMessage,
        referents: VERBAL_MISSION_SPIKE_REFERENTS,
        facts: VERBAL_MISSION_SPIKE_FACTS,
      });
      const reader = await supervisor.completeBufferedWithTimings({
        messages: [
          { role: 'system', content: readerPrompt },
          { role: 'user', content: moveReaderUserMessage(fixture.playerMessage) },
        ],
        schemaName: 'si_world_verbal_move',
        jsonSchema: verbalMoveJsonSchemaForCandidates(readerCandidates),
        maxTokens: 160,
      });
      let move;
      let readerStructuredValid = false;
      let readerSemanticValid = false;
      let readerFailure = '';
      try {
        move = parseVerbalMoveJson(reader.content, fixture.playerMessage, readerCandidates);
        readerStructuredValid = true;
        readerSemanticValid = verbalMissionSpikeFixtureMatches(move, fixture);
        if (!readerSemanticValid) readerFailure = 'semantic_mismatch';
      } catch (error) {
        readerStructuredValid = false;
        readerFailure = error instanceof Error ? error.message : 'parse_or_schema';
      }
      const reactionId = readerStructuredValid ? `linda_${move?.acts[0]?.act ?? 'other'}_acknowledged` : 'linda_clarify_move';
      const actor = await supervisor.completeBufferedWithTimings({
        messages: [
          { role: 'system', content: buildActorSpikePrompt({ npcName: 'Linda', reactionId }) },
          { role: 'user', content: `PLAYER MESSAGE JSON: ${JSON.stringify(fixture.playerMessage)}` },
        ],
        schemaName: 'si_world_verbal_actor_spike',
        jsonSchema: actorSpikeJsonSchema,
        maxTokens: 96,
      });
      let actorDialogue = '';
      let actorValid = false;
      try {
        const parsed = ActorSpikeSchema.parse(parseBoundedJson(actor.content));
        actorDialogue = parsed.dialogue;
        actorValid = parsed.reactionId === reactionId && !FORBIDDEN_ACTOR_RESULT.test(parsed.dialogue);
      } catch {
        actorValid = false;
      }
      const policy = await supervisor.completeBufferedWithTimings({
        messages: [
          { role: 'system', content: [
            'You are a closed-enum safety classifier. Inspect only the DIALOGUE JSON in the user message.',
            'Do not classify the policy words in this system message.',
            'Allowed: fictional adult crime, drugs, addiction, violence, relationships, and consensual adult prostitution.',
            'Refuse: sexual violence, sexual content involving minors, or sexual content involving real people.',
            'Fade to black: explicit sexual detail between fictional consenting adults.',
            'If none of those four blocked conditions appears in the dialogue, return decision allow and category allowed_fictional_adult.',
            'Ordinary talk about pets, island life, feelings, crime, drugs, or adult vice is allowed.',
          ].join('\n') },
          { role: 'user', content: `DIALOGUE JSON: ${JSON.stringify(actorDialogue)}` },
        ],
        schemaName: 'si_world_content_policy',
        jsonSchema: policyResponseJsonSchema,
        maxTokens: 64,
      });
      let policyValid = false;
      let observedPolicy: unknown = null;
      try {
        const parsed = parsePolicyResponseJson(policy.content);
        observedPolicy = parsed;
        policyValid = parsed.decision === 'allow' && parsed.category === 'allowed_fictional_adult';
      } catch {
        policyValid = false;
      }
      samples.push({
        id: fixture.id,
        readerStructuredValid,
        readerSemanticValid,
        readerFailure: readerSemanticValid ? null : readerFailure,
        observedMove: move ? {
          acts: move.acts.map(({ act, referentId }) => ({ act, referentId })),
          register: move.register,
          claims: move.claims.map(({ factId, polarity }) => ({ factId, polarity })),
          referenceConfidence: move.referenceConfidence,
        } : null,
        actorValid,
        policyValid,
        observedPolicy,
        firstTokenMilliseconds: reader.firstTokenMilliseconds,
        authoritativeReactionMilliseconds: reader.totalMilliseconds,
        validatedActorMilliseconds: reader.totalMilliseconds + actor.totalMilliseconds + policy.totalMilliseconds,
        promptTokens: [reader.promptTokens, actor.promptTokens, policy.promptTokens],
        completionTokens: [reader.completionTokens, actor.completionTokens, policy.completionTokens],
      });
      if (samples.length % 25 === 0) {
        process.stderr.write(`Verbal Mission qualification ${requested}: ${samples.length}/${fixtures.length}.\n`);
      }
    }
  } finally {
    await supervisor.stop();
  }
  const reactions = samples.map(({ authoritativeReactionMilliseconds }) => Number(authoritativeReactionMilliseconds));
  const validatedActors = samples.map(({ validatedActorMilliseconds }) => Number(validatedActorMilliseconds));
  const structuredReaders = samples.filter(({ readerStructuredValid }) => readerStructuredValid).length;
  const semanticReaders = samples.filter(({ readerSemanticValid }) => readerSemanticValid).length;
  const wrongReferents = samples.filter((sample) => {
    const fixture = fixtures.find(({ id }) => id === sample.id);
    if (!fixture || fixture.expected.referentId === null) return false;
    const observed = sample.observedMove as { acts?: Array<{ referentId?: string | null }> } | null;
    return observed?.acts?.some(({ referentId }) => referentId !== null && referentId !== fixture.expected.referentId) ?? false;
  }).length;
  const falseBackfires = samples.filter((sample) => {
    const fixture = fixtures.find(({ id }) => id === sample.id);
    if (!fixture || fixture.expected.acts.some((act) => act === 'compliment' || act === 'threaten')) return false;
    const observed = sample.observedMove as {
      acts?: Array<{ act?: string }>;
      register?: string;
    } | null;
    return observed?.register === 'flattering' || observed?.acts?.some(({ act }) => act === 'threaten') === true;
  }).length;
  const registerMatches = samples.filter((sample) => {
    const fixture = fixtures.find(({ id }) => id === sample.id);
    const observed = sample.observedMove as { register?: string } | null;
    return fixture && observed?.register === fixture.expected.register;
  }).length;
  const confidenceMatches = samples.filter((sample) => {
    const fixture = fixtures.find(({ id }) => id === sample.id);
    const observed = sample.observedMove as { referenceConfidence?: string } | null;
    return fixture && observed?.referenceConfidence === fixture.expected.confidence;
  }).length;
  const validAll = samples.filter(({ readerStructuredValid, actorValid, policyValid }) => readerStructuredValid && actorValid && policyValid).length;
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    testedCommit: resolveTestedCommit(),
    modelId: model.id,
    hardware: {
      platform: platform(), architecture: arch(), processor: cpus()[0]?.model ?? 'unknown',
      logicalCpuCount: cpus().length, memoryBytes: totalmem(),
    },
    measurements: {
      sampleCount: samples.length,
      readerStructuredFirstPassPercent: Math.round(structuredReaders / samples.length * 10_000) / 100,
      readerSemanticPercent: Math.round(semanticReaders / samples.length * 10_000) / 100,
      readerRegisterPercent: Math.round(registerMatches / samples.length * 10_000) / 100,
      readerReferenceConfidencePercent: Math.round(confidenceMatches / samples.length * 10_000) / 100,
      wrongHighImpactReferentPercent: Math.round(wrongReferents / samples.length * 10_000) / 100,
      falseBackfirePercent: Math.round(falseBackfires / samples.length * 10_000) / 100,
      fullPathFirstPassPercent: Math.round(validAll / samples.length * 10_000) / 100,
      authoritativeReactionP95Milliseconds: percentile(reactions, 0.95),
      validatedActorP95Milliseconds: percentile(validatedActors, 0.95),
    },
    thresholds: {
      readerFirstPass: structuredReaders / samples.length >= 0.95,
      wrongHighImpactReferents: wrongReferents / samples.length < 0.01,
      falseBackfires: falseBackfires / samples.length < 0.01,
      authoritativeReactionP95: (percentile(reactions, 0.95) ?? Infinity) <= 3_000,
      validatedActorP95: (percentile(validatedActors, 0.95) ?? Infinity) <= 12_000,
      baselineHardwareVerified: false,
    },
    limitations: ['Development evidence only. This host is not either locked 16 GB baseline. Renderer FPS is not measured.'],
    samples,
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`SI_WORLD_VERBAL_MISSION_SPIKE ${JSON.stringify(report.measurements)}\n`);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
