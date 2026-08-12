import { z } from 'zod';

export const MapStableIdSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$/u);
export const MapSpriteIdSchema = z.string().regex(/^tile\.[a-z][a-z0-9-]*$/u);

export const TilePointSchema = z.object({
  x: z.number().int().min(0).max(63),
  y: z.number().int().min(0).max(47),
}).strict();

export const TileRectSchema = TilePointSchema.extend({
  width: z.number().int().positive().max(64),
  height: z.number().int().positive().max(48),
}).strict().refine((value) => value.x + value.width <= 64 && value.y + value.height <= 48, {
  message: 'Tile rectangle exceeds the 64x48 map bounds.',
});

const IdentifiedRectSchema = TileRectSchema.extend({ id: MapStableIdSchema }).strict();
const SpriteRectSchema = IdentifiedRectSchema.extend({ sprite: MapSpriteIdSchema }).strict();

export const WorldMapSchema = z.object({
  schemaVersion: z.literal(1),
  id: MapStableIdSchema,
  displayName: z.string().trim().min(1).max(80),
  width: z.literal(64),
  height: z.literal(48),
  tileSize: z.literal(32),
  ground: z.object({
    defaultSprite: MapSpriteIdSchema,
    regions: z.array(SpriteRectSchema),
  }).strict(),
  collision: z.object({
    rectangles: z.array(IdentifiedRectSchema),
    walkableOverrides: z.array(TilePointSchema),
  }).strict(),
  walls: z.object({
    regions: z.array(SpriteRectSchema),
    openings: z.array(TilePointSchema),
  }).strict(),
  props: z.array(z.object({
    id: MapStableIdSchema,
    sprite: MapSpriteIdSchema,
    tile: TilePointSchema,
    blocksMovement: z.boolean(),
  }).strict()),
  effects: z.array(z.object({
    id: MapStableIdSchema,
    kind: z.enum(['fire', 'sparkle', 'insects', 'leaves', 'neon', 'palm', 'steam', 'water']),
    tile: TilePointSchema,
  }).strict()),
  interactions: z.array(z.object({
    id: MapStableIdSchema,
    kind: z.enum(['bed', 'storage', 'door', 'social', 'decoration']),
    hitTile: TilePointSchema,
    targetTile: TilePointSchema,
  }).strict()),
  doors: z.array(z.object({
    id: MapStableIdSchema,
    tile: TilePointSchema,
    roofGroupId: MapStableIdSchema,
  }).strict()),
  roofGroups: z.array(z.object({
    id: MapStableIdSchema,
    bounds: TileRectSchema,
    interior: TileRectSchema,
  }).strict()),
  areas: z.array(z.object({
    id: MapStableIdSchema,
    bounds: TileRectSchema,
  }).strict()),
  portals: z.array(z.object({
    id: MapStableIdSchema,
    edge: z.enum(['north', 'east', 'south', 'west']),
    tile: TilePointSchema,
    destinationMapId: MapStableIdSchema,
    destinationEntranceId: MapStableIdSchema,
  }).strict()),
  stagingTiles: z.array(TilePointSchema).min(1),
  spawns: z.record(MapStableIdSchema, TilePointSchema),
}).strict();

export const TileOffsetSchema = z.object({
  x: z.number().int().min(-63).max(63),
  y: z.number().int().min(-47).max(47),
}).strict();

export const RelativeTileRectSchema = TileOffsetSchema.extend({
  width: z.number().int().positive().max(64),
  height: z.number().int().positive().max(48),
}).strict();

export const DensityProfileSchema = z.enum([
  'furnished-interior',
  'active-public',
  'relaxation-natural',
  'service-docks',
  'structural-placeholder',
]);

const WallOpeningV2Schema = z.object({
  id: MapStableIdSchema,
  tile: TilePointSchema,
}).strict();

const WallRunV2Schema = z.object({
  id: MapStableIdSchema,
  material: MapStableIdSchema,
  bounds: TileRectSchema,
  openings: z.array(WallOpeningV2Schema),
}).strict();

const ObjectInteractionV2Schema = z.object({
  id: MapStableIdSchema,
  kind: z.enum(['bed', 'storage', 'social', 'decoration']),
  approachOffsets: z.array(TileOffsetSchema).min(1),
}).strict();

const DoorInteractionV2Schema = z.object({
  id: MapStableIdSchema,
  areaId: MapStableIdSchema,
  approachTiles: z.array(TilePointSchema).min(1),
}).strict();

const ObjectV2Schema = z.object({
  id: MapStableIdSchema,
  kind: MapStableIdSchema,
  areaId: MapStableIdSchema,
  anchor: TilePointSchema,
  depthAnchorOffset: TileOffsetSchema.default({ x: 0, y: 0 }),
  renderParts: z.array(z.object({
    id: MapStableIdSchema,
    sprite: MapSpriteIdSchema,
    offset: TileOffsetSchema,
  }).strict()).min(1),
  solidFootprints: z.array(z.object({
    id: MapStableIdSchema,
    bounds: RelativeTileRectSchema,
  }).strict()).default([]),
  interactions: z.array(ObjectInteractionV2Schema).default([]),
}).strict();

const DoorV2Schema = z.object({
  id: MapStableIdSchema,
  openingId: MapStableIdSchema,
  initialState: z.enum(['open', 'closed-unlocked', 'closed-locked']),
  sprite: MapSpriteIdSchema,
  roofGroupId: MapStableIdSchema.optional(),
  interaction: DoorInteractionV2Schema.optional(),
}).strict();

const AreaV2Schema = z.object({
  id: MapStableIdSchema,
  bounds: TileRectSchema,
  densityProfile: DensityProfileSchema,
  intentionalOpenAreas: z.array(TileRectSchema).default([]),
  entranceTiles: z.array(TilePointSchema).min(1),
  primaryRoutes: z.array(TileRectSchema).default([]),
  requiredPortalIds: z.array(MapStableIdSchema).default([]),
}).strict();

export const WorldMapV2Schema = z.object({
  schemaVersion: z.literal(2),
  layoutRevision: z.number().int().positive(),
  id: MapStableIdSchema,
  displayName: z.string().trim().min(1).max(80),
  width: z.literal(64),
  height: z.literal(48),
  tileSize: z.literal(32),
  ground: z.object({
    defaultSprite: MapSpriteIdSchema,
    regions: z.array(SpriteRectSchema),
  }).strict(),
  terrainSolids: z.array(z.object({
    id: MapStableIdSchema,
    kind: z.enum(['water', 'cliff', 'other']),
    bounds: TileRectSchema,
  }).strict()).default([]),
  walls: z.object({ runs: z.array(WallRunV2Schema) }).strict(),
  doors: z.array(DoorV2Schema).default([]),
  objects: z.array(ObjectV2Schema).default([]),
  effects: z.array(z.object({
    id: MapStableIdSchema,
    kind: z.enum(['fire', 'sparkle', 'insects', 'leaves', 'neon', 'palm', 'steam', 'water']),
    tile: TilePointSchema,
  }).strict()).default([]),
  roofGroups: z.array(z.object({
    id: MapStableIdSchema,
    cells: z.array(TileRectSchema).min(1),
    interiorCells: z.array(TileRectSchema).min(1),
  }).strict()).default([]),
  areas: z.array(AreaV2Schema).min(1),
  buildings: z.array(z.object({
    id: MapStableIdSchema,
    areaIds: z.array(MapStableIdSchema).min(1),
    outerWallRunIds: z.array(MapStableIdSchema).min(1),
    entranceOpeningIds: z.array(MapStableIdSchema).min(1),
    roofGroupId: MapStableIdSchema,
  }).strict()).default([]),
  locationBindings: z.array(z.object({
    locationId: MapStableIdSchema,
    areaIds: z.array(MapStableIdSchema).min(1),
    preferredInteractionIds: z.array(MapStableIdSchema).default([]),
  }).strict()).min(1),
  portals: z.array(z.object({
    id: MapStableIdSchema,
    edge: z.enum(['north', 'east', 'south', 'west']),
    tile: TilePointSchema,
    destinationMapId: MapStableIdSchema,
    destinationEntranceId: MapStableIdSchema,
  }).strict()),
  stagingTiles: z.array(TilePointSchema).min(1),
  spawns: z.record(MapStableIdSchema, TilePointSchema),
  startComposition: z.object({
    cameraAnchor: TilePointSchema,
    requiredActorIds: z.array(MapStableIdSchema).min(1),
    requiredDetailPartIds: z.array(MapStableIdSchema).min(1),
    landmarkAreaIds: z.array(MapStableIdSchema).min(1),
  }).strict().optional(),
}).strict();

export type TilePoint = z.infer<typeof TilePointSchema>;
export type TileRect = z.infer<typeof TileRectSchema>;
export type WorldMap = z.infer<typeof WorldMapSchema>;
export type TileOffset = z.infer<typeof TileOffsetSchema>;
export type RelativeTileRect = z.infer<typeof RelativeTileRectSchema>;
export type DensityProfile = z.infer<typeof DensityProfileSchema>;
export type WorldMapV2 = z.infer<typeof WorldMapV2Schema>;

export type CompiledMap = Readonly<{
  source: WorldMap;
  groundSprites: readonly string[];
  blockedKeys: ReadonlySet<string>;
  wallTiles: readonly Readonly<{ id: string; sprite: string; tile: TilePoint }>[];
}>;

export function tileKey(tile: TilePoint): string {
  return `${tile.x},${tile.y}`;
}

export function pointsInRect(rectangle: TileRect): TilePoint[] {
  const points: TilePoint[] = [];
  for (let y = rectangle.y; y < rectangle.y + rectangle.height; y += 1) {
    for (let x = rectangle.x; x < rectangle.x + rectangle.width; x += 1) points.push({ x, y });
  }
  return points;
}

function assertUnique(label: string, ids: readonly string[]): void {
  if (new Set(ids).size !== ids.length) throw new Error(`${label} IDs must be unique.`);
}

function assertKnownSprites(map: WorldMap, knownSprites: ReadonlySet<string>): void {
  const sprites = [
    map.ground.defaultSprite,
    ...map.ground.regions.map(({ sprite }) => sprite),
    ...map.walls.regions.map(({ sprite }) => sprite),
    ...map.props.map(({ sprite }) => sprite),
  ];
  for (const sprite of sprites) {
    if (!knownSprites.has(sprite)) throw new Error(`Map references an unknown atlas sprite: ${sprite}`);
  }
}

function assertEdgePortal(portal: WorldMap['portals'][number]): void {
  const valid =
    (portal.edge === 'north' && portal.tile.y === 0) ||
    (portal.edge === 'east' && portal.tile.x === 63) ||
    (portal.edge === 'south' && portal.tile.y === 47) ||
    (portal.edge === 'west' && portal.tile.x === 0);
  if (!valid) throw new Error(`Portal ${portal.id} is not on its declared edge.`);
}

function rectContains(outer: TileRect, inner: TileRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height;
}

export function compileWorldMap(candidate: unknown, knownSprites: ReadonlySet<string>): CompiledMap {
  const map = WorldMapSchema.parse(candidate);
  assertKnownSprites(map, knownSprites);
  assertUnique('Ground region', map.ground.regions.map(({ id }) => id));
  assertUnique('Collision rectangle', map.collision.rectangles.map(({ id }) => id));
  assertUnique('Wall region', map.walls.regions.map(({ id }) => id));
  assertUnique('Prop', map.props.map(({ id }) => id));
  assertUnique('Effect', map.effects.map(({ id }) => id));
  assertUnique('Interaction', map.interactions.map(({ id }) => id));
  assertUnique('Door', map.doors.map(({ id }) => id));
  assertUnique('Roof group', map.roofGroups.map(({ id }) => id));
  assertUnique('Area', map.areas.map(({ id }) => id));
  assertUnique('Portal', map.portals.map(({ id }) => id));
  assertUnique('Staging tile', map.stagingTiles.map(tileKey));
  map.portals.forEach(assertEdgePortal);

  const roofIds = new Set(map.roofGroups.map(({ id }) => id));
  for (const roof of map.roofGroups) {
    if (!rectContains(roof.bounds, roof.interior)) {
      throw new Error(`Roof group ${roof.id} does not contain its interior.`);
    }
  }
  for (const door of map.doors) {
    if (!roofIds.has(door.roofGroupId)) throw new Error(`Door ${door.id} references an unknown roof group.`);
  }

  const groundSprites = Array.from({ length: map.width * map.height }, () => map.ground.defaultSprite);
  for (const region of map.ground.regions) {
    for (const point of pointsInRect(region)) groundSprites[point.y * map.width + point.x] = region.sprite;
  }

  const blockedKeys = new Set<string>();
  for (const rectangle of map.collision.rectangles) {
    pointsInRect(rectangle).forEach((point) => blockedKeys.add(tileKey(point)));
  }
  map.collision.walkableOverrides.forEach((point) => blockedKeys.delete(tileKey(point)));
  map.props.filter(({ blocksMovement }) => blocksMovement).forEach(({ tile }) => blockedKeys.add(tileKey(tile)));

  const openings = new Set(map.walls.openings.map(tileKey));
  const wallTiles = map.walls.regions.flatMap((region) => pointsInRect(region)
    .filter((point) => !openings.has(tileKey(point)))
    .map((tile, index) => ({ id: `${region.id}-${index}`, sprite: region.sprite, tile })));

  for (const interaction of map.interactions) {
    if (blockedKeys.has(tileKey(interaction.targetTile))) {
      throw new Error(`Interaction ${interaction.id} targets a blocked tile.`);
    }
  }
  for (const stagingTile of map.stagingTiles) {
    if (blockedKeys.has(tileKey(stagingTile))) throw new Error('A staging tile is blocked.');
  }
  for (const portal of map.portals) {
    if (blockedKeys.has(tileKey(portal.tile))) throw new Error(`Portal ${portal.id} is blocked.`);
  }
  for (const door of map.doors) {
    if (blockedKeys.has(tileKey(door.tile))) throw new Error(`Door ${door.id} is blocked.`);
  }
  for (const [id, spawn] of Object.entries(map.spawns)) {
    if (blockedKeys.has(tileKey(spawn))) throw new Error(`Spawn ${id} is blocked.`);
  }
  return { source: map, groundSprites, blockedKeys, wallTiles };
}

export function groundSpriteAt(map: CompiledMap, tile: TilePoint): string {
  const sprite = map.groundSprites[tile.y * map.source.width + tile.x];
  if (!sprite) throw new Error('Ground tile is outside the compiled map.');
  return sprite;
}

export function spawnAt(map: CompiledMap, id: string): TilePoint {
  const spawn = map.source.spawns[id];
  if (!spawn) throw new Error(`Map ${map.source.id} has no ${id} spawn.`);
  return spawn;
}

export function roofGroupAt(map: CompiledMap, tile: TilePoint): string | undefined {
  return map.source.roofGroups.find(({ id, interior }) => (
    (tile.x >= interior.x && tile.x < interior.x + interior.width &&
      tile.y >= interior.y && tile.y < interior.y + interior.height) ||
    map.source.doors.some((door) => door.roofGroupId === id && tileKey(door.tile) === tileKey(tile))
  ))?.id;
}
