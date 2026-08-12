export const WORLD_DEPTH = Object.freeze({
  floor: 10,
  prop: 20,
  shadow: 30,
  character: 40,
  effect: 50,
  wall: 60,
  roof: 70,
});

export type DepthItem = Readonly<{ id: string; layer: number; tileY: number }>;
export type GroundedDepthItem = Readonly<{ groundY: number; id: string; kind: 'character' | 'prop' }>;

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function compareDepth(left: DepthItem, right: DepthItem): number {
  return left.layer - right.layer || left.tileY - right.tileY || compareAscii(left.id, right.id);
}

export function compareGroundedDepth(left: GroundedDepthItem, right: GroundedDepthItem): number {
  return left.groundY - right.groundY ||
    (left.kind === right.kind ? compareAscii(left.id, right.id) : left.kind === 'character' ? -1 : 1);
}
