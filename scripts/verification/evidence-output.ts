import { isAbsolute, relative, resolve } from 'node:path';

const HISTORICAL_EVIDENCE_ROOTS = [
  'artifacts/phase-04',
  'artifacts/phase-14',
  'artifacts/phase-19',
  'artifacts/phase-22',
  'artifacts/phase-23',
] as const;

function isInside(candidate: string, parent: string): boolean {
  const child = relative(parent, candidate);
  return child === '' || (!child.startsWith('..') && !isAbsolute(child));
}

export type EvidenceOutputOptions = Readonly<{
  defaultRelative?: string;
  required?: boolean;
  allowedFlags?: readonly string[];
  allowedRootPrefixes?: readonly string[];
}>;

export function resolveEvidenceOutputRoot(
  arguments_: readonly string[],
  options: EvidenceOutputOptions,
  repositoryRoot = process.cwd(),
): string {
  let requested: string | undefined;
  const allowedFlags = new Set(options.allowedFlags ?? []);
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index] as string;
    if (argument === '--output-root') {
      const value = arguments_[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--output-root requires one path.');
      if (requested) throw new Error('--output-root can be supplied only once.');
      requested = value;
      index += 1;
    } else if (allowedFlags.has(argument)) {
      continue;
    } else if (argument.startsWith('--')) {
      throw new Error(`Unknown evidence option: ${argument}`);
    } else {
      throw new Error(`Use --output-root before the evidence path: ${argument}`);
    }
  }
  if (!requested && options.required) throw new Error('This command requires --output-root.');
  const selected = requested ?? options.defaultRelative;
  if (!selected) throw new Error('No evidence output root is configured.');
  const resolvedRoot = resolve(repositoryRoot, selected);
  if (resolvedRoot === resolve(repositoryRoot)) throw new Error('Evidence output cannot be the repository root.');
  for (const historical of HISTORICAL_EVIDENCE_ROOTS) {
    if (isInside(resolvedRoot, resolve(repositoryRoot, historical))) {
      throw new Error(`Historical evidence is immutable: ${historical}`);
    }
  }
  if (options.allowedRootPrefixes && !options.allowedRootPrefixes.some((prefix) =>
    isInside(resolvedRoot, resolve(repositoryRoot, prefix)))) {
    throw new Error(`Evidence output must be under ${options.allowedRootPrefixes.join(' or ')}.`);
  }
  return resolvedRoot;
}
