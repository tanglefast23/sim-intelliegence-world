import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { resolveTestedCommit } from './tested-commit';

export type EvidenceSource = Readonly<{
  baseCommit: string;
  sourceSha256: string;
  sourcePaths: readonly string[];
}>;

export function resolveEvidenceSource(paths: readonly string[]): EvidenceSource {
  const sourcePaths = [...new Set(paths)].sort();
  const hash = createHash('sha256');
  for (const path of sourcePaths) {
    const bytes = readFileSync(resolve(process.cwd(), path));
    hash.update(`${path}\0${bytes.byteLength}\0`, 'utf8');
    hash.update(bytes);
  }
  return {
    baseCommit: resolveTestedCommit(),
    sourceSha256: hash.digest('hex'),
    sourcePaths,
  };
}
