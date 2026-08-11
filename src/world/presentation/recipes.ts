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
  publicVariantSprites: z.array(PublicSpriteSchema).min(2).max(8),
  mapVariantSprites: z.record(z.string().min(1), z.array(PublicSpriteSchema).min(2).max(8)).default({}),
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
}).strict().superRefine(({ logicalVariants, publicVariantSprites, mapVariantSprites }, context) => {
  if (logicalVariants.length !== publicVariantSprites.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Logical material variants and public sprite variants must have equal length.' });
  }
  for (const [mapId, sprites] of Object.entries(mapVariantSprites)) {
    if (sprites.length !== logicalVariants.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Map material variants for ${mapId} must match the logical variant count.`,
      });
    }
  }
});

export const RoofRecipeSchema = z.object({
  id: StableIdSchema,
  publicSprites: z.object({
    base: PublicSpriteSchema,
    edge: PublicSpriteSchema,
    corner: PublicSpriteSchema,
  }).strict(),
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

export const TransitionRecipeSchema = z.object({
  id: z.enum(['soft', 'built']),
  publicSpritePrefix: z.string().regex(/^tile\.transition-(?:soft|built)$/u),
  palette: z.object({
    light: HexColorSchema,
    mid: HexColorSchema,
    shade: HexColorSchema,
  }).strict(),
}).strict();

const RuntimeRecipeFileSchema = z.object({
  schemaVersion: z.literal(1),
  artRevision: z.number().int().positive(),
  materials: z.array(MaterialRecipeSchema).min(1),
  defaultRoof: RoofRecipeSchema,
  decalFamilies: z.array(DecalRecipeSchema),
  transitionFamilies: z.array(TransitionRecipeSchema).length(2),
}).strict();

type ParsedMaterialRecipe = z.infer<typeof MaterialRecipeSchema>;
type ParsedDecalRecipe = z.infer<typeof DecalRecipeSchema>;
type ParsedTransitionRecipe = z.infer<typeof TransitionRecipeSchema>;
export type MaterialRecipe = Readonly<
  Omit<ParsedMaterialRecipe, 'logicalVariants' | 'publicVariantSprites' | 'mapVariantSprites' | 'paletteRamp'> & {
    logicalVariants: readonly string[];
    publicVariantSprites: readonly string[];
    mapVariantSprites: Readonly<Record<string, readonly string[]>>;
    paletteRamp: readonly string[];
  }
>;
export type RoofRecipe = Readonly<z.infer<typeof RoofRecipeSchema>>;
export type DecalRecipe = Readonly<Omit<ParsedDecalRecipe, 'publicSprites'> & { publicSprites: readonly string[] }>;
export type TransitionRecipe = Readonly<ParsedTransitionRecipe>;
export type VisualBounds = Readonly<z.infer<typeof VisualBoundsSchema>>;

const runtimeRecipes = RuntimeRecipeFileSchema.parse(runtimeRecipesJson);

const unique = (label: string, values: readonly string[]): void => {
  if (new Set(values).size !== values.length) throw new Error(`${label} contains duplicate IDs.`);
};

unique('Material recipes', runtimeRecipes.materials.map(({ id }) => id));
unique('Material public base sprites', runtimeRecipes.materials.map(({ publicBaseSprite }) => publicBaseSprite));
const spriteOwners = new Map<string, string>();
for (const recipe of runtimeRecipes.materials) {
  for (const sprite of [
    ...recipe.publicVariantSprites,
    ...Object.values(recipe.mapVariantSprites).flat(),
  ]) {
    const owner = spriteOwners.get(sprite);
    if (owner && owner !== recipe.id) throw new Error(`Material sprite ${sprite} belongs to multiple recipes.`);
    spriteOwners.set(sprite, recipe.id);
  }
}
unique('Decal recipes', runtimeRecipes.decalFamilies.map(({ id }) => id));

export const ART_PRESENTATION_REVISION = runtimeRecipes.artRevision;
export const MATERIAL_RECIPES = Object.freeze(runtimeRecipes.materials.map((recipe) => Object.freeze({
  ...recipe,
  logicalVariants: Object.freeze([...recipe.logicalVariants]),
  publicVariantSprites: Object.freeze([...recipe.publicVariantSprites]),
  mapVariantSprites: Object.freeze(Object.fromEntries(Object.entries(recipe.mapVariantSprites).map(([mapId, sprites]) => [
    mapId,
    Object.freeze([...sprites]),
  ]))),
  paletteRamp: Object.freeze([...recipe.paletteRamp]),
})));
export const MATERIAL_RECIPE_BY_SPRITE: Readonly<Record<string, MaterialRecipe>> = Object.freeze(
  Object.fromEntries(MATERIAL_RECIPES.flatMap((recipe) =>
    [...recipe.publicVariantSprites, ...Object.values(recipe.mapVariantSprites).flat()]
      .map((sprite) => [sprite, recipe] as const))),
);
export const MATERIAL_RECIPE_BY_ID: Readonly<Record<string, MaterialRecipe>> = Object.freeze(
  Object.fromEntries(MATERIAL_RECIPES.map((recipe) => [recipe.id, recipe])),
);
export const DEFAULT_ROOF_RECIPE = Object.freeze({
  ...runtimeRecipes.defaultRoof,
  publicSprites: Object.freeze({ ...runtimeRecipes.defaultRoof.publicSprites }),
  visualBounds: Object.freeze({ ...runtimeRecipes.defaultRoof.visualBounds }),
});
export const DECAL_RECIPE_BY_ID: Readonly<Record<string, DecalRecipe>> = Object.freeze(
  Object.fromEntries(runtimeRecipes.decalFamilies.map((recipe) => [recipe.id, Object.freeze({
    ...recipe,
    publicSprites: Object.freeze([...recipe.publicSprites]),
  })])),
);
export const TRANSITION_RECIPE_BY_ID: Readonly<Record<string, TransitionRecipe>> = Object.freeze(
  Object.fromEntries(runtimeRecipes.transitionFamilies.map((recipe) => [recipe.id, Object.freeze({
    ...recipe,
    palette: Object.freeze({ ...recipe.palette }),
  })])),
);
