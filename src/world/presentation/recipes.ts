import { z } from 'zod';

import runtimeRecipesJson from './generated-recipes.json';

const StableIdSchema = z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u);
const PublicSpriteSchema = z.string().regex(/^tile\.[a-z][a-z0-9-]*$/u);
const HexColorSchema = z.string().regex(/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/u);

export const VisualBoundsSchema = z.object({
  left: z.number().int(),
  top: z.number().int(),
  right: z.number().int(),
  bottom: z.number().int(),
}).strict().refine(({ left, top, right, bottom }) => right > left && bottom > top, {
  message: 'Visual bounds must have positive width and height.',
});

export const MaterialRecipeSchema = z.object({
  id: StableIdSchema,
  publicBaseSprite: PublicSpriteSchema,
  logicalVariants: z.array(StableIdSchema).min(2).max(8),
  paletteRamp: z.array(HexColorSchema).min(3).max(8),
  densityBand: z.enum([
    'natural-low',
    'natural-medium',
    'natural-high',
    'structured-low',
    'structured-medium',
  ]),
  seamMode: z.enum(['hashed', 'coordinate-phase']),
  edgeMode: z.enum(['soft', 'built', 'hard']),
  decalFamily: StableIdSchema.nullable(),
  transitionPriority: z.number().int().min(0).max(100),
  selectionSalt: StableIdSchema,
}).strict();

export const RoofRecipeSchema = z.object({
  id: StableIdSchema,
  publicSprite: PublicSpriteSchema,
  tint: HexColorSchema,
  selectionSalt: StableIdSchema,
  visualBounds: VisualBoundsSchema,
}).strict();

export const DecalRecipeSchema = z.object({
  id: StableIdSchema,
  publicSprites: z.array(PublicSpriteSchema).min(1),
  densityPerThousand: z.number().int().min(0).max(1_000),
  selectionSalt: StableIdSchema,
}).strict();

const RuntimeRecipeFileSchema = z.object({
  schemaVersion: z.literal(1),
  artRevision: z.number().int().positive(),
  materials: z.array(MaterialRecipeSchema).min(1),
  defaultRoof: RoofRecipeSchema,
  decalFamilies: z.array(DecalRecipeSchema),
}).strict();

type ParsedMaterialRecipe = z.infer<typeof MaterialRecipeSchema>;
type ParsedDecalRecipe = z.infer<typeof DecalRecipeSchema>;
export type MaterialRecipe = Readonly<
  Omit<ParsedMaterialRecipe, 'logicalVariants' | 'paletteRamp'> & {
    logicalVariants: readonly string[];
    paletteRamp: readonly string[];
  }
>;
export type RoofRecipe = Readonly<z.infer<typeof RoofRecipeSchema>>;
export type DecalRecipe = Readonly<Omit<ParsedDecalRecipe, 'publicSprites'> & { publicSprites: readonly string[] }>;
export type VisualBounds = Readonly<z.infer<typeof VisualBoundsSchema>>;

const runtimeRecipes = RuntimeRecipeFileSchema.parse(runtimeRecipesJson);

const unique = (label: string, values: readonly string[]): void => {
  if (new Set(values).size !== values.length) throw new Error(`${label} contains duplicate IDs.`);
};

unique('Material recipes', runtimeRecipes.materials.map(({ id }) => id));
unique('Material public sprites', runtimeRecipes.materials.map(({ publicBaseSprite }) => publicBaseSprite));
unique('Decal recipes', runtimeRecipes.decalFamilies.map(({ id }) => id));

export const ART_PRESENTATION_REVISION = runtimeRecipes.artRevision;
export const MATERIAL_RECIPES = Object.freeze(runtimeRecipes.materials.map((recipe) => Object.freeze({
  ...recipe,
  logicalVariants: Object.freeze([...recipe.logicalVariants]),
  paletteRamp: Object.freeze([...recipe.paletteRamp]),
})));
export const MATERIAL_RECIPE_BY_SPRITE: Readonly<Record<string, MaterialRecipe>> = Object.freeze(
  Object.fromEntries(MATERIAL_RECIPES.map((recipe) => [recipe.publicBaseSprite, recipe])),
);
export const MATERIAL_RECIPE_BY_ID: Readonly<Record<string, MaterialRecipe>> = Object.freeze(
  Object.fromEntries(MATERIAL_RECIPES.map((recipe) => [recipe.id, recipe])),
);
export const DEFAULT_ROOF_RECIPE = Object.freeze({
  ...runtimeRecipes.defaultRoof,
  visualBounds: Object.freeze({ ...runtimeRecipes.defaultRoof.visualBounds }),
});
export const DECAL_RECIPE_BY_ID: Readonly<Record<string, DecalRecipe>> = Object.freeze(
  Object.fromEntries(runtimeRecipes.decalFamilies.map((recipe) => [recipe.id, Object.freeze({
    ...recipe,
    publicSprites: Object.freeze([...recipe.publicSprites]),
  })])),
);
