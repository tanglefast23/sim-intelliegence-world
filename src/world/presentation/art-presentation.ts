import { pointsInRect, tileKey, type TilePoint, type WorldMapV2 } from '../maps/schema';
import { stableTupleHash, selectMaterialVariants } from './material-selection';
import { compileMaterialTransitions, type MaterialTransition } from './material-transitions';
import {
  ART_PRESENTATION_REVISION,
  DECAL_RECIPE_BY_ID,
  DEFAULT_ROOF_RECIPE,
  MATERIAL_RECIPE_BY_ID,
  MATERIAL_RECIPE_BY_SPRITE,
  TRANSITION_RECIPE_BY_ID,
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
  offsetX: number;
  offsetY: number;
  solid: boolean;
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

const SOLID_ENVIRONMENT_SPRITES = new Set([
  'tile.decal-sand-shells',
  'tile.decal-sapling',
  'tile.decal-young-palm',
  'tile.decal-canopy-tree',
  'tile.decal-neon-planter',
]);

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
    const variantSprites = recipe.mapVariantSprites[input.map.id] ?? recipe.publicVariantSprites;
    const sprite = variantSprites[selection.variantIndex] as string;
    return Object.freeze({
      id: `ground-${x}-${y}`,
      tile: Object.freeze({ x, y }),
      materialId: selection.materialId,
      logicalVariantId: selection.logicalVariantId,
      sprite,
      visualBounds: freezeBounds(input.visualBoundsBySprite?.[sprite] ?? input.visualBoundsBySprite?.[recipe.publicBaseSprite]),
    });
  }));
  const transitions = Object.freeze(compileMaterialTransitions({
    width: input.map.width,
    height: input.map.height,
    materialIds,
    recipesById: MATERIAL_RECIPE_BY_ID,
  }).map((transition) => {
    const owner = MATERIAL_RECIPE_BY_ID[transition.ownerMaterialId];
    if (!owner) throw new Error(`Transition owner ${transition.ownerMaterialId} has no material recipe.`);
    const familyId = owner.edgeMode === 'hard' ? null : owner.edgeMode;
    const family = familyId ? TRANSITION_RECIPE_BY_ID[familyId] : null;
    if (familyId && !family) throw new Error(`Transition family ${familyId} is missing.`);
    return Object.freeze({
      ...transition,
      id: `transition-${transition.tileX}-${transition.tileY}`,
      tile: Object.freeze({ x: transition.tileX, y: transition.tileY }),
      sprite: family ? `${family.publicSpritePrefix}-${transition.cornerMask.toString(16)}` : null,
      solid: false as const,
      interactive: false as const,
    });
  }));
  const decals: DecalPresentationCell[] = [];
  const decalBlockedTiles = new Set<string>();
  input.map.terrainSolids.flatMap(({ bounds }) => pointsInRect(bounds))
    .forEach((tile) => decalBlockedTiles.add(tileKey(tile)));
  for (const run of input.map.walls.runs) {
    const openings = new Set(run.openings.map(({ tile }) => tileKey(tile)));
    pointsInRect(run.bounds).filter((tile) => !openings.has(tileKey(tile)))
      .forEach((tile) => decalBlockedTiles.add(tileKey(tile)));
  }
  for (const object of input.map.objects) {
    for (const footprint of object.solidFootprints) {
      for (let y = 0; y < footprint.bounds.height; y += 1) {
        for (let x = 0; x < footprint.bounds.width; x += 1) {
          decalBlockedTiles.add(tileKey({
            x: object.anchor.x + footprint.bounds.x + x,
            y: object.anchor.y + footprint.bounds.y + y,
          }));
        }
      }
    }
  }
  input.map.roofGroups.flatMap(({ cells }) => cells.flatMap(pointsInRect))
    .forEach((tile) => decalBlockedTiles.add(tileKey(tile)));
  const solidDecalBlockedTiles = new Set(decalBlockedTiles);
  for (const run of input.map.walls.runs) {
    const sideOffsets = run.bounds.width > 1
      ? [{ x: 0, y: -1 }, { x: 0, y: 1 }]
      : [{ x: -1, y: 0 }, { x: 1, y: 0 }];
    for (const opening of run.openings) {
      solidDecalBlockedTiles.add(tileKey(opening.tile));
      sideOffsets.forEach((offset) => solidDecalBlockedTiles.add(tileKey({
        x: opening.tile.x + offset.x,
        y: opening.tile.y + offset.y,
      })));
    }
  }
  input.map.stagingTiles.forEach((tile) => solidDecalBlockedTiles.add(tileKey(tile)));
  Object.values(input.map.spawns).forEach((tile) => solidDecalBlockedTiles.add(tileKey(tile)));
  input.map.portals.forEach(({ tile }) => solidDecalBlockedTiles.add(tileKey(tile)));
  for (const area of input.map.areas) {
    area.entranceTiles.forEach((tile) => solidDecalBlockedTiles.add(tileKey(tile)));
    area.primaryRoutes.flatMap(pointsInRect).forEach((tile) => solidDecalBlockedTiles.add(tileKey(tile)));
  }
  for (const door of input.map.doors) {
    door.interaction?.approachTiles.forEach((tile) => solidDecalBlockedTiles.add(tileKey(tile)));
  }
  for (const object of input.map.objects) {
    for (const interaction of object.interactions) {
      interaction.approachOffsets.forEach((offset) => solidDecalBlockedTiles.add(tileKey({
        x: object.anchor.x + offset.x,
        y: object.anchor.y + offset.y,
      })));
    }
  }
  for (const cell of ground) {
    const material = MATERIAL_RECIPE_BY_ID[cell.materialId];
    const family = material?.decalFamily ? DECAL_RECIPE_BY_ID[material.decalFamily] : undefined;
    if (!family || family.densityPerThousand === 0 || decalBlockedTiles.has(tileKey(cell.tile))) continue;
    const roll = stableTupleHash([
      input.map.id,
      cell.tile.x,
      cell.tile.y,
      family.id,
      ART_PRESENTATION_REVISION,
      family.selectionSalt,
    ]) % 1_000;
    const patchRoll = stableTupleHash([
      input.map.id,
      Math.floor(cell.tile.x / 7),
      Math.floor(cell.tile.y / 5),
      family.id,
      ART_PRESENTATION_REVISION,
      family.selectionSalt,
      'environment-patch',
    ]) % 1_000;
    const densityBias = patchRoll < 300 ? 260 : patchRoll > 620 ? -300 : -120;
    const clusteredDensity = Math.max(0, Math.min(1_000, family.densityPerThousand + densityBias));
    if (roll >= clusteredDensity) continue;
    const sprite = family.publicSprites[roll % family.publicSprites.length] as string;
    const solid = SOLID_ENVIRONMENT_SPRITES.has(sprite);
    if (solid && solidDecalBlockedTiles.has(tileKey(cell.tile))) continue;
    const offsetX = (stableTupleHash([
      input.map.id, cell.tile.x, cell.tile.y, family.id, family.selectionSalt, 'offset-x',
    ]) % 15) - 7;
    const offsetY = (stableTupleHash([
      input.map.id, cell.tile.x, cell.tile.y, family.id, family.selectionSalt, 'offset-y',
    ]) % 11) - 5;
    decals.push(Object.freeze({
      id: `decal-${cell.tile.x}-${cell.tile.y}`,
      tile: cell.tile,
      familyId: family.id,
      sprite,
      offsetX,
      offsetY,
      solid,
      interactive: false,
    }));
  }
  const roofs = Object.freeze([...input.map.roofGroups]
    .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
    .flatMap((roof) => {
      const tiles = roof.cells.flatMap(pointsInRect);
      const keys = new Set(tiles.map(({ x, y }) => `${x},${y}`));
      return tiles.map((tile) => {
        const neighbors = [
          keys.has(`${tile.x},${tile.y - 1}`),
          keys.has(`${tile.x + 1},${tile.y}`),
          keys.has(`${tile.x},${tile.y + 1}`),
          keys.has(`${tile.x - 1},${tile.y}`),
        ];
        const neighborCount = neighbors.filter(Boolean).length;
        const adjacentCorner = neighborCount === 2 && (
          (neighbors[0] && neighbors[1]) || (neighbors[1] && neighbors[2]) ||
          (neighbors[2] && neighbors[3]) || (neighbors[3] && neighbors[0])
        );
        const kind = neighborCount === 4 ? 'base' : adjacentCorner || neighborCount < 2 ? 'corner' : 'edge';
        const sprite = DEFAULT_ROOF_RECIPE.publicSprites[kind];
        return Object.freeze({
          id: `roof-${roof.id}-${tile.x}-${tile.y}`,
          roofGroupId: roof.id,
          tile: Object.freeze({ ...tile }),
          sprite,
          tint: DEFAULT_ROOF_RECIPE.tint,
          visualBounds: freezeBounds(input.visualBoundsBySprite?.[sprite] ?? DEFAULT_ROOF_RECIPE.visualBounds),
        });
      });
    }));
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
