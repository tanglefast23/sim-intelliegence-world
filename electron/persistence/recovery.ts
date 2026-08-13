import { lstat, readFile, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';

import type { SaveSlotId } from '../../src/application/effects/PersistencePort';
import {
  CONTENT_VERSION,
  MODEL_CONTRACT_VERSION,
  PROMPT_VERSION,
} from '../../src/domain/state/schema';
import { ENGINE_VERSION } from '../../src/domain/version';
import { parseSupportedSaveEnvelope, type SupportedSaveEnvelope } from './save-format';

export type SaveCandidateSource = 'main' | 'temporary' | 'backup' | 'autosave';

export type ValidSaveCandidate = Readonly<{
  path: string;
  source: SaveCandidateSource;
  envelope: SupportedSaveEnvelope;
}>;

export type InvalidSaveCandidate = Readonly<{
  classification: 'corrupt' | 'incompatible';
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
      return { classification: 'corrupt', path, reason: 'Candidate is not a regular file.' };
    }
    if (stats.size > 8 * 1_024 * 1_024) {
      return { classification: 'corrupt', path, reason: 'Candidate exceeds the save size limit.' };
    }
    const parsed = JSON.parse(await readFile(path, 'utf8')) as unknown;
    if (typeof parsed === 'object' && parsed !== null && 'formatVersion' in parsed && parsed.formatVersion !== 1) {
      return { classification: 'incompatible', path, reason: 'Candidate uses an incompatible envelope format.' };
    }
    if (typeof parsed === 'object' && parsed !== null && 'state' in parsed &&
      typeof parsed.state === 'object' && parsed.state !== null) {
      const state = parsed.state as Readonly<Record<string, unknown>>;
      const incompatible = ![5, 6, 7].includes(state.schemaVersion as number) ||
        state.engineVersion !== ENGINE_VERSION ||
        state.contentVersion !== CONTENT_VERSION ||
        state.promptVersion !== PROMPT_VERSION ||
        state.modelContractVersion !== MODEL_CONTRACT_VERSION;
      if (incompatible) {
        return { classification: 'incompatible', path, reason: 'Candidate uses an incompatible state or content version.' };
      }
    }
    const envelope = parseSupportedSaveEnvelope(parsed);
    if (envelope.slotId !== expectedSlotId) {
      return { classification: 'corrupt', path, reason: 'Candidate slot ID does not match its directory.' };
    }
    return { path, source, envelope };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    return { classification: 'corrupt', path, reason: error instanceof Error ? error.message : String(error) };
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
