import { tileKey, type DensityProfile, type TilePoint, type WorldMapV2 } from './schema';

export type StaticSolidOwner = Readonly<{
  kind: 'terrain' | 'wall' | 'door' | 'object';
  id: string;
}>;

export type CompiledWallCellV2 = Readonly<{
  id: string;
  runId: string;
  material: string;
  tile: TilePoint;
  adjacencyMask: number;
  sprite: string;
}>;

export type CompiledWallOpeningV2 = Readonly<{
  id: string;
  runId: string;
  material: string;
  tile: TilePoint;
}>;

export type CompiledObjectPartV2 = Readonly<{
  id: string;
  objectId: string;
  sprite: string;
  tile: TilePoint;
  depthAnchor: TilePoint;
}>;

export type CompiledInteractionV2 = Readonly<{
  id: string;
  kind: 'bed' | 'storage' | 'social' | 'decoration' | 'door';
  ownerKind: 'object' | 'door';
  ownerId: string;
  areaId: string;
  approachTiles: readonly TilePoint[];
}>;

export type CompiledDoorV2 = Readonly<{
  id: string;
  openingId: string;
  tile: TilePoint;
  initialState: 'open' | 'closed-unlocked' | 'closed-locked';
  sprite: string;
  roofGroupId?: string;
  interactionId?: string;
}>;

export type CompiledRoofGroupV2 = Readonly<{
  id: string;
  cellKeys: ReadonlySet<string>;
  interiorKeys: ReadonlySet<string>;
}>;

export type CompiledLocationBindingV2 = Readonly<{
  locationId: string;
  areaIds: readonly string[];
  preferredInteractionIds: readonly string[];
  candidateTiles: readonly TilePoint[];
  preferredApproachTiles: readonly TilePoint[];
}>;

export type DensityMetrics = Readonly<{
  areaId: string;
  profile: DensityProfile;
  eligibleCellCount: number;
  objectSolidCellCount: number;
  detailCellCount: number;
  walkableCellCount: number;
  objectSolidRatio: number;
  detailRatio: number;
  walkableRatio: number;
  objectPartCount: number;
  distinctObjectKinds: number;
  objectClusterCount: number;
}>;

export type CompiledMapV2 = Readonly<{
  source: WorldMapV2;
  groundSprites: readonly string[];
  staticSolidOwnerByTile: ReadonlyMap<string, StaticSolidOwner>;
  blockedKeys: ReadonlySet<string>;
  wallTiles: readonly CompiledWallCellV2[];
  wallOpeningById: ReadonlyMap<string, CompiledWallOpeningV2>;
  objectPartById: ReadonlyMap<string, CompiledObjectPartV2>;
  partOwnersByTile: ReadonlyMap<string, readonly string[]>;
  doorById: ReadonlyMap<string, CompiledDoorV2>;
  interactionById: ReadonlyMap<string, CompiledInteractionV2>;
  areaById: ReadonlyMap<string, WorldMapV2['areas'][number]>;
  portalById: ReadonlyMap<string, WorldMapV2['portals'][number]>;
  roofGroupById: ReadonlyMap<string, CompiledRoofGroupV2>;
  locationBindingById: ReadonlyMap<string, CompiledLocationBindingV2>;
  densityByAreaId: ReadonlyMap<string, DensityMetrics>;
}>;

export function groundSpriteAtV2(map: CompiledMapV2, tile: TilePoint): string {
  const sprite = map.groundSprites[tile.y * map.source.width + tile.x];
  if (!sprite) throw new Error('Ground tile is outside the compiled v2 map.');
  return sprite;
}

export function roofGroupAtV2(map: CompiledMapV2, tile: TilePoint): string | undefined {
  const key = tileKey(tile);
  return [...map.roofGroupById.values()].find((roof) => (
    roof.interiorKeys.has(key) || [...map.doorById.values()].some((door) => (
      door.roofGroupId === roof.id && tileKey(door.tile) === key
    ))
  ))?.id;
}
