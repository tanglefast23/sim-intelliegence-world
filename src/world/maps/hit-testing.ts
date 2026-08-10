import type { CompiledMapV2 } from './compiled-v2';
import type { TilePoint } from './schema';
import { tileKey } from './schema';

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

export function worldClickCandidates(
  map: CompiledMapV2,
  actors: Readonly<Record<string, TilePoint>>,
  tile: TilePoint,
): readonly ClickCandidate[] {
  const key = tileKey(tile);
  const candidates: ClickCandidate[] = [{ id: `floor-${key}`, kind: 'floor', tile }];
  for (const [id, actorTile] of Object.entries(actors).sort(([left], [right]) => compareAscii(left, right))) {
    if (tileKey(actorTile) === key) candidates.push({ id, kind: 'npc', tile: actorTile });
  }
  for (const objectId of map.partOwnersByTile.get(key) ?? []) {
    candidates.push({ id: objectId, kind: 'object', tile });
  }
  for (const door of [...map.doorById.values()].sort((left, right) => compareAscii(left.id, right.id))) {
    if (tileKey(door.tile) === key) candidates.push({ id: door.id, kind: 'object', tile });
  }
  return candidates;
}
