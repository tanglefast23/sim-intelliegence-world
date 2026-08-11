import { pointsInRect, type TilePoint, type WorldMapV2 } from '../maps/schema';
import { stableTupleHash, selectMaterialVariants } from './material-selection';
import { compileMaterialTransitions, type MaterialTransition } from './material-transitions';
import {
  ART_PRESENTATION_REVISION,
  DECAL_RECIPE_BY_ID,
  DEFAULT_ROOF_RECIPE,
  MATERIAL_RECIPE_BY_ID,
  MATERIAL_RECIPE_BY_SPRITE,
  type VisualBounds,
} from './recipes';
import { TILE_VISUAL_BOUNDS } from './visual-bounds';

export type GroundPresentationCell = Readonly<{
  id: string;
  tile: TilePoint;
  materialId: string;
  logicalVariantId: string;
  sprite: string;
  visualBounds: VisualBounds;
}>;

export type DecalPresentationCell = Readonly<{
  id: string;
  tile: TilePoint;
  familyId: string;
  sprite: string;
  solid: false;
  interactive: false;
}>;

export type TransitionPresentationCell = MaterialTransition & Readonly<{
  id: string;
  tile: TilePoint;
  sprite: string | null;
  solid: false;
  interactive: false;
}>;

export type RoofPresentationCell = Readonly<{
  id: string;
  roofGroupId: string;
  tile: TilePoint;
  sprite: string;
  tint: string;
  visualBounds: VisualBounds;
}>;

export type ArtPresentationIndex = Readonly<{
  schemaVersion: 1;
  artRevision: number;
  mapId: string;
  ground: readonly GroundPresentationCell[];
  transitions: readonly TransitionPresentationCell[];
  decals: readonly DecalPresentationCell[];
  roofs: readonly RoofPresentationCell[];
  visualBoundsBySprite: Readonly<Record<string, VisualBounds>>;
  hash: string;
}>;

export type ArtPresentationCompileInput = Readonly<{
  map: WorldMapV2;
  groundSprites: readonly string[];
  visualBoundsBySprite?: Readonly<Record<string, VisualBounds>>;
}>;

function freezeBounds(bounds: VisualBounds | undefined): VisualBounds {
  return Object.freeze({ ...(bounds ?? TILE_VISUAL_BOUNDS) });
}

function presentationDigest(value: unknown): string {
  return stableTupleHash([JSON.stringify(value)]).toString(16).padStart(8, '0');
}

export function compileArtPresentation(input: ArtPresentationCompileInput): ArtPresentationIndex {
  const materialIds = input.groundSprites.map((sprite) => {
    const recipe = MATERIAL_RECIPE_BY_SPRITE[sprite];
    if (!recipe) throw new Error(`Ground sprite ${sprite} has no material presentation recipe.`);
    return recipe.id;
  });
  const selections = selectMaterialVariants({
    mapId: input.map.id,
    width: input.map.width,
    height: input.map.height,
    materialIds,
    artRevision: ART_PRESENTATION_REVISION,
    recipesById: MATERIAL_RECIPE_BY_ID,
  });
  const ground = Object.freeze(selections.map((selection, offset) => {
    const x = offset % input.map.width;
    const y = Math.floor(offset / input.map.width);
    const recipe = MATERIAL_RECIPE_BY_ID[selection.materialId];
    if (!recipe) throw new Error(`Material ${selection.materialId} has no presentation recipe.`);
    return Object.freeze({
      id: `ground-${x}-${y}`,
      tile: Object.freeze({ x, y }),
      materialId: selection.materialId,
      logicalVariantId: selection.logicalVariantId,
      sprite: recipe.publicBaseSprite,
      visualBounds: freezeBounds(input.visualBoundsBySprite?.[recipe.publicBaseSprite]),
    });
  }));
  const transitions = Object.freeze(compileMaterialTransitions({
    width: input.map.width,
    height: input.map.height,
    materialIds,
    recipesById: MATERIAL_RECIPE_BY_ID,
  }).map((transition) => Object.freeze({
    ...transition,
    id: `transition-${transition.tileX}-${transition.tileY}`,
    tile: Object.freeze({ x: transition.tileX, y: transition.tileY }),
    sprite: null,
    solid: false as const,
    interactive: false as const,
  })));
  const decals: DecalPresentationCell[] = [];
  for (const cell of ground) {
    const material = MATERIAL_RECIPE_BY_ID[cell.materialId];
    const family = material?.decalFamily ? DECAL_RECIPE_BY_ID[material.decalFamily] : undefined;
    if (!family || family.densityPerThousand === 0) continue;
    const roll = stableTupleHash([
      input.map.id,
      cell.tile.x,
      cell.tile.y,
      family.id,
      ART_PRESENTATION_REVISION,
      family.selectionSalt,
    ]) % 1_000;
    if (roll >= family.densityPerThousand) continue;
    const sprite = family.publicSprites[roll % family.publicSprites.length] as string;
    decals.push(Object.freeze({
      id: `decal-${cell.tile.x}-${cell.tile.y}`,
      tile: cell.tile,
      familyId: family.id,
      sprite,
      solid: false,
      interactive: false,
    }));
  }
  const roofs = Object.freeze([...input.map.roofGroups]
    .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
    .flatMap((roof) => roof.cells.flatMap(pointsInRect).map((tile) => Object.freeze({
      id: `roof-${roof.id}-${tile.x}-${tile.y}`,
      roofGroupId: roof.id,
      tile: Object.freeze({ ...tile }),
      sprite: DEFAULT_ROOF_RECIPE.publicSprite,
      tint: DEFAULT_ROOF_RECIPE.tint,
      visualBounds: freezeBounds(input.visualBoundsBySprite?.[DEFAULT_ROOF_RECIPE.publicSprite] ?? DEFAULT_ROOF_RECIPE.visualBounds),
    }))));
  const usedSprites = new Set([
    ...ground.map(({ sprite }) => sprite),
    ...decals.map(({ sprite }) => sprite),
    ...roofs.map(({ sprite }) => sprite),
    ...input.map.objects.flatMap(({ renderParts }) => renderParts.map(({ sprite }) => sprite)),
    ...input.map.doors.map(({ sprite }) => sprite),
  ]);
  const visualBoundsBySprite = Object.freeze(Object.fromEntries([...usedSprites].sort().map((sprite) => [
    sprite,
    freezeBounds(input.visualBoundsBySprite?.[sprite]),
  ])));
  const immutableDecals = Object.freeze(decals);
  const hashPayload = {
    artRevision: ART_PRESENTATION_REVISION,
    mapId: input.map.id,
    ground: ground.map(({ materialId, logicalVariantId, sprite, tile }) => ({ materialId, logicalVariantId, sprite, tile })),
    transitions,
    decals: immutableDecals,
    roofs,
    visualBoundsBySprite,
  };
  return Object.freeze({
    schemaVersion: 1,
    artRevision: ART_PRESENTATION_REVISION,
    mapId: input.map.id,
    ground,
    transitions,
    decals: immutableDecals,
    roofs,
    visualBoundsBySprite,
    hash: presentationDigest(hashPayload),
  });
}

export function presentationGroundAt(index: ArtPresentationIndex, tile: TilePoint, width: number): GroundPresentationCell {
  const cell = index.ground[tile.y * width + tile.x];
  if (!cell) throw new Error('Ground tile is outside the art presentation index.');
  return cell;
}
