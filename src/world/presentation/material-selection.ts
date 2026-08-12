import type { MaterialRecipe } from './recipes';

const UTF8 = new TextEncoder();

export type MaterialSelectionInput = Readonly<{
  mapId: string;
  width: number;
  height: number;
  materialIds: readonly string[];
  artRevision: number;
  recipesById: Readonly<Record<string, MaterialRecipe>>;
}>;

export type MaterialVariantSelection = Readonly<{
  compositionSize: 2 | 3;
  materialId: string;
  logicalVariantId: string;
  variantIndex: number;
}>;

export type MaterialDistributionReport = Readonly<{
  materialId: string;
  width: 12;
  height: 12;
  expectedPerVariant: number;
  minimumAllowed: number;
  maximumAllowed: number;
  counts: Readonly<Record<string, number>>;
  passed: boolean;
}>;

export function encodeLengthPrefixedTuple(parts: readonly (string | number)[]): Uint8Array {
  const encoded = parts.map((part) => UTF8.encode(String(part)));
  const size = encoded.reduce((total, value) => total + 4 + value.length, 0);
  const output = new Uint8Array(size);
  const view = new DataView(output.buffer);
  let offset = 0;
  for (const value of encoded) {
    view.setUint32(offset, value.length, false);
    offset += 4;
    output.set(value, offset);
    offset += value.length;
  }
  return output;
}

export function stableTupleHash(parts: readonly (string | number)[]): number {
  let hash = 0x811c9dc5;
  for (const byte of encodeLengthPrefixedTuple(parts)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

function avalancheHash(hash: number): number {
  let mixed = hash >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x85ebca6b) >>> 0;
  mixed ^= mixed >>> 13;
  mixed = Math.imul(mixed, 0xc2b2ae35) >>> 0;
  mixed ^= mixed >>> 16;
  return mixed >>> 0;
}

export function materialCompositionSize(
  mapId: string,
  recipe: MaterialRecipe,
  artRevision: number,
): 2 | 3 {
  return stableTupleHash([mapId, recipe.id, artRevision, recipe.selectionSalt, 'composition-size']) % 2 === 0 ? 2 : 3;
}

function initialVariantIndex(
  recipe: MaterialRecipe,
  mapId: string,
  x: number,
  y: number,
  width: number,
  artRevision: number,
): number {
  const size = materialCompositionSize(mapId, recipe, artRevision);
  const compositionX = Math.floor(x / size);
  const compositionY = Math.floor(y / size);
  const columns = Math.ceil(width / size);
  const compositionIndex = compositionY * columns + compositionX;
  const variantCount = recipe.logicalVariants.length;
  const groupIndex = Math.floor(compositionIndex / variantCount);
  const rotation = avalancheHash(stableTupleHash([
    mapId,
    recipe.id,
    artRevision,
    recipe.selectionSalt,
    groupIndex,
  ])) % variantCount;
  return (compositionIndex % variantCount + rotation) % variantCount;
}

export function selectMaterialVariants(input: MaterialSelectionInput): readonly MaterialVariantSelection[] {
  if (input.materialIds.length !== input.width * input.height) {
    throw new Error('Material selection input does not match its grid dimensions.');
  }
  const output: MaterialVariantSelection[] = [];
  for (let y = 0; y < input.height; y += 1) {
    for (let x = 0; x < input.width; x += 1) {
      const offset = y * input.width + x;
      const materialId = input.materialIds[offset];
      if (!materialId) throw new Error(`Material selection is missing tile ${x},${y}.`);
      const recipe = input.recipesById[materialId];
      if (!recipe) throw new Error(`No material recipe exists for ${materialId}.`);
      const variantIndex = initialVariantIndex(recipe, input.mapId, x, y, input.width, input.artRevision);
      output.push(Object.freeze({
        compositionSize: materialCompositionSize(input.mapId, recipe, input.artRevision),
        materialId,
        logicalVariantId: recipe.logicalVariants[variantIndex] as string,
        variantIndex,
      }));
    }
  }
  return Object.freeze(output);
}

export function canonicalMaterialDistribution(
  mapId: string,
  recipe: MaterialRecipe,
  artRevision: number,
): MaterialDistributionReport {
  const width = 12;
  const height = 12;
  const selections = selectMaterialVariants({
    mapId,
    width,
    height,
    materialIds: Array.from({ length: width * height }, () => recipe.id),
    artRevision,
    recipesById: { [recipe.id]: recipe },
  });
  const counts = Object.fromEntries(recipe.logicalVariants.map((variant) => [variant, 0])) as Record<string, number>;
  selections.forEach(({ logicalVariantId }) => { counts[logicalVariantId] = (counts[logicalVariantId] ?? 0) + 1; });
  const expectedPerVariant = selections.length / recipe.logicalVariants.length;
  const minimumAllowed = Math.floor(72 / recipe.logicalVariants.length);
  const maximumAllowed = Math.ceil(216 / recipe.logicalVariants.length);
  const passed = Object.values(counts).every((count) => count >= minimumAllowed && count <= maximumAllowed);
  return Object.freeze({
    materialId: recipe.id,
    width,
    height,
    expectedPerVariant,
    minimumAllowed,
    maximumAllowed,
    counts: Object.freeze(counts),
    passed,
  });
}
