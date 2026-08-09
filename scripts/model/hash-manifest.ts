import { createReadStream } from 'node:fs';
import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { isAbsolute, join } from 'node:path';

import {
  ModelManifestSchema,
  RuntimeBundleManifestSchema,
} from '../../electron/model/model-manifest';
import { LLAMA_CPP, MODEL_LICENSE, MODEL_PINS } from './model-pins';

function requireModelRoot(): string {
  const root = process.env.SI_WORLD_MODEL_ROOT;
  if (!root || !isAbsolute(root)) {
    throw new Error('SI_WORLD_MODEL_ROOT must be an absolute external directory.');
  }
  return root;
}

async function inspectArtifact(filePath: string): Promise<Readonly<{ sha256: string; sizeBytes: number }>> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }
  const fileStats = await stat(filePath);
  return { sha256: hash.digest('hex'), sizeBytes: fileStats.size };
}

function platformId(): 'darwin-arm64' | 'darwin-x64' | 'win32-x64' {
  const id = `${process.platform}-${process.arch}`;
  if (!['darwin-arm64', 'darwin-x64', 'win32-x64'].includes(id)) {
    throw new Error(`Unsupported model artifact platform: ${id}`);
  }
  return id as 'darwin-arm64' | 'darwin-x64' | 'win32-x64';
}

async function main(): Promise<void> {
  const root = requireModelRoot();
  const platform = platformId();
  const executableSuffix = process.platform === 'win32' ? '.exe' : '';
  const runtimeRoot = join(root, 'runtime', `${process.platform}-${process.arch}`);
  const serverFileName = `llama-server${executableSuffix}`;
  const serverPath = join(runtimeRoot, serverFileName);
  const server = await inspectArtifact(serverPath);
  const serverLicenseFileName = 'LLAMA-LICENSE';
  const serverLicensePath = join(runtimeRoot, serverLicenseFileName);
  const serverLicense = await inspectArtifact(serverLicensePath);
  const parentGuardFileName = process.platform === 'win32' ? 'llama-parent-guard.exe' : 'llama-parent-guard';
  const parentGuardPath = join(runtimeRoot, parentGuardFileName);
  const parentGuard = await inspectArtifact(parentGuardPath);
  const generatedAt = new Date().toISOString();

  const modelEntries = await Promise.all(
    (['9b', '4b'] as const).map(async (size) => {
      const pin = MODEL_PINS[size];
      const modelPath = join(root, 'models', 'gguf', pin.outputFileName);
      const licenseFileName = `${pin.id}-LICENSE`;
      const licensePath = join(root, 'models', 'gguf', licenseFileName);
      return {
        id: pin.id,
        role: pin.role,
        repository: pin.repository,
        revision: pin.revision,
        sourceUrl: `https://huggingface.co/${pin.repository}/tree/${pin.revision}`,
        license: MODEL_LICENSE.name,
        licenseUrl: MODEL_LICENSE.url,
        licenseArtifact: {
          fileName: licenseFileName,
          ...(await inspectArtifact(licensePath)),
        },
        format: 'GGUF' as const,
        quantization: 'Q4_K_M' as const,
        contextSize: 8_192 as const,
        conversionScriptRevision: LLAMA_CPP.revision,
        artifact: {
          fileName: pin.outputFileName,
          ...(await inspectArtifact(modelPath)),
        },
      };
    }),
  );

  const manifest = ModelManifestSchema.parse({
    schemaVersion: 1,
    generatedAt,
    llamaCpp: {
      revision: LLAMA_CPP.revision,
      buildNumber: LLAMA_CPP.buildNumber,
      sourceUrl: `${LLAMA_CPP.repository.replace(/\.git$/u, '')}/tree/${LLAMA_CPP.revision}`,
      license: 'MIT',
      licenseUrl: 'https://github.com/ggml-org/llama.cpp/blob/master/LICENSE',
      licenseArtifact: { fileName: serverLicenseFileName, ...serverLicense },
      supportCommits: LLAMA_CPP.supportCommits,
      buildFlags: [
        ...LLAMA_CPP.buildFlags,
        ...(process.platform === 'darwin' ? ['-DGGML_METAL=ON'] : []),
      ],
      artifacts: [{ fileName: serverFileName, platform, ...server }],
      parentGuards: [{ fileName: parentGuardFileName, platform, ...parentGuard }],
    },
    models: modelEntries,
  });
  const manifestPath = join(root, 'model-manifest.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flush: true });

  for (const model of manifest.models) {
    const size = model.id.endsWith('4b') ? '4b' : '9b';
    const bundleRoot = join(root, 'bundles', platform, size, 'model-runtime');
    await mkdir(bundleRoot, { recursive: true });
    await copyFile(serverPath, join(bundleRoot, serverFileName));
    await copyFile(serverLicensePath, join(bundleRoot, serverLicenseFileName));
    await copyFile(parentGuardPath, join(bundleRoot, parentGuardFileName));
    await copyFile(join(root, 'models', 'gguf', model.artifact.fileName), join(bundleRoot, model.artifact.fileName));
    await copyFile(join(root, 'models', 'gguf', model.licenseArtifact.fileName), join(bundleRoot, model.licenseArtifact.fileName));
    const bundleManifest = RuntimeBundleManifestSchema.parse({
      schemaVersion: 1,
      generatedAt,
      llamaCppRevision: LLAMA_CPP.revision,
      model: {
        id: model.id,
        repository: model.repository,
        revision: model.revision,
        license: model.license,
        licenseArtifact: model.licenseArtifact,
        artifact: model.artifact,
      },
      server: { fileName: serverFileName, ...server },
      serverLicense: { fileName: serverLicenseFileName, ...serverLicense },
      parentGuard: { fileName: parentGuardFileName, ...parentGuard },
    });
    await writeFile(
      join(bundleRoot, 'runtime-manifest.json'),
      `${JSON.stringify(bundleManifest, null, 2)}\n`,
      { encoding: 'utf8', flush: true },
    );
  }
  process.stdout.write(`${manifestPath}\n`);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
