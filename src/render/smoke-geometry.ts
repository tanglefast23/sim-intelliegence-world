import { roofGroupAtV2, type CompiledMapV2 } from '../world/maps/compiled-v2';
import { tileKey, type TilePoint } from '../world/maps/schema';
import { findPath } from '../world/pathfinding/astar';

type StableTile = Readonly<{ id: string; tile: TilePoint }>;

export type SmokeGeometryEvidence = Readonly<{
  schemaVersion: 1;
  mapId: string;
  map: Readonly<{ widthTiles: number; heightTiles: number; tileSize: number }>;
  start: Readonly<{
    protagonist: TilePoint;
    cameraAnchor: TilePoint;
    movementTarget: TilePoint;
  }>;
  blockedSolid: Readonly<{ id: string; kind: 'wall' | 'object'; tile: TilePoint }>;
  openDoor: StableTile;
  interaction: Readonly<{
    id: string;
    ownerId: string;
    ownerKind: 'object' | 'door';
    approachTiles: readonly TilePoint[];
  }>;
  portals: readonly StableTile[];
  locations: readonly Readonly<{ id: string; candidateTiles: readonly TilePoint[] }>[];
  roof: Readonly<{ id: string; interiorTile: TilePoint; exteriorTile: TilePoint }>;
}>;

function compareTile(left: TilePoint, right: TilePoint): number {
  return left.y - right.y || left.x - right.x;
}

function requireFirst<T>(values: readonly T[], label: string): T {
  const value = values[0];
  if (!value) throw new Error(`Smoke geometry requires ${label}.`);
  return value;
}

function movementTarget(map: CompiledMapV2, start: TilePoint): TilePoint {
  const binding = map.locationBindingById.get('protagonist_villa');
  const candidates = [...(binding?.candidateTiles ?? [])]
    .filter((tile) => tile.x !== start.x || tile.y !== start.y)
    .sort((left, right) => {
      const leftDistance = Math.abs(left.x - start.x) + Math.abs(left.y - start.y);
      const rightDistance = Math.abs(right.x - start.x) + Math.abs(right.y - start.y);
      return leftDistance - rightDistance || compareTile(left, right);
    });
  return requireFirst(candidates, 'a protagonist-villa movement target');
}

function nearestReachableExterior(map: CompiledMapV2, start: TilePoint): TilePoint {
  const spawnKeys = new Set(Object.values(map.source.spawns).map(tileKey));
  const candidates: TilePoint[] = [];
  for (let y = 0; y < map.source.height; y += 1) {
    for (let x = 0; x < map.source.width; x += 1) {
      const tile = { x, y };
      const key = tileKey(tile);
      if (!map.blockedKeys.has(key) && !spawnKeys.has(key) && !roofGroupAtV2(map, tile)) candidates.push(tile);
    }
  }
  candidates.sort((left, right) => {
    const leftDistance = Math.abs(left.x - start.x) + Math.abs(left.y - start.y);
    const rightDistance = Math.abs(right.x - start.x) + Math.abs(right.y - start.y);
    return leftDistance - rightDistance || compareTile(left, right);
  });
  for (const candidate of candidates) {
    const path = findPath({
      width: map.source.width,
      height: map.source.height,
      start,
      target: candidate,
      blockedKeys: map.blockedKeys,
    });
    if (path.status === 'found') return candidate;
  }
  throw new Error('Smoke geometry requires a reachable exterior tile.');
}

export function buildSmokeGeometryEvidence(map: CompiledMapV2): SmokeGeometryEvidence {
  const protagonist = map.source.spawns.protagonist;
  const cameraAnchor = map.source.startComposition?.cameraAnchor;
  if (!protagonist || !cameraAnchor) throw new Error('Smoke geometry requires the declared start composition.');

  const blockedOwners = [...map.staticSolidOwnerByTile.entries()]
    .map(([key, owner]) => {
      const [x, y] = key.split(',').map(Number);
      return { id: owner.id, kind: owner.kind, tile: { x: x!, y: y! } };
    })
    .filter((owner): owner is Readonly<{ id: string; kind: 'wall' | 'object'; tile: TilePoint }> =>
      owner.kind === 'wall' || owner.kind === 'object')
    .sort((left, right) => left.kind.localeCompare(right.kind, 'en') || left.id.localeCompare(right.id, 'en') || compareTile(left.tile, right.tile));
  const blockedSolid = requireFirst(blockedOwners, 'a wall or object solid');
  const openDoor = requireFirst(
    [...map.doorById.values()]
      .filter(({ initialState }) => initialState === 'open')
      .sort((left, right) => left.id.localeCompare(right.id, 'en'))
      .map(({ id, tile }) => ({ id, tile })),
    'an open door',
  );
  const interaction = requireFirst(
    [...map.interactionById.values()]
      .filter(({ approachTiles }) => approachTiles.length > 0)
      .sort((left, right) => left.id.localeCompare(right.id, 'en')),
    'an interaction with an approach tile',
  );
  const roof = requireFirst(
    [...map.roofGroupById.values()]
      .sort((left, right) => left.id.localeCompare(right.id, 'en'))
      .map(({ id, interiorKeys }) => {
        const interiorTiles = [...interiorKeys].map((key) => {
          const [x, y] = key.split(',').map(Number);
          return { x: x!, y: y! };
        }).sort(compareTile);
        return { id, interiorTile: requireFirst(interiorTiles, `an interior tile for roof ${id}`) };
      }),
    'a roof group',
  );
  return {
    schemaVersion: 1,
    mapId: map.source.id,
    map: {
      widthTiles: map.source.width,
      heightTiles: map.source.height,
      tileSize: map.source.tileSize,
    },
    start: { protagonist, cameraAnchor, movementTarget: movementTarget(map, protagonist) },
    blockedSolid,
    openDoor,
    interaction: {
      id: interaction.id,
      ownerId: interaction.ownerId,
      ownerKind: interaction.ownerKind,
      approachTiles: interaction.approachTiles,
    },
    portals: [...map.portalById.values()]
      .sort((left, right) => left.id.localeCompare(right.id, 'en'))
      .map(({ id, tile }) => ({ id, tile })),
    locations: [...map.locationBindingById.values()]
      .sort((left, right) => left.locationId.localeCompare(right.locationId, 'en'))
      .map(({ locationId, candidateTiles }) => ({ id: locationId, candidateTiles })),
    roof: { ...roof, exteriorTile: nearestReachableExterior(map, protagonist) },
  };
}
