import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import type { App } from 'electron';

import {
  authoredNoChangeResponse,
  parseSpikeResponseJson,
  spikeResponseJsonSchema,
} from '../../src/ai/schemas/spike-response';
import { RuntimeBundleManifestSchema, verifyArtifact } from './model-manifest';
import { ModelSupervisor } from './model-supervisor';

export type ModelSmokeReport = Readonly<{
  modelId: 'qwen3.5-9b' | 'qwen3.5-4b';
  source: 'model';
  attempts: 1 | 2;
  loadingHealthObserved: true;
  responseValidated: true;
  restartCount: 2;
  circuitOpened: true;
  fallbackAfterCircuit: true;
  restartAfterStopRejected: true;
  stoppedCleanly: true;
}>;

async function waitForState(
  supervisor: ModelSupervisor,
  expectedState: 'ready' | 'circuit-open',
): Promise<void> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (supervisor.state === expectedState) {
      return;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
  }
  throw new Error(`Model supervisor did not reach ${expectedState} during the packaged smoke.`);
}

export async function runPackagedModelSmoke(app: App, resourcesPath: string): Promise<ModelSmokeReport> {
  if (!app.isPackaged) {
    throw new Error('The real model smoke must run from a packaged application.');
  }
  const bundleRoot = join(resourcesPath, 'model-runtime');
  const manifestPath = join(bundleRoot, 'runtime-manifest.json');
  if ((await stat(manifestPath)).size > 128 * 1_024) {
    throw new Error('Runtime model manifest exceeds the byte limit.');
  }
  const manifest = RuntimeBundleManifestSchema.parse(
    JSON.parse(await readFile(manifestPath, 'utf8')) as unknown,
  );
  const executablePath = await verifyArtifact(bundleRoot, manifest.server);
  const modelPath = await verifyArtifact(bundleRoot, manifest.model.artifact);
  await verifyArtifact(bundleRoot, manifest.serverLicense);
  await verifyArtifact(bundleRoot, manifest.model.licenseArtifact);
  const parentGuardPath = await verifyArtifact(bundleRoot, manifest.parentGuard);
  const supervisor = new ModelSupervisor({
    executablePath,
    modelPath,
    workingDirectory: bundleRoot,
    temporaryRoot: join(app.getPath('userData'), 'si-world', 'model-runtime'),
    parentGuardPath,
    allowLifecycleFaultInjection: true,
  });

  let attempts: 1 | 2 = 1;
  try {
    await supervisor.start();
    const result = await supervisor.infer({
      messages: [
        {
          role: 'system',
          content: 'Return only the requested JSON. You cannot use tools or change game state.',
        },
        {
          role: 'user',
          content: 'A resident greets the player near the ferry. Use a short, safe greeting.',
        },
      ],
      schemaName: 'si_world_spike_response',
      jsonSchema: spikeResponseJsonSchema,
      parse: parseSpikeResponseJson,
      fallback: authoredNoChangeResponse,
      maxTokens: 128,
    });
    attempts = result.attempts;
    if (result.source !== 'model') {
      throw new Error('The real model failed both constrained response attempts.');
    }
    if (!supervisor.sawLoadingHealth) {
      throw new Error('The packaged runtime did not observe the loading health state.');
    }
    supervisor.killForLifecycleVerification();
    await waitForState(supervisor, 'ready');
    supervisor.killForLifecycleVerification();
    await waitForState(supervisor, 'ready');
    supervisor.killForLifecycleVerification();
    await waitForState(supervisor, 'circuit-open');
    const fallbackResult = await supervisor.infer({
      messages: [],
      schemaName: 'si_world_spike_response',
      jsonSchema: spikeResponseJsonSchema,
      parse: parseSpikeResponseJson,
      fallback: authoredNoChangeResponse,
      maxTokens: 128,
    });
    if (fallbackResult.source !== 'authored-fallback') {
      throw new Error('The packaged circuit breaker did not use the authored fallback.');
    }
  } finally {
    await supervisor.stop();
  }
  if (supervisor.state !== 'stopped') {
    throw new Error('The model supervisor did not reach the stopped state.');
  }
  await supervisor.start().then(
    () => {
      throw new Error('The packaged circuit breaker reset before the next app launch.');
    },
    (error: unknown) => {
      if (!(error instanceof Error) || !error.message.includes('circuit breaker')) {
        throw error;
      }
    },
  );
  return {
    modelId: manifest.model.id,
    source: 'model',
    attempts,
    loadingHealthObserved: true,
    responseValidated: true,
    restartCount: 2,
    circuitOpened: true,
    fallbackAfterCircuit: true,
    restartAfterStopRejected: true,
    stoppedCleanly: true,
  };
}
