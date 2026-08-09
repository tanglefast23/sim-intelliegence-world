import { createReadStream } from 'node:fs';
import { lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, join } from 'node:path';

import { z } from 'zod';

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const RevisionSchema = z.string().regex(/^[a-f0-9]{40}$/u);

const ArtifactSchema = z
  .object({
    fileName: z.string().min(1).max(160).refine((value) => basename(value) === value),
    platform: z.enum(['darwin-arm64', 'darwin-x64', 'win32-x64']),
    sha256: Sha256Schema,
    sizeBytes: z.number().int().positive(),
  })
  .strict();

export const ModelManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    generatedAt: z.string().datetime(),
    llamaCpp: z
      .object({
        revision: RevisionSchema,
        buildNumber: z.number().int().positive(),
        sourceUrl: z.string().url(),
        license: z.literal('MIT'),
        licenseUrl: z.string().url(),
        licenseArtifact: ArtifactSchema.omit({ platform: true }),
        supportCommits: z.array(RevisionSchema).min(1),
        buildFlags: z.array(z.string().min(1).max(120)).min(1),
        artifacts: z.array(ArtifactSchema).min(1),
        parentGuards: z.array(ArtifactSchema).min(1),
      })
      .strict(),
    models: z
      .array(
        z
          .object({
            id: z.enum(['qwen3.5-9b', 'qwen3.5-4b']),
            role: z.enum(['primary', 'fallback']),
            repository: z.enum(['Qwen/Qwen3.5-9B', 'Qwen/Qwen3.5-4B']),
            revision: RevisionSchema,
            sourceUrl: z.string().url(),
            license: z.literal('Apache-2.0'),
            licenseUrl: z.string().url(),
            licenseArtifact: ArtifactSchema.omit({ platform: true }),
            format: z.literal('GGUF'),
            quantization: z.literal('Q4_K_M'),
            contextSize: z.literal(8_192),
            conversionScriptRevision: RevisionSchema,
            artifact: ArtifactSchema.omit({ platform: true }),
          })
          .strict(),
      )
      .length(2),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.models.map((model) => model.id)).size !== value.models.length) {
      context.addIssue({ code: 'custom', message: 'Model IDs must be unique.', path: ['models'] });
    }
    if (value.models.filter((model) => model.role === 'primary').length !== 1) {
      context.addIssue({ code: 'custom', message: 'Manifest must have one primary model.', path: ['models'] });
    }
    if (value.models.filter((model) => model.role === 'fallback').length !== 1) {
      context.addIssue({ code: 'custom', message: 'Manifest must have one fallback model.', path: ['models'] });
    }
    for (const [index, model] of value.models.entries()) {
      const expected = model.id === 'qwen3.5-9b'
        ? { repository: 'Qwen/Qwen3.5-9B', role: 'primary' }
        : { repository: 'Qwen/Qwen3.5-4B', role: 'fallback' };
      if (model.repository !== expected.repository || model.role !== expected.role) {
        context.addIssue({
          code: 'custom',
          message: 'Model ID, repository, and role do not match.',
          path: ['models', index],
        });
      }
    }
  });

export type ModelManifest = z.infer<typeof ModelManifestSchema>;

export const RuntimeBundleManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    generatedAt: z.string().datetime(),
    llamaCppRevision: RevisionSchema,
    model: z
      .object({
        id: z.enum(['qwen3.5-9b', 'qwen3.5-4b']),
        repository: z.enum(['Qwen/Qwen3.5-9B', 'Qwen/Qwen3.5-4B']),
        revision: RevisionSchema,
        license: z.literal('Apache-2.0'),
        licenseArtifact: ArtifactSchema.omit({ platform: true }),
        artifact: ArtifactSchema.omit({ platform: true }),
      })
      .strict(),
    server: ArtifactSchema.omit({ platform: true }),
    serverLicense: ArtifactSchema.omit({ platform: true }),
    parentGuard: ArtifactSchema.omit({ platform: true }),
  })
  .strict()
  .superRefine((value, context) => {
    const expectedRepository = value.model.id === 'qwen3.5-9b'
      ? 'Qwen/Qwen3.5-9B'
      : 'Qwen/Qwen3.5-4B';
    if (value.model.repository !== expectedRepository) {
      context.addIssue({
        code: 'custom',
        message: 'Runtime model ID and repository do not match.',
        path: ['model', 'repository'],
      });
    }
  });

export type RuntimeBundleManifest = z.infer<typeof RuntimeBundleManifestSchema>;

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

export async function verifyArtifact(
  artifactRoot: string,
  artifact: Readonly<{ fileName: string; sha256: string; sizeBytes: number }>,
): Promise<string> {
  if (basename(artifact.fileName) !== artifact.fileName) {
    throw new Error('Artifact file name must not contain a path.');
  }
  const filePath = join(artifactRoot, artifact.fileName);
  const fileStats = await lstat(filePath);
  if (fileStats.isSymbolicLink() || !fileStats.isFile() || fileStats.size !== artifact.sizeBytes) {
    throw new Error(`Artifact size does not match the manifest: ${artifact.fileName}`);
  }
  const digest = await sha256File(filePath);
  if (digest !== artifact.sha256) {
    throw new Error(`Artifact hash does not match the manifest: ${artifact.fileName}`);
  }
  return filePath;
}
