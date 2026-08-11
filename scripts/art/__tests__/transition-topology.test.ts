import {
  compileMaterialTransitions,
  selectTransitionOwner,
  transitionCornerMask,
  transitionTopology,
} from '../../../src/world/presentation/material-transitions';
import { MaterialRecipeSchema, type MaterialRecipe } from '../../../src/world/presentation/recipes';

function recipe(id: string, transitionPriority: number): MaterialRecipe {
  return MaterialRecipeSchema.parse({
    id,
    publicBaseSprite: `tile.${id}`,
    logicalVariants: [`${id}-a`, `${id}-b`],
    paletteRamp: ['#111111', '#222222', '#333333'],
    densityBand: 'natural-low',
    seamMode: 'hashed',
    edgeMode: 'soft',
    decalFamily: null,
    transitionPriority,
    selectionSalt: `${id}-salt`,
  });
}

describe('corner-aware material transition topology', () => {
  test('covers every one of the 16 masks with stable topology names', () => {
    expect(Array.from({ length: 16 }, (_unused, mask) => transitionTopology(mask))).toEqual([
      'none',
      'outer-corner', 'outer-corner', 'straight',
      'outer-corner', 'saddle', 'straight', 'inner-corner',
      'outer-corner', 'straight', 'saddle', 'inner-corner',
      'straight', 'inner-corner', 'inner-corner', 'island',
    ]);
    expect(transitionCornerMask([true, false, true, false])).toBe(5);
    expect(() => transitionTopology(16)).toThrow('0 through 15');
  });

  test('uses the higher transition priority and stable material ID for ties', () => {
    expect(selectTransitionOwner(recipe('sand', 10), recipe('paver', 20)).id).toBe('paver');
    expect(selectTransitionOwner(recipe('zinc', 20), recipe('amber', 20)).id).toBe('amber');
  });

  test('compiles strips, islands, saddles, and multi-material junctions in row-major order', () => {
    const sand = recipe('sand', 10);
    const paver = recipe('paver', 20);
    const water = recipe('water', 30);
    const transitions = compileMaterialTransitions({
      width: 3,
      height: 3,
      materialIds: [
        'sand', 'paver', 'sand',
        'paver', 'water', 'paver',
        'sand', 'paver', 'sand',
      ],
      recipesById: { sand, paver, water },
    });
    expect(transitions.map(({ tileX, tileY }) => `${tileX},${tileY}`))
      .toEqual([...transitions.map(({ tileX, tileY }) => `${tileX},${tileY}`)].sort((left, right) => {
        const [leftX, leftY] = left.split(',').map(Number);
        const [rightX, rightY] = right.split(',').map(Number);
        return leftY! - rightY! || leftX! - rightX!;
      }));
    expect(transitions.find(({ tileX, tileY }) => tileX === 1 && tileY === 1)).toMatchObject({
      cornerMask: 15,
      topology: 'island',
      ownerMaterialId: 'water',
      neighborMaterialIds: ['paver', 'sand'],
    });
  });
});
