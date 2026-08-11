import { findPath } from '../pathfinding/astar';
import { compileArtPresentation } from '../presentation/art-presentation';
import type { VisualBounds } from '../presentation/recipes';
import type {
  CompiledDoorV2,
  CompiledInteractionV2,
  CompiledMapV2,
  CompiledObjectPartV2,
  CompiledRoofGroupV2,
  CompiledWallCellV2,
  CompiledWallOpeningV2,
  StaticSolidOwner,
} from './compiled-v2';
import { measureAndValidateDensity } from './density';
import { compileLocationBindings } from './location-bindings';
import {
  WorldMapV2Schema,
  pointsInRect,
  tileKey,
  type TileOffset,
  type TilePoint,
  type TileRect,
  type WorldMapV2,
} from './schema';

export type CompileWorldMapV2Options = Readonly<{
  knownLocationIds: ReadonlySet<string>;
  knownSprites?: ReadonlySet<string>;
  visualBoundsBySprite?: Readonly<Record<string, VisualBounds>>;
  validateDensity?: boolean;
}>;

const CARDINALS: readonly TileOffset[] = [
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
];

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function tileOrder(left: TilePoint, right: TilePoint): number {
  return left.y - right.y || left.x - right.x;
}

function tileFromKey(key: string): TilePoint {
  const [x, y] = key.split(',').map(Number);
  if (!Number.isInteger(x) || !Number.isInteger(y)) throw new Error(`Invalid compiled tile key: ${key}`);
  return { x: x!, y: y! };
}

function assertUnique(label: string, ids: readonly string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`${label} IDs must be unique: ${id}`);
    seen.add(id);
  }
}

function isInside(tile: TilePoint, bounds: TileRect): boolean {
  return tile.x >= bounds.x && tile.x < bounds.x + bounds.width &&
    tile.y >= bounds.y && tile.y < bounds.y + bounds.height;
}

function absoluteTile(anchor: TilePoint, offset: TileOffset, label: string): TilePoint {
  const tile = { x: anchor.x + offset.x, y: anchor.y + offset.y };
  if (tile.x < 0 || tile.y < 0 || tile.x >= 64 || tile.y >= 48) {
    throw new Error(`${label} is outside the 64x48 map.`);
  }
  return tile;
}

function relativeRectPoints(anchor: TilePoint, bounds: Readonly<TileOffset & { width: number; height: number }>, label: string): TilePoint[] {
  const start = absoluteTile(anchor, bounds, label);
  if (start.x + bounds.width > 64 || start.y + bounds.height > 48) {
    throw new Error(`${label} is outside the 64x48 map.`);
  }
  return pointsInRect({ ...start, width: bounds.width, height: bounds.height });
}

function addOwner(
  owners: Map<string, StaticSolidOwner>,
  tile: TilePoint,
  owner: StaticSolidOwner,
): void {
  const key = tileKey(tile);
  const existing = owners.get(key);
  if (existing) {
    throw new Error(`Static solid ${owner.kind}/${owner.id} overlaps ${existing.kind}/${existing.id} at ${key}.`);
  }
  owners.set(key, owner);
}

function assertEdgePortal(portal: WorldMapV2['portals'][number]): void {
  const valid =
    (portal.edge === 'north' && portal.tile.y === 0) ||
    (portal.edge === 'east' && portal.tile.x === 63) ||
    (portal.edge === 'south' && portal.tile.y === 47) ||
    (portal.edge === 'west' && portal.tile.x === 0);
  if (!valid) throw new Error(`Portal ${portal.id} is not on its declared edge.`);
}

function wallSprite(material: string, adjacencyMask: number): string {
  return `tile.wall-${material}-${adjacencyMask.toString(16)}`;
}

function buildGroundSprites(map: WorldMapV2): string[] {
  const sprites = Array.from({ length: map.width * map.height }, () => map.ground.defaultSprite);
  for (const region of map.ground.regions) {
    for (const point of pointsInRect(region)) sprites[point.y * map.width + point.x] = region.sprite;
  }
  return sprites;
}

function compileWalls(
  map: WorldMapV2,
  owners: Map<string, StaticSolidOwner>,
): Readonly<{
  wallTiles: readonly CompiledWallCellV2[];
  openingById: ReadonlyMap<string, CompiledWallOpeningV2>;
}> {
  const rawCells: Readonly<{ id: string; runId: string; material: string; tile: TilePoint }>[] = [];
  const openingById = new Map<string, CompiledWallOpeningV2>();
  for (const run of [...map.walls.runs].sort((left, right) => compareAscii(left.id, right.id))) {
    if (run.bounds.width > 1 && run.bounds.height > 1) {
      throw new Error(`Wall run ${run.id} must be one cell thick.`);
    }
    if (run.bounds.width === 1 && run.bounds.height === 1 && run.openings.length > 0) {
      throw new Error(`One-cell wall run ${run.id} cannot own an opening because its axis is undefined.`);
    }
    assertUnique(`Wall ${run.id} opening`, run.openings.map(({ id }) => id));
    const openingKeys = new Set<string>();
    for (const opening of run.openings) {
      if (!isInside(opening.tile, run.bounds)) throw new Error(`Wall opening ${opening.id} is outside run ${run.id}.`);
      if (openingById.has(opening.id)) throw new Error(`Wall opening IDs must be unique: ${opening.id}`);
      openingKeys.add(tileKey(opening.tile));
      openingById.set(opening.id, { ...opening, runId: run.id, material: run.material });
    }
    pointsInRect(run.bounds).forEach((tile, index) => {
      if (openingKeys.has(tileKey(tile))) return;
      addOwner(owners, tile, { kind: 'wall', id: run.id });
      rawCells.push({ id: `${run.id}-${index}`, runId: run.id, material: run.material, tile });
    });
  }
  const wallKeys = new Set(rawCells.map(({ tile }) => tileKey(tile)));
  const wallTiles = rawCells.map((cell) => {
    const north = wallKeys.has(`${cell.tile.x},${cell.tile.y - 1}`) ? 1 : 0;
    const east = wallKeys.has(`${cell.tile.x + 1},${cell.tile.y}`) ? 2 : 0;
    const south = wallKeys.has(`${cell.tile.x},${cell.tile.y + 1}`) ? 4 : 0;
    const west = wallKeys.has(`${cell.tile.x - 1},${cell.tile.y}`) ? 8 : 0;
    const adjacencyMask = north | east | south | west;
    return { ...cell, adjacencyMask, sprite: wallSprite(cell.material, adjacencyMask) };
  }).sort((left, right) => tileOrder(left.tile, right.tile) || compareAscii(left.id, right.id));
  return { wallTiles, openingById };
}

function compileRoofs(map: WorldMapV2): ReadonlyMap<string, CompiledRoofGroupV2> {
  const result = new Map<string, CompiledRoofGroupV2>();
  for (const roof of [...map.roofGroups].sort((left, right) => compareAscii(left.id, right.id))) {
    if (result.has(roof.id)) throw new Error(`Roof group IDs must be unique: ${roof.id}`);
    const cellKeys = new Set(roof.cells.flatMap(pointsInRect).map(tileKey));
    const interiorKeys = new Set(roof.interiorCells.flatMap(pointsInRect).map(tileKey));
    for (const key of interiorKeys) {
      if (!cellKeys.has(key)) throw new Error(`Roof group ${roof.id} does not cover interior cell ${key}.`);
    }
    result.set(roof.id, { id: roof.id, cellKeys, interiorKeys });
  }
  return result;
}

function compileObjects(input: Readonly<{
  map: WorldMapV2;
  areaById: ReadonlyMap<string, WorldMapV2['areas'][number]>;
  owners: Map<string, StaticSolidOwner>;
}>): Readonly<{
  parts: readonly CompiledObjectPartV2[];
  partById: ReadonlyMap<string, CompiledObjectPartV2>;
  partOwnersByTile: ReadonlyMap<string, readonly string[]>;
  interactions: readonly CompiledInteractionV2[];
}> {
  const { map, areaById, owners } = input;
  const parts: CompiledObjectPartV2[] = [];
  const partById = new Map<string, CompiledObjectPartV2>();
  const partOwnersByTile = new Map<string, string[]>();
  const interactions: CompiledInteractionV2[] = [];
  const interactionIds = new Set<string>();
  for (const object of [...map.objects].sort((left, right) => compareAscii(left.id, right.id))) {
    if (!areaById.has(object.areaId)) throw new Error(`Object ${object.id} references unknown area ${object.areaId}.`);
    assertUnique(`Object ${object.id} part`, object.renderParts.map(({ id }) => id));
    assertUnique(`Object ${object.id} footprint`, object.solidFootprints.map(({ id }) => id));
    const depthAnchor = absoluteTile(object.anchor, object.depthAnchorOffset, `Object ${object.id} depth anchor`);
    for (const part of [...object.renderParts].sort((left, right) => compareAscii(left.id, right.id))) {
      if (partById.has(part.id)) throw new Error(`Object part IDs must be unique: ${part.id}`);
      const tile = absoluteTile(object.anchor, part.offset, `Object part ${part.id}`);
      const compiled = { id: part.id, objectId: object.id, sprite: part.sprite, tile, depthAnchor };
      parts.push(compiled);
      partById.set(part.id, compiled);
      const key = tileKey(tile);
      const ownersAtTile = partOwnersByTile.get(key) ?? [];
      ownersAtTile.push(object.id);
      partOwnersByTile.set(key, ownersAtTile);
    }
    const solidKeys = new Set<string>();
    for (const footprint of [...object.solidFootprints].sort((left, right) => compareAscii(left.id, right.id))) {
      for (const tile of relativeRectPoints(object.anchor, footprint.bounds, `Object footprint ${object.id}/${footprint.id}`)) {
        const key = tileKey(tile);
        if (solidKeys.has(key)) throw new Error(`Object ${object.id} has overlapping footprints at ${key}.`);
        solidKeys.add(key);
        addOwner(owners, tile, { kind: 'object', id: object.id });
      }
    }
    const visibleKeys = new Set(object.renderParts.map(({ id }) => tileKey(partById.get(id)!.tile)));
    for (const key of solidKeys) {
      if (!visibleKeys.has(key)) throw new Error(`Object ${object.id} has an invisible solid cell at ${key}.`);
    }
    for (const interaction of [...object.interactions].sort((left, right) => compareAscii(left.id, right.id))) {
      if (interactionIds.has(interaction.id)) throw new Error(`Interaction IDs must be unique: ${interaction.id}`);
      interactionIds.add(interaction.id);
      const approachTiles = interaction.approachOffsets
        .map((offset) => absoluteTile(object.anchor, offset, `Interaction ${interaction.id} approach`))
        .sort(tileOrder);
      interactions.push({
        id: interaction.id,
        kind: interaction.kind,
        ownerKind: 'object',
        ownerId: object.id,
        areaId: object.areaId,
        approachTiles,
      });
    }
  }
  parts.sort((left, right) => (
    tileOrder(left.depthAnchor, right.depthAnchor) || compareAscii(left.objectId, right.objectId) ||
    tileOrder(left.tile, right.tile) || compareAscii(left.id, right.id)
  ));
  const stablePartById = new Map(parts.map((part) => [part.id, part]));
  const stablePartOwnersByTile = new Map([...partOwnersByTile]
    .sort(([left], [right]) => compareAscii(left, right))
    .map(([key, ownerIds]) => [key, [...new Set(ownerIds)].sort(compareAscii)]));
  return { parts, partById: stablePartById, partOwnersByTile: stablePartOwnersByTile, interactions };
}

function compileDoors(input: Readonly<{
  map: WorldMapV2;
  openings: ReadonlyMap<string, CompiledWallOpeningV2>;
  roofs: ReadonlyMap<string, CompiledRoofGroupV2>;
  areaById: ReadonlyMap<string, WorldMapV2['areas'][number]>;
  owners: Map<string, StaticSolidOwner>;
  usedInteractionIds: Set<string>;
}>): Readonly<{
  doorById: ReadonlyMap<string, CompiledDoorV2>;
  interactions: readonly CompiledInteractionV2[];
}> {
  const { map, openings, roofs, areaById, owners, usedInteractionIds } = input;
  const doorById = new Map<string, CompiledDoorV2>();
  const interactions: CompiledInteractionV2[] = [];
  const usedOpenings = new Set<string>();
  for (const door of [...map.doors].sort((left, right) => compareAscii(left.id, right.id))) {
    if (doorById.has(door.id)) throw new Error(`Door IDs must be unique: ${door.id}`);
    if (usedOpenings.has(door.openingId)) throw new Error(`Wall opening ${door.openingId} has more than one door.`);
    const opening = openings.get(door.openingId);
    if (!opening) throw new Error(`Door ${door.id} references unknown opening ${door.openingId}.`);
    if (door.roofGroupId && !roofs.has(door.roofGroupId)) {
      throw new Error(`Door ${door.id} references unknown roof group ${door.roofGroupId}.`);
    }
    usedOpenings.add(door.openingId);
    if (door.initialState !== 'open') addOwner(owners, opening.tile, { kind: 'door', id: door.id });
    if (door.interaction) {
      if (usedInteractionIds.has(door.interaction.id)) {
        throw new Error(`Interaction IDs must be unique: ${door.interaction.id}`);
      }
      if (!areaById.has(door.interaction.areaId)) {
        throw new Error(`Door interaction ${door.interaction.id} references unknown area ${door.interaction.areaId}.`);
      }
      usedInteractionIds.add(door.interaction.id);
      interactions.push({
        id: door.interaction.id,
        kind: 'door',
        ownerKind: 'door',
        ownerId: door.id,
        areaId: door.interaction.areaId,
        approachTiles: [...door.interaction.approachTiles].sort(tileOrder),
      });
    }
    doorById.set(door.id, {
      id: door.id,
      openingId: door.openingId,
      tile: opening.tile,
      initialState: door.initialState,
      sprite: door.sprite,
      roofGroupId: door.roofGroupId,
      interactionId: door.interaction?.id,
    });
  }
  return { doorById, interactions };
}

function hasRoute(
  map: WorldMapV2,
  blockedKeys: ReadonlySet<string>,
  starts: readonly TilePoint[],
  targets: readonly TilePoint[],
): boolean {
  return starts.some((start) => targets.some((target) => findPath({
    width: map.width,
    height: map.height,
    start,
    target,
    blockedKeys,
  }).status === 'found'));
}

function validateInteractions(
  map: WorldMapV2,
  areaById: ReadonlyMap<string, WorldMapV2['areas'][number]>,
  interactionById: ReadonlyMap<string, CompiledInteractionV2>,
  blockedKeys: ReadonlySet<string>,
): void {
  for (const interaction of interactionById.values()) {
    const area = areaById.get(interaction.areaId)!;
    for (const approach of interaction.approachTiles) {
      if (blockedKeys.has(tileKey(approach))) {
        throw new Error(`Interaction ${interaction.id} approach is blocked at ${tileKey(approach)}.`);
      }
    }
    const approaches = interaction.approachTiles;
    const starts = area.entranceTiles.filter((tile) => !blockedKeys.has(tileKey(tile)));
    if (starts.length === 0 || !hasRoute(map, blockedKeys, starts, approaches)) {
      throw new Error(`Interaction ${interaction.id} is not reachable from area ${area.id}.`);
    }
  }
}

function validateDoorSides(
  map: WorldMapV2,
  openings: ReadonlyMap<string, CompiledWallOpeningV2>,
  doors: ReadonlyMap<string, CompiledDoorV2>,
  areaById: ReadonlyMap<string, WorldMapV2['areas'][number]>,
  interactions: ReadonlyMap<string, CompiledInteractionV2>,
  blockedKeys: ReadonlySet<string>,
): void {
  const runById = new Map(map.walls.runs.map((run) => [run.id, run]));
  const doorByOpeningId = new Map([...doors.values()].map((door) => [door.openingId, door]));
  for (const opening of openings.values()) {
    const run = runById.get(opening.runId)!;
    const offsets = run.bounds.width > 1
      ? [{ x: 0, y: -1 }, { x: 0, y: 1 }]
      : run.bounds.height > 1
        ? [{ x: -1, y: 0 }, { x: 1, y: 0 }]
        : [];
    if (offsets.length === 0) throw new Error(`Wall opening ${opening.id} has no defined wall axis.`);
    const sides = offsets.map((offset) => ({ x: opening.tile.x + offset.x, y: opening.tile.y + offset.y }));
    const traversalBlockers = new Set(blockedKeys);
    for (const side of sides) {
      if (side.x < 0 || side.y < 0 || side.x >= map.width || side.y >= map.height || traversalBlockers.has(tileKey(side))) {
        throw new Error(`Wall opening ${opening.id} has no walkable tile on one required side.`);
      }
    }
    const door = doorByOpeningId.get(opening.id);
    const doorInteraction = door?.interactionId ? interactions.get(door.interactionId) : undefined;
    const buildingAreaIds = map.buildings
      .filter(({ entranceOpeningIds }) => entranceOpeningIds.includes(opening.id))
      .flatMap(({ areaIds }) => areaIds);
    const requiredStarts = doorInteraction
      ? areaById.get(doorInteraction.areaId)?.entranceTiles ?? []
      : buildingAreaIds.length > 0
        ? buildingAreaIds.flatMap((id) => areaById.get(id)?.entranceTiles ?? [])
        : map.stagingTiles;
    if (!hasRoute(map, traversalBlockers, requiredStarts, sides)) {
      throw new Error(`Wall opening ${opening.id} is not reachable from its required entrance side.`);
    }
  }
}

function floodFromOutside(map: WorldMapV2, blockedKeys: ReadonlySet<string>): ReadonlySet<string> {
  const visited = new Set<string>();
  const queue: TilePoint[] = [];
  for (let x = 0; x < map.width; x += 1) queue.push({ x, y: 0 }, { x, y: map.height - 1 });
  for (let y = 1; y < map.height - 1; y += 1) queue.push({ x: 0, y }, { x: map.width - 1, y });
  queue.sort(tileOrder);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const tile = queue[cursor]!;
    const key = tileKey(tile);
    if (visited.has(key) || blockedKeys.has(key)) continue;
    visited.add(key);
    for (const offset of CARDINALS) {
      const next = { x: tile.x + offset.x, y: tile.y + offset.y };
      if (next.x < 0 || next.y < 0 || next.x >= map.width || next.y >= map.height) continue;
      const nextKey = tileKey(next);
      if (!visited.has(nextKey) && !blockedKeys.has(nextKey)) queue.push(next);
    }
  }
  return visited;
}

function validateBuildings(input: Readonly<{
  map: WorldMapV2;
  areaById: ReadonlyMap<string, WorldMapV2['areas'][number]>;
  openings: ReadonlyMap<string, CompiledWallOpeningV2>;
  roofs: ReadonlyMap<string, CompiledRoofGroupV2>;
  blockedKeys: ReadonlySet<string>;
}>): void {
  const { map, areaById, openings, roofs, blockedKeys } = input;
  const runById = new Map(map.walls.runs.map((run) => [run.id, run]));
  for (const building of map.buildings) {
    const areas = building.areaIds.map((id) => {
      const area = areaById.get(id);
      if (!area) throw new Error(`Building ${building.id} references unknown area ${id}.`);
      return area;
    });
    const roof = roofs.get(building.roofGroupId);
    if (!roof) {
      throw new Error(`Building ${building.id} references unknown roof ${building.roofGroupId}.`);
    }
    const outerRuns = building.outerWallRunIds.map((id) => {
      const run = runById.get(id);
      if (!run) throw new Error(`Building ${building.id} references unknown outer wall ${id}.`);
      return run;
    });
    const entrances = building.entranceOpeningIds.map((id) => {
      const opening = openings.get(id);
      if (!opening) throw new Error(`Building ${building.id} references unknown entrance ${id}.`);
      if (!building.outerWallRunIds.includes(opening.runId)) {
        throw new Error(`Building entrance ${id} is not in an outer wall.`);
      }
      return opening;
    });
    const shellBlocked = new Set<string>();
    for (const run of outerRuns) {
      for (const tile of pointsInRect(run.bounds)) {
        const opening = run.openings.find(({ tile: candidate }) => tileKey(candidate) === tileKey(tile));
        if (!opening || building.entranceOpeningIds.includes(opening.id)) shellBlocked.add(tileKey(tile));
      }
    }
    const outside = floodFromOutside(map, shellBlocked);
    const areaKeys = new Set(areas.flatMap(({ bounds }) => pointsInRect(bounds)).map(tileKey));
    for (const key of roof.interiorKeys) {
      if (!areaKeys.has(key)) {
        throw new Error(`Building ${building.id} roof interior ${key} is not assigned to a building area.`);
      }
    }
    const interior = [...roof.interiorKeys].map(tileFromKey).filter((tile) => !shellBlocked.has(tileKey(tile)));
    if (interior.some((tile) => outside.has(tileKey(tile)))) {
      throw new Error(`Building ${building.id} has an unintended outer-shell gap.`);
    }

    const traversalBlockers = new Set(blockedKeys);
    if (!hasRoute(map, traversalBlockers, map.stagingTiles, interior.filter((tile) => !traversalBlockers.has(tileKey(tile))))) {
      throw new Error(`Building ${building.id} has no reachable entrance.`);
    }
  }
}

function validateAreasAndRoutes(
  map: WorldMapV2,
  areaById: ReadonlyMap<string, WorldMapV2['areas'][number]>,
  portalById: ReadonlyMap<string, WorldMapV2['portals'][number]>,
  blockedKeys: ReadonlySet<string>,
): void {
  for (const area of areaById.values()) {
    if ((area.densityProfile === 'active-public' || area.densityProfile === 'service-docks') &&
      area.primaryRoutes.length === 0) {
      throw new Error(`Area ${area.id} requires a primary route.`);
    }
    for (const entrance of area.entranceTiles) {
      if (!isInside(entrance, area.bounds) || blockedKeys.has(tileKey(entrance))) {
        throw new Error(`Area ${area.id} has an invalid entrance tile.`);
      }
    }
    for (const route of area.primaryRoutes) {
      if (!isInside({ x: route.x, y: route.y }, area.bounds) ||
        !isInside({ x: route.x + route.width - 1, y: route.y + route.height - 1 }, area.bounds)) {
        throw new Error(`Area ${area.id} has a primary route outside its bounds.`);
      }
      const thickness = Math.min(route.width, route.height);
      if (area.densityProfile === 'active-public' && (thickness < 2 || thickness > 4)) {
        throw new Error(`Area ${area.id} primary routes must be 2-4 cells wide.`);
      }
      if (area.densityProfile === 'service-docks' && thickness < 2) {
        throw new Error(`Area ${area.id} service routes must be at least two cells wide.`);
      }
      if (pointsInRect(route).some((tile) => blockedKeys.has(tileKey(tile)))) {
        throw new Error(`Area ${area.id} has a blocked primary route.`);
      }
    }
    for (const portalId of area.requiredPortalIds) {
      const portal = portalById.get(portalId);
      if (!portal) throw new Error(`Area ${area.id} references unknown portal ${portalId}.`);
      if (!hasRoute(map, blockedKeys, area.entranceTiles, [portal.tile])) {
        throw new Error(`Area ${area.id} cannot reach portal ${portalId}.`);
      }
    }
  }
}

function assertKnownSprites(
  map: WorldMapV2,
  wallTiles: readonly CompiledWallCellV2[],
  knownSprites: ReadonlySet<string>,
): void {
  const sprites = [
    map.ground.defaultSprite,
    ...map.ground.regions.map(({ sprite }) => sprite),
    ...map.objects.flatMap(({ renderParts }) => renderParts.map(({ sprite }) => sprite)),
    ...map.doors.map(({ sprite }) => sprite),
    ...wallTiles.map(({ sprite }) => sprite),
  ];
  for (const sprite of sprites) {
    if (!knownSprites.has(sprite)) throw new Error(`Map references an unknown atlas sprite: ${sprite}`);
  }
}

export function compileWorldMapV2(candidate: unknown, options: CompileWorldMapV2Options): CompiledMapV2 {
  const map = WorldMapV2Schema.parse(candidate);
  assertUnique('Ground region', map.ground.regions.map(({ id }) => id));
  assertUnique('Terrain solid', map.terrainSolids.map(({ id }) => id));
  assertUnique('Wall run', map.walls.runs.map(({ id }) => id));
  assertUnique('Object', map.objects.map(({ id }) => id));
  assertUnique('Effect', map.effects.map(({ id }) => id));
  assertUnique('Area', map.areas.map(({ id }) => id));
  assertUnique('Building', map.buildings.map(({ id }) => id));
  assertUnique('Portal', map.portals.map(({ id }) => id));
  assertUnique('Staging tile', map.stagingTiles.map(tileKey));
  map.portals.forEach(assertEdgePortal);

  const areaById = new Map(map.areas.map((area) => [area.id, area]));
  const portalById = new Map(map.portals.map((portal) => [portal.id, portal]));
  const owners = new Map<string, StaticSolidOwner>();
  for (const terrain of [...map.terrainSolids].sort((left, right) => compareAscii(left.id, right.id))) {
    for (const tile of pointsInRect(terrain.bounds)) addOwner(owners, tile, { kind: 'terrain', id: terrain.id });
  }
  const { wallTiles, openingById } = compileWalls(map, owners);
  const roofGroupById = compileRoofs(map);
  const compiledObjects = compileObjects({ map, areaById, owners });
  const usedInteractionIds = new Set(compiledObjects.interactions.map(({ id }) => id));
  const compiledDoors = compileDoors({
    map,
    openings: openingById,
    roofs: roofGroupById,
    areaById,
    owners,
    usedInteractionIds,
  });
  const interactionById = new Map([...compiledObjects.interactions, ...compiledDoors.interactions]
    .sort((left, right) => compareAscii(left.id, right.id))
    .map((interaction) => [interaction.id, interaction]));
  const blockedKeys = new Set(owners.keys());

  for (const staging of map.stagingTiles) {
    if (blockedKeys.has(tileKey(staging))) throw new Error(`Staging tile ${tileKey(staging)} is blocked.`);
  }
  for (const [id, spawn] of Object.entries(map.spawns).sort(([left], [right]) => compareAscii(left, right))) {
    if (blockedKeys.has(tileKey(spawn))) throw new Error(`Spawn ${id} is blocked.`);
  }
  for (const portal of map.portals) {
    if (blockedKeys.has(tileKey(portal.tile))) throw new Error(`Portal ${portal.id} is blocked.`);
  }
  validateDoorSides(map, openingById, compiledDoors.doorById, areaById, interactionById, blockedKeys);
  validateAreasAndRoutes(map, areaById, portalById, blockedKeys);
  validateInteractions(map, areaById, interactionById, blockedKeys);
  validateBuildings({ map, areaById, openings: openingById, roofs: roofGroupById, blockedKeys });

  const locationBindingById = compileLocationBindings({
    map,
    areaById,
    interactionById,
    blockedKeys,
    knownLocationIds: options.knownLocationIds,
  });
  const densityByAreaId = options.validateDensity === false
    ? new Map()
    : measureAndValidateDensity({ map, staticSolidOwnerByTile: owners, objectParts: compiledObjects.parts });
  if (options.knownSprites) assertKnownSprites(map, wallTiles, options.knownSprites);

  const groundSprites = buildGroundSprites(map);
  const presentation = compileArtPresentation({
    map,
    groundSprites,
    visualBoundsBySprite: options.visualBoundsBySprite,
  });

  return {
    source: map,
    groundSprites,
    presentation,
    staticSolidOwnerByTile: owners,
    blockedKeys,
    wallTiles,
    wallOpeningById: openingById,
    objectPartById: compiledObjects.partById,
    partOwnersByTile: compiledObjects.partOwnersByTile,
    doorById: compiledDoors.doorById,
    interactionById,
    areaById,
    portalById,
    roofGroupById,
    locationBindingById,
    densityByAreaId,
  };
}

export function selectInteractionApproach(
  map: CompiledMapV2,
  interactionId: string,
  start: TilePoint,
  dynamicBlockers: ReadonlySet<string> = new Set(),
): TilePoint | undefined {
  const interaction = map.interactionById.get(interactionId);
  if (!interaction) throw new Error(`Unknown interaction ${interactionId}.`);
  const blockers = new Set([...map.blockedKeys, ...dynamicBlockers]);
  blockers.delete(tileKey(start));
  const candidates = interaction.approachTiles.flatMap((tile) => {
    const path = findPath({
      width: map.source.width,
      height: map.source.height,
      start,
      target: tile,
      blockedKeys: blockers,
    });
    return path.status === 'found' ? [{ tile, pathLength: path.path.length }] : [];
  });
  candidates.sort((left, right) => left.pathLength - right.pathLength || tileOrder(left.tile, right.tile));
  return candidates[0]?.tile;
}

export function selectOwnerInteractionApproach(
  map: CompiledMapV2,
  ownerId: string,
  start: TilePoint,
  dynamicBlockers: ReadonlySet<string> = new Set(),
): Readonly<{ interactionId: string; tile: TilePoint }> | undefined {
  const blockers = new Set([...map.blockedKeys, ...dynamicBlockers]);
  blockers.delete(tileKey(start));
  const candidates = [...map.interactionById.values()]
    .filter((interaction) => interaction.ownerId === ownerId)
    .flatMap((interaction) => interaction.approachTiles.flatMap((tile) => {
      const path = findPath({
        width: map.source.width,
        height: map.source.height,
        start,
        target: tile,
        blockedKeys: blockers,
      });
      return path.status === 'found'
        ? [{ interactionId: interaction.id, tile, pathLength: path.path.length }]
        : [];
    }));
  candidates.sort((left, right) => left.pathLength - right.pathLength ||
    compareAscii(left.interactionId, right.interactionId) || tileOrder(left.tile, right.tile));
  const selected = candidates[0];
  return selected ? { interactionId: selected.interactionId, tile: selected.tile } : undefined;
}
