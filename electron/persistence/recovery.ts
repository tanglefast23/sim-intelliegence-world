import { lstat, readFile, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';

import type { SaveSlotId } from '../../src/application/effects/PersistencePort';
import { parseSaveEnvelope, type SaveEnvelope } from './save-format';

export type SaveCandidateSource = 'main' | 'temporary' | 'backup' | 'autosave';

export type ValidSaveCandidate = Readonly<{
  path: string;
  source: SaveCandidateSource;
  envelope: SaveEnvelope;
}>;

export type InvalidSaveCandidate = Readonly<{
  path: string;
  reason: string;
}>;

export type RecoveryResult = Readonly<{
  selected?: ValidSaveCandidate;
  validCandidates: readonly ValidSaveCandidate[];
  invalidCandidates: readonly InvalidSaveCandidate[];
}>;

const SOURCE_PRIORITY: Readonly<Record<SaveCandidateSource, number>> = {
  main: 0,
  autosave: 1,
  temporary: 2,
  backup: 3,
};

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

async function namesUnder(path: string): Promise<string[]> {
  try {
    return (await readdir(path)).sort(compareAscii);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

export async function inspectSaveCandidate(
  path: string,
  source: SaveCandidateSource,
  expectedSlotId: SaveSlotId,
): Promise<ValidSaveCandidate | InvalidSaveCandidate | undefined> {
  try {
    const stats = await lstat(path);
    if (stats.isSymbolicLink() || !stats.isFile()) {
      return { path, reason: 'Candidate is not a regular file.' };
    }
    if (stats.size > 8 * 1_024 * 1_024) {
      return { path, reason: 'Candidate exceeds the save size limit.' };
    }
    const envelope = parseSaveEnvelope(JSON.parse(await readFile(path, 'utf8')) as unknown);
    if (envelope.slotId !== expectedSlotId) {
      return { path, reason: 'Candidate slot ID does not match its directory.' };
    }
    return { path, source, envelope };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    return { path, reason: error instanceof Error ? error.message : String(error) };
  }
}

export async function recoverSlot(slotPath: string, slotId: SaveSlotId): Promise<RecoveryResult> {
  const descriptors: Array<Readonly<{ path: string; source: SaveCandidateSource }>> = [
    { path: join(slotPath, 'state.json'), source: 'main' },
    { path: join(slotPath, 'state.json.bak'), source: 'backup' },
  ];
  for (const name of await namesUnder(slotPath)) {
    if (name.startsWith('state.json.tmp-')) {
      descriptors.push({ path: join(slotPath, name), source: 'temporary' });
    }
  }
  const autosavePath = join(slotPath, 'autosaves');
  for (const name of await namesUnder(autosavePath)) {
    if (/^autosave-[0-9]{12}\.json$/u.test(name)) {
      descriptors.push({ path: join(autosavePath, name), source: 'autosave' });
    }
  }

  const inspected = await Promise.all(
    descriptors.map(({ path, source }) => inspectSaveCandidate(path, source, slotId)),
  );
  const validCandidates = inspected
    .filter((candidate): candidate is ValidSaveCandidate => candidate !== undefined && 'envelope' in candidate)
    .sort((left, right) => (
      right.envelope.saveGeneration - left.envelope.saveGeneration ||
      SOURCE_PRIORITY[left.source] - SOURCE_PRIORITY[right.source] ||
      compareAscii(basename(left.path), basename(right.path))
    ));
  const invalidCandidates = inspected
    .filter((candidate): candidate is InvalidSaveCandidate => candidate !== undefined && 'reason' in candidate)
    .sort((left, right) => compareAscii(left.path, right.path));
  return { selected: validCandidates[0], validCandidates, invalidCandidates };
}
