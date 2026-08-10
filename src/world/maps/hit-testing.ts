import type { TilePoint } from './schema';

export type ClickTargetKind = 'ui' | 'npc' | 'object' | 'interaction' | 'floor';
export type ClickCandidate = Readonly<{
  id: string;
  kind: ClickTargetKind;
  tile?: TilePoint;
}>;

const PRIORITY: Readonly<Record<ClickTargetKind, number>> = {
  ui: 0,
  npc: 1,
  object: 2,
  interaction: 3,
  floor: 4,
};

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function resolveClickTarget(candidates: readonly ClickCandidate[]): ClickCandidate | undefined {
  return [...candidates].sort((left, right) => (
    PRIORITY[left.kind] - PRIORITY[right.kind] || compareAscii(left.id, right.id)
  ))[0];
}
