import {
  canonicalMaterialDistribution,
  encodeLengthPrefixedTuple,
  selectMaterialVariants,
  stableTupleHash,
} from '../../../src/world/presentation/material-selection';
import {
  ART_PRESENTATION_REVISION,
  MATERIAL_RECIPES,
  MATERIAL_RECIPE_BY_ID,
} from '../../../src/world/presentation/recipes';

describe('deterministic material selection', () => {
  test('uses unambiguous non-commutative length-prefixed tuple bytes', () => {
    expect([...encodeLengthPrefixedTuple(['ab', 'c'])]).not.toEqual([...encodeLengthPrefixedTuple(['a', 'bc'])]);
    expect(stableTupleHash(['map', 1, 2, 'sand', 1, 'salt']))
      .not.toBe(stableTupleHash(['map', 2, 1, 'sand', 1, 'salt']));
    expect(stableTupleHash(['map', 1, 2, 'sand', 1, 'salt']))
      .toBe(stableTupleHash(['map', 1, 2, 'sand', 1, 'salt']));
  });

  test('is independent of caller traversal and prevents an all-identical 2x2 block', () => {
    const width = 12;
    const height = 12;
    const materialIds = Array.from({ length: width * height }, () => 'warm-sand');
    const first = selectMaterialVariants({
      mapId: 'test-map', width, height, materialIds,
      artRevision: ART_PRESENTATION_REVISION,
      recipesById: MATERIAL_RECIPE_BY_ID,
    });
    const second = selectMaterialVariants({
      mapId: 'test-map', width, height, materialIds: [...materialIds],
      artRevision: ART_PRESENTATION_REVISION,
      recipesById: MATERIAL_RECIPE_BY_ID,
    });
    expect(second).toEqual(first);
    for (let y = 1; y < height; y += 1) {
      for (let x = 1; x < width; x += 1) {
        const offset = y * width + x;
        const values = [first[offset], first[offset - 1], first[offset - width], first[offset - width - 1]]
          .map((selection) => selection?.logicalVariantId);
        expect(new Set(values).size).toBeGreaterThan(1);
      }
    }
  });

  test('keeps every canonical 12x12 material inside its declared count band', () => {
    const reports = MATERIAL_RECIPES.map((recipe) => canonicalMaterialDistribution(
      'canonical-material-proof',
      recipe,
      ART_PRESENTATION_REVISION,
    ));
    expect(reports.filter(({ passed }) => !passed)).toEqual([]);
    expect(reports.every(({ counts }) => Object.values(counts).every((count) => count > 0))).toBe(true);
    for (const report of reports) {
      const variantCount = Object.keys(report.counts).length;
      expect(report.minimumAllowed).toBe(Math.floor(72 / variantCount));
      expect(report.maximumAllowed).toBe(Math.ceil(216 / variantCount));
    }
  });
});
