import { createHash } from 'node:crypto';

import { LegacyStateV5Schema, type LegacyStateV5 } from '../../src/domain/state/migrations/v5-to-v6';
import { parseWorldState, type WorldState } from '../../src/domain/state/schema';

export function canonicalStateJson(state: WorldState): string {
  return JSON.stringify(parseWorldState(state));
}

export function checksumState(state: WorldState): string {
  return checksumUtf8(canonicalStateJson(state));
}

export function canonicalLegacyStateV5Json(state: LegacyStateV5): string {
  return JSON.stringify(LegacyStateV5Schema.parse(state));
}

export function checksumLegacyStateV5(state: LegacyStateV5): string {
  return checksumUtf8(canonicalLegacyStateV5Json(state));
}

export function checksumUtf8(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
