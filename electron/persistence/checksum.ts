import { createHash } from 'node:crypto';

import { parseWorldState, type WorldState } from '../../src/domain/state/schema';

export function canonicalStateJson(state: WorldState): string {
  return JSON.stringify(parseWorldState(state));
}

export function checksumState(state: WorldState): string {
  return checksumUtf8(canonicalStateJson(state));
}

export function checksumUtf8(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
