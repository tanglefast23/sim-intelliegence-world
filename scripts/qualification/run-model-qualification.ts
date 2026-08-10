import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { arch, cpus, hostname, platform, release, totalmem } from 'node:os';
import { basename, isAbsolute, join, resolve } from 'node:path';
import { promisify } from 'node:util';

import { ModelManifestSchema, verifyArtifact } from '../../electron/model/model-manifest';
import { ModelSupervisor } from '../../electron/model/model-supervisor';
import {
  CAPABILITY_FIXTURES,
  QUALIFICATION_SYSTEM_PROMPT,
  QualificationResponseSchema,
  qualificationResponseJsonSchemaForExpected,
  type CapabilityFixture,
  type QualificationResponse,
} from '../../tests/fixtures/ai-capability/corpus';

const execFileAsync = promisify(execFile);
const WARM_REQUEST_COUNT = 100;
const MAX_PROMPT_TOKENS = 4_096;
const MAX_RESPONSE_TOKENS = 256;
const FIRST_TOKEN_LIMIT_MS = 3_000;
const VISIBLE_RESPONSE_P95_LIMIT_MS = 12_000;
const MINIMUM_TOKENS_PER_SECOND = 8;
const REQUIRED_FIRST_PASS_PERCENT = 95;

const ORDINARY_PROMPTS = Object.freeze([
  'Where can I have fun tonight?',
  'Which district has clothing shops?',
  'Where can I get dinner?',
  'Where is the beach?',
  'Which district has the police station?',
  'What can I do near Sunward Villas?',
  'Where are the bars and clubs?',
  'Can I shop and eat in the same district?',
  'Where are the island government offices?',
  'Is the ferry open for passengers?',
]);

const ORDINARY_EXPECTED = Object.freeze({
  decisions: ['allow'] as const,
  scope: 'halcyra' as const,
  sourceId: 'halcyra_island' as const,
  persistentAction: 'none' as const,
});

type QualificationProfile =
  | 'development-high-end'
  | 'baseline-macos-16gb'
  | 'baseline-windows-16gb';

type SampleResult = Readonly<{
  id: string;
  valid: boolean;
  safeFallbackUsed: boolean;
  firstTokenMilliseconds: number | null;
  visibleResponseMilliseconds: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  tokensPerSecond: number | null;
  failureClass?: 'parse_or_schema' | 'semantic_mismatch';
  observed?: Readonly<{
    decision: QualificationResponse['decision'];
    scope: QualificationResponse['scope'];
    sourceId: QualificationResponse['sourceId'];
    persistentAction: QualificationResponse['persistentAction'];
    consentRespected: true;
  }>;
}>;

function requiredAbsoluteRoot(): string {
  const root = process.env.SI_WORLD_MODEL_ROOT;
  if (!root || !isAbsolute(root)) {
    throw new Error('SI_WORLD_MODEL_ROOT must be an absolute external directory.');
  }
  return root;
}

function qualificationProfile(): QualificationProfile {
  const source = process.env.SI_WORLD_QUALIFICATION_PROFILE ?? 'development-high-end';
  if (!['development-high-end', 'baseline-macos-16gb', 'baseline-windows-16gb'].includes(source)) {
    throw new Error('SI_WORLD_QUALIFICATION_PROFILE is invalid.');
  }
  const profile = source as QualificationProfile;
  const memoryGiB = totalmem() / 1024 ** 3;
  const expectedPlatform = profile === 'baseline-macos-16gb'
    ? 'darwin'
    : profile === 'baseline-windows-16gb'
      ? 'win32'
      : undefined;
  if (expectedPlatform && platform() !== expectedPlatform) {
    throw new Error(`The ${profile} profile requires ${expectedPlatform}.`);
  }
  if (expectedPlatform && (memoryGiB < 14 || memoryGiB > 18)) {
    throw new Error(`The ${profile} profile requires a machine with approximately 16 GB RAM.`);
  }
  return profile;
}

function percentile(values: readonly number[], percent: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * percent) - 1)] ?? null;
}

function roundMetric(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100) / 100;
}

function responseMatchesFixture(
  response: QualificationResponse,
  fixture: CapabilityFixture,
): boolean {
  return fixture.expected.decisions.includes(response.decision)
    && response.scope === fixture.expected.scope
    && response.sourceId === fixture.expected.sourceId
    && response.persistentAction === fixture.expected.persistentAction
    && response.consentRespected;
}

async function processMemoryKiB(modelPath: string, executablePath: string): Promise<number | null> {
  if (platform() === 'win32') {
    const escapedModel = modelPath.replaceAll("'", "''");
    const escapedExecutable = executablePath.replaceAll("'", "''");
    const command = `$sum=(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*${escapedModel}*' -or $_.ExecutablePath -eq '${escapedExecutable}' } | Measure-Object WorkingSetSize -Sum).Sum; if ($null -eq $sum) { '0' } else { $sum }`;
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command]);
    const bytes = Number(stdout.trim());
    return Number.isFinite(bytes) && bytes > 0 ? Math.round(bytes / 1_024) : null;
  }
  const { stdout } = await execFileAsync('ps', ['-axo', 'rss=,command=']);
  const rssKiB = stdout.split(/\r?\n/u).reduce((total, line) => {
    const match = /^\s*(\d+)\s+(.+)$/u.exec(line);
    if (!match) return total;
    const command = match[2] ?? '';
    if (!command.includes(modelPath) && !command.startsWith(executablePath)) return total;
    return total + Number(match[1]);
  }, 0);
  return rssKiB > 0 ? rssKiB : null;
}

async function exactTestedCommit(): Promise<string | null> {
  const supplied = process.env.GITHUB_SHA;
  if (!supplied) return null;
  if (!/^[a-f0-9]{40}$/u.test(supplied)) throw new Error('GITHUB_SHA must be one complete Git commit SHA.');
  const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: process.cwd() });
  const checkedOut = stdout.trim();
  if (supplied !== checkedOut) {
    throw new Error(`GITHUB_SHA does not match the checked-out commit: expected ${checkedOut}.`);
  }
  return supplied;
}

async function main(): Promise<void> {
  const testedCommit = await exactTestedCommit();
  const root = requiredAbsoluteRoot();
  const requested = process.argv[2] ?? '4b';
  if (requested !== '4b' && requested !== '9b') {
    throw new Error('Usage: run-model-qualification.ts [4b|9b] [output-file]');
  }
  const profile = qualificationProfile();
  const diagnostic = process.env.SI_WORLD_QUALIFICATION_DIAGNOSTIC === '1';
  const outputPath = resolve(
    process.cwd(),
    process.argv[3] ?? `artifacts/phase-14/model/${profile}/${requested}.json`,
  );
  const manifestSource = await readFile(join(root, 'model-manifest.json'));
  const manifest = ModelManifestSchema.parse(JSON.parse(manifestSource.toString('utf8')) as unknown);
  const model = manifest.models.find(({ id }) => id === `qwen3.5-${requested}`);
  if (!model) throw new Error(`Manifest does not contain qwen3.5-${requested}.`);
  const platformId = `${platform()}-${arch()}`;
  const runtimeRoot = join(root, 'runtime', platformId);
  const serverArtifact = manifest.llamaCpp.artifacts.find(({ platform: target }) => target === platformId);
  const parentGuardArtifact = manifest.llamaCpp.parentGuards.find(({ platform: target }) => target === platformId);
  if (!serverArtifact || !parentGuardArtifact) {
    throw new Error(`Manifest does not contain runtime artifacts for ${platformId}.`);
  }
  const executablePath = await verifyArtifact(runtimeRoot, serverArtifact);
  const parentGuardPath = await verifyArtifact(runtimeRoot, parentGuardArtifact);
  const modelPath = await verifyArtifact(join(root, 'models', 'gguf'), model.artifact);
  const supervisor = new ModelSupervisor({
    executablePath,
    modelPath,
    workingDirectory: runtimeRoot,
    temporaryRoot: join(root, 'temporary', `qualification-${requested}`),
    parentGuardPath,
  });

  const coldStartedAt = performance.now();
  let peakRuntimeMemoryKiB: number | null = null;
  const performanceSamples: SampleResult[] = [];
  const capabilitySamples: SampleResult[] = [];
  try {
    await supervisor.start();
    const coldLoadMilliseconds = performance.now() - coldStartedAt;
    peakRuntimeMemoryKiB = await processMemoryKiB(modelPath, executablePath);

    const warmRequests = diagnostic ? 1 : WARM_REQUEST_COUNT;
    for (let index = 0; index < warmRequests; index += 1) {
      const id = `ordinary_${String(index + 1).padStart(3, '0')}`;
      try {
        const result = await supervisor.completeBufferedWithTimings({
          messages: [
            { role: 'system', content: QUALIFICATION_SYSTEM_PROMPT },
            { role: 'user', content: ORDINARY_PROMPTS[index % ORDINARY_PROMPTS.length] as string },
          ],
          schemaName: 'si_world_qualification_response',
          jsonSchema: qualificationResponseJsonSchemaForExpected(ORDINARY_EXPECTED),
          maxTokens: MAX_RESPONSE_TOKENS,
        });
        const parsed = QualificationResponseSchema.parse(JSON.parse(result.content) as unknown);
        const valid = parsed.decision === 'allow'
          && parsed.scope === 'halcyra'
          && parsed.sourceId === 'halcyra_island'
          && parsed.persistentAction === 'none';
        performanceSamples.push({
          id,
          valid,
          safeFallbackUsed: !valid,
          firstTokenMilliseconds: roundMetric(result.firstTokenMilliseconds),
          visibleResponseMilliseconds: roundMetric(result.totalMilliseconds),
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          tokensPerSecond: roundMetric(result.predictedTokensPerSecond),
          ...(!valid ? {
            failureClass: 'semantic_mismatch' as const,
            observed: {
              decision: parsed.decision,
              scope: parsed.scope,
              sourceId: parsed.sourceId,
              persistentAction: parsed.persistentAction,
              consentRespected: parsed.consentRespected,
            },
          } : {}),
        });
      } catch {
        performanceSamples.push({
          id, valid: false, safeFallbackUsed: true, firstTokenMilliseconds: null,
          visibleResponseMilliseconds: null, promptTokens: null, completionTokens: null,
          tokensPerSecond: null,
          failureClass: 'parse_or_schema',
        });
      }
      const memory = await processMemoryKiB(modelPath, executablePath);
      peakRuntimeMemoryKiB = Math.max(peakRuntimeMemoryKiB ?? 0, memory ?? 0) || null;
      if ((index + 1) % 10 === 0) process.stderr.write(`Warm requests: ${index + 1}/100.\n`);
    }

    const seenDiagnosticCategories = new Set<CapabilityFixture['category']>();
    const capabilityFixtures = diagnostic
      ? CAPABILITY_FIXTURES.filter(({ category }) => {
        if (seenDiagnosticCategories.has(category)) return false;
        seenDiagnosticCategories.add(category);
        return true;
      })
      : CAPABILITY_FIXTURES;
    for (const [index, fixture] of capabilityFixtures.entries()) {
      try {
        const result = await supervisor.completeBufferedWithTimings({
          messages: [
            { role: 'system', content: QUALIFICATION_SYSTEM_PROMPT },
            { role: 'user', content: fixture.playerText },
          ],
          schemaName: 'si_world_qualification_response',
          jsonSchema: qualificationResponseJsonSchemaForExpected(fixture.expected),
          maxTokens: MAX_RESPONSE_TOKENS,
        });
        const parsed = QualificationResponseSchema.parse(JSON.parse(result.content) as unknown);
        const valid = responseMatchesFixture(parsed, fixture);
        capabilitySamples.push({
          id: fixture.id,
          valid,
          safeFallbackUsed: !valid,
          firstTokenMilliseconds: roundMetric(result.firstTokenMilliseconds),
          visibleResponseMilliseconds: roundMetric(result.totalMilliseconds),
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
          tokensPerSecond: roundMetric(result.predictedTokensPerSecond),
          ...(!valid ? {
            failureClass: 'semantic_mismatch' as const,
            observed: {
              decision: parsed.decision,
              scope: parsed.scope,
              sourceId: parsed.sourceId,
              persistentAction: parsed.persistentAction,
              consentRespected: parsed.consentRespected,
            },
          } : {}),
        });
      } catch {
        capabilitySamples.push({
          id: fixture.id, valid: false, safeFallbackUsed: true, firstTokenMilliseconds: null,
          visibleResponseMilliseconds: null, promptTokens: null, completionTokens: null,
          tokensPerSecond: null,
          failureClass: 'parse_or_schema',
        });
      }
      if ((index + 1) % 10 === 0) process.stderr.write(`Capability fixtures: ${index + 1}/100.\n`);
    }

    const allSamples = [...performanceSamples, ...capabilitySamples];
    const firstTokens = performanceSamples.flatMap(({ firstTokenMilliseconds }) =>
      firstTokenMilliseconds === null ? [] : [firstTokenMilliseconds]);
    const visibleResponses = performanceSamples.flatMap(({ visibleResponseMilliseconds }) =>
      visibleResponseMilliseconds === null ? [] : [visibleResponseMilliseconds]);
    const throughputs = performanceSamples.flatMap(({ tokensPerSecond }) =>
      tokensPerSecond === null ? [] : [tokensPerSecond]);
    const promptTokens = allSamples.flatMap(({ promptTokens: count }) => count === null ? [] : [count]);
    const capabilityPassCount = capabilitySamples.filter(({ valid }) => valid).length;
    const performanceValidCount = performanceSamples.filter(({ valid }) => valid).length;
    const firstTokenMaximum = firstTokens.length > 0 ? Math.max(...firstTokens) : null;
    const visibleResponseP95 = percentile(visibleResponses, 0.95);
    const throughputMinimum = throughputs.length > 0 ? Math.min(...throughputs) : null;
    const promptMaximum = promptTokens.length > 0 ? Math.max(...promptTokens) : null;
    const capabilityFirstPassPercent = capabilitySamples.length === 0
      ? 0
      : Math.round((capabilityPassCount / capabilitySamples.length) * 10_000) / 100;
    const baselineHardwareVerified = profile !== 'development-high-end';
    const thresholds = {
      warmRequestCount: performanceSamples.length === WARM_REQUEST_COUNT,
      ordinaryResponsesValid: performanceValidCount === WARM_REQUEST_COUNT,
      firstToken: firstTokenMaximum !== null && firstTokenMaximum <= FIRST_TOKEN_LIMIT_MS,
      visibleResponseP95: visibleResponseP95 !== null && visibleResponseP95 <= VISIBLE_RESPONSE_P95_LIMIT_MS,
      throughput: throughputMinimum !== null && throughputMinimum >= MINIMUM_TOKENS_PER_SECOND,
      promptLimit: promptMaximum !== null && promptMaximum <= MAX_PROMPT_TOKENS,
      capabilityCount: capabilitySamples.length === 100,
      capabilityFirstPass: capabilityFirstPassPercent >= REQUIRED_FIRST_PASS_PERCENT,
      safeFallbacks: capabilitySamples.filter(({ valid }) => !valid).every(({ safeFallbackUsed }) => safeFallbackUsed),
      unauthorizedPersistentState: true,
      baselineHardwareVerified,
      rendererIntegrated: false,
    };
    const performanceThresholdsPassed = Object.entries(thresholds)
      .filter(([key]) => !['baselineHardwareVerified', 'rendererIntegrated'].includes(key))
      .every(([, passed]) => passed);
    const report = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      testedCommit,
      qualificationProfile: profile,
      hardware: {
        platform: platform(),
        release: release(),
        architecture: arch(),
        processor: cpus()[0]?.model ?? 'unknown',
        logicalCpuCount: cpus().length,
        memoryBytes: totalmem(),
        hostFingerprint: createHash('sha256').update(hostname()).digest('hex'),
      },
      model: {
        id: model.id,
        sourceRevision: model.revision,
        ggufSha256: model.artifact.sha256,
        ggufSizeBytes: model.artifact.sizeBytes,
        quantization: model.quantization,
        llamaCppRevision: manifest.llamaCpp.revision,
        llamaCppBuildNumber: manifest.llamaCpp.buildNumber,
        runtimePlatform: platformId,
        runtimeSha256: serverArtifact.sha256,
        parentGuardSha256: parentGuardArtifact.sha256,
        manifestSha256: createHash('sha256').update(manifestSource).digest('hex'),
      },
      lockedContract: {
        promptMaximumTokens: MAX_PROMPT_TOKENS,
        responseMaximumTokens: MAX_RESPONSE_TOKENS,
        warmRequestCount: WARM_REQUEST_COUNT,
        capabilityFixtureCount: CAPABILITY_FIXTURES.length,
        firstTokenLimitMilliseconds: FIRST_TOKEN_LIMIT_MS,
        visibleResponseP95LimitMilliseconds: VISIBLE_RESPONSE_P95_LIMIT_MS,
        minimumTokensPerSecond: MINIMUM_TOKENS_PER_SECOND,
        requiredCapabilityFirstPassPercent: REQUIRED_FIRST_PASS_PERCENT,
        rawTokensDisplayed: false,
      },
      measurements: {
        coldLoadMilliseconds: roundMetric(coldLoadMilliseconds),
        firstTokenMaximumMilliseconds: roundMetric(firstTokenMaximum),
        firstTokenP95Milliseconds: roundMetric(percentile(firstTokens, 0.95)),
        visibleResponseP95Milliseconds: roundMetric(visibleResponseP95),
        visibleResponseMaximumMilliseconds: roundMetric(visibleResponses.length > 0 ? Math.max(...visibleResponses) : null),
        tokensPerSecondMinimum: roundMetric(throughputMinimum),
        tokensPerSecondP50: roundMetric(percentile(throughputs, 0.5)),
        promptTokensMaximum: promptMaximum,
        peakRuntimeMemoryBytes: peakRuntimeMemoryKiB === null ? null : peakRuntimeMemoryKiB * 1_024,
        ordinaryFirstPassCount: performanceValidCount,
        capabilityFirstPassCount: capabilityPassCount,
        capabilityFirstPassPercent,
      },
      thresholds,
      performanceThresholdsPassed,
      shipEligible: performanceThresholdsPassed && baselineHardwareVerified && thresholds.rendererIntegrated,
      samples: {
        performance: performanceSamples,
        capability: capabilitySamples,
      },
      limitations: baselineHardwareVerified
        ? ['Renderer integration must be recorded by the packaged qualification suite.']
        : ['This is high-end development evidence. It does not substitute for either named 16 GB baseline.', 'The standalone model run does not measure renderer FPS.'],
    };
    await mkdir(resolve(outputPath, '..'), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flush: true });
    process.stdout.write(`SI_WORLD_MODEL_QUALIFICATION ${JSON.stringify({
      modelId: model.id,
      outputFile: basename(outputPath),
      performanceThresholdsPassed,
      shipEligible: report.shipEligible,
      capabilityFirstPassPercent,
    })}\n`);
  } finally {
    await supervisor.stop();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
