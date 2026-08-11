import type { MaterialRecipe } from './recipes';

export type TransitionTopology =
  | 'none'
  | 'outer-corner'
  | 'straight'
  | 'strip'
  | 'saddle'
  | 'inner-corner'
  | 'island';

export type MaterialTransition = Readonly<{
  tileX: number;
  tileY: number;
  cornerMask: number;
  edgeMask: number;
  topology: TransitionTopology;
  ownerMaterialId: string;
  neighborMaterialIds: readonly string[];
}>;

export function transitionCornerMask(corners: readonly [boolean, boolean, boolean, boolean]): number {
  return corners.reduce((mask, active, index) => active ? mask | (1 << index) : mask, 0);
}

export function transitionTopology(mask: number, edgeMask = 0): TransitionTopology {
  if (!Number.isInteger(mask) || mask < 0 || mask > 15) throw new Error('Transition mask must be from 0 through 15.');
  if (!Number.isInteger(edgeMask) || edgeMask < 0 || edgeMask > 15) throw new Error('Transition edge mask must be from 0 through 15.');
  if (mask === 0) return 'none';
  if (edgeMask === 5 || edgeMask === 10) return 'strip';
  if (edgeMask === 15) return 'island';
  if (mask === 15) return 'island';
  const bits = [1, 2, 4, 8].filter((bit) => (mask & bit) !== 0).length;
  if (bits === 1) return 'outer-corner';
  if (bits === 3) return 'inner-corner';
  if (mask === 5 || mask === 10) return 'saddle';
  return 'straight';
}

export function selectTransitionOwner(
  left: MaterialRecipe,
  right: MaterialRecipe,
): MaterialRecipe {
  if (left.transitionPriority !== right.transitionPriority) {
    return left.transitionPriority > right.transitionPriority ? left : right;
  }
  return left.id < right.id ? left : right;
}

export function compileMaterialTransitions(input: Readonly<{
  width: number;
  height: number;
  materialIds: readonly string[];
  recipesById: Readonly<Record<string, MaterialRecipe>>;
}>): readonly MaterialTransition[] {
  if (input.materialIds.length !== input.width * input.height) {
    throw new Error('Transition input does not match its grid dimensions.');
  }
  const at = (x: number, y: number): string | undefined => (
    x < 0 || y < 0 || x >= input.width || y >= input.height
      ? undefined
      : input.materialIds[y * input.width + x]
  );
  const output: MaterialTransition[] = [];
  for (let y = 0; y < input.height; y += 1) {
    for (let x = 0; x < input.width; x += 1) {
      const currentId = at(x, y) as string;
      const current = input.recipesById[currentId];
      if (!current) throw new Error(`No transition recipe exists for ${currentId}.`);
      const neighbors = [
        { id: at(x, y - 1), cornerBits: 1 | 2, edgeBit: 1 },
        { id: at(x + 1, y), cornerBits: 2 | 4, edgeBit: 2 },
        { id: at(x, y + 1), cornerBits: 4 | 8, edgeBit: 4 },
        { id: at(x - 1, y), cornerBits: 8 | 1, edgeBit: 8 },
        { id: at(x - 1, y - 1), cornerBits: 1, edgeBit: 0 },
        { id: at(x + 1, y - 1), cornerBits: 2, edgeBit: 0 },
        { id: at(x + 1, y + 1), cornerBits: 4, edgeBit: 0 },
        { id: at(x - 1, y + 1), cornerBits: 8, edgeBit: 0 },
      ].filter((neighbor): neighbor is { id: string; cornerBits: number; edgeBit: number } => Boolean(neighbor.id && neighbor.id !== currentId));
      if (neighbors.length === 0) continue;
      let mask = 0;
      let edgeMask = 0;
      let owner = current;
      for (const neighbor of neighbors) {
        mask |= neighbor.cornerBits;
        edgeMask |= neighbor.edgeBit;
        const recipe = input.recipesById[neighbor.id];
        if (!recipe) throw new Error(`No transition recipe exists for ${neighbor.id}.`);
        owner = selectTransitionOwner(owner, recipe);
      }
      output.push(Object.freeze({
        tileX: x,
        tileY: y,
        cornerMask: mask,
        edgeMask,
        topology: transitionTopology(mask, edgeMask),
        ownerMaterialId: owner.id,
        neighborMaterialIds: Object.freeze([...new Set(neighbors.map(({ id }) => id))].sort()),
      }));
    }
  }
  return Object.freeze(output);
}
