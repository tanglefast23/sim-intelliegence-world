import { access, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import type { App } from 'electron';

import type { InferenceCompletionRequest, InferencePort } from '../../src/application/effects/InferencePort';
import { RuntimeBundleManifestSchema, verifyArtifact } from './model-manifest';
import { ModelSupervisor } from './model-supervisor';

export class BundledConversationInference implements InferencePort {
  #supervisorPromise: Promise<ModelSupervisor> | undefined;

  constructor(private readonly app: App, private readonly resourcesPath: string) {}

  async complete(request: InferenceCompletionRequest): Promise<string> {
    const supervisor = await this.#getSupervisor();
    await supervisor.start();
    return supervisor.complete(request);
  }

  async stop(): Promise<void> {
    if (this.#supervisorPromise) {
      const supervisor = await this.#supervisorPromise.catch(() => undefined);
      await supervisor?.stop();
    }
  }

  async #getSupervisor(): Promise<ModelSupervisor> {
    if (!this.#supervisorPromise) this.#supervisorPromise = this.#createSupervisor();
    return this.#supervisorPromise;
  }

  async #createSupervisor(): Promise<ModelSupervisor> {
    const bundleRoot = join(this.resourcesPath, 'model-runtime');
    const manifestPath = join(bundleRoot, 'runtime-manifest.json');
    await access(manifestPath).catch(() => {
      throw new Error('Bundled local model is unavailable.');
    });
    if ((await stat(manifestPath)).size > 128 * 1_024) throw new Error('Runtime model manifest exceeds the byte limit.');
    const manifest = RuntimeBundleManifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')) as unknown);
    const [executablePath, modelPath, parentGuardPath] = await Promise.all([
      verifyArtifact(bundleRoot, manifest.server),
      verifyArtifact(bundleRoot, manifest.model.artifact),
      verifyArtifact(bundleRoot, manifest.parentGuard),
      verifyArtifact(bundleRoot, manifest.serverLicense),
      verifyArtifact(bundleRoot, manifest.model.licenseArtifact),
    ]);
    const supervisor = new ModelSupervisor({
      executablePath,
      modelPath,
      parentGuardPath,
      workingDirectory: bundleRoot,
      temporaryRoot: join(this.app.getPath('userData'), 'si-world', 'model-runtime'),
    });
    return supervisor;
  }
}
