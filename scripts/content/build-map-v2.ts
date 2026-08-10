import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { ATLAS_INDEX } from '../../src/render/atlas';
import { buildWorldMapV2Catalog, type MapId } from '../../src/world/maps/catalog';
import type { TilePoint, WorldMapV2 } from '../../src/world/maps/schema';
import { deriveNeighborhoodRoutes } from '../../src/world/transfers/routes';

const LAYOUT_REVISION = 1;

type MapObject = WorldMapV2['objects'][number];
type ObjectTile = Readonly<{ x: number; y: number; sprite: string; solid?: boolean }>;

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function objectFromTiles(input: Readonly<{
  id: string;
  kind: string;
  areaId: string;
  tiles: readonly ObjectTile[];
  interactions?: readonly Readonly<{
    id: string;
    kind: 'bed' | 'storage' | 'social' | 'decoration';
    approachTiles: readonly TilePoint[];
  }>[];
}>): MapObject {
  const anchor = input.tiles[0];
  if (!anchor) throw new Error(`Object ${input.id} needs at least one tile.`);
  return {
    id: input.id,
    kind: input.kind,
    areaId: input.areaId,
    anchor: { x: anchor.x, y: anchor.y },
    depthAnchorOffset: {
      x: (input.tiles.at(-1)?.x ?? anchor.x) - anchor.x,
      y: (input.tiles.at(-1)?.y ?? anchor.y) - anchor.y,
    },
    renderParts: input.tiles.map((tile, index) => ({
      id: `${input.id}-part-${String(index + 1).padStart(2, '0')}`,
      sprite: tile.sprite,
      offset: { x: tile.x - anchor.x, y: tile.y - anchor.y },
    })),
    solidFootprints: input.tiles.flatMap((tile, index) => tile.solid ? [{
      id: `${input.id}-solid-${String(index + 1).padStart(2, '0')}`,
      bounds: { x: tile.x - anchor.x, y: tile.y - anchor.y, width: 1, height: 1 },
    }] : []),
    interactions: (input.interactions ?? []).map((interaction) => ({
      id: interaction.id,
      kind: interaction.kind,
      approachOffsets: interaction.approachTiles.map((tile) => ({
        x: tile.x - anchor.x,
        y: tile.y - anchor.y,
      })),
    })),
  };
}

function clusteredTiles(
  first: TilePoint,
  second: TilePoint,
  count: number,
  solidCount: number,
  sprites: readonly string[],
): ObjectTile[] {
  const firstCount = Math.ceil(count / 2);
  return Array.from({ length: count }, (_, index) => {
    const localIndex = index < firstCount ? index : index - firstCount;
    const origin = index < firstCount ? first : second;
    return {
      x: origin.x + (localIndex % 4),
      y: origin.y + Math.floor(localIndex / 4),
      sprite: sprites[index % sprites.length]!,
      solid: index < solidCount,
    };
  });
}

function placeholderArea(input: Readonly<{
  id: string;
  material: string;
  bounds: Readonly<{ x: number; y: number; width: number; height: number }>;
  locationIds: readonly string[];
  signSprite: string;
}>): Readonly<{
  area: WorldMapV2['areas'][number];
  wallRuns: WorldMapV2['walls']['runs'];
  object: MapObject;
  bindings: WorldMapV2['locationBindings'];
}> {
  const { x, y, width, height } = input.bounds;
  const openingX = x + Math.floor(width / 2);
  const object = objectFromTiles({
    id: `${input.id}-fixtures`,
    kind: 'development-fixtures',
    areaId: input.id,
    tiles: clusteredTiles(
      { x: x + 2, y: y + 2 },
      { x: x + width - 6, y: y + height - 4 },
      8,
      6,
      [input.signSprite, 'tile.fixture-lamp', 'tile.fixture-planter', 'tile.counter-left'],
    ),
  });
  return {
    area: {
      id: input.id,
      bounds: { ...input.bounds },
      densityProfile: 'structural-placeholder',
      intentionalOpenAreas: [],
      entranceTiles: [{ x: openingX, y: y + height - 2 }],
      primaryRoutes: [],
      requiredPortalIds: [],
    },
    wallRuns: [
      { id: `${input.id}-north`, material: input.material, bounds: { x, y, width, height: 1 }, openings: [] },
      {
        id: `${input.id}-south`, material: input.material,
        bounds: { x, y: y + height - 1, width, height: 1 },
        openings: [{ id: `${input.id}-entrance`, tile: { x: openingX, y: y + height - 1 } }],
      },
      { id: `${input.id}-west`, material: input.material, bounds: { x, y: y + 1, width: 1, height: height - 2 }, openings: [] },
      { id: `${input.id}-east`, material: input.material, bounds: { x: x + width - 1, y: y + 1, width: 1, height: height - 2 }, openings: [] },
    ],
    object,
    bindings: input.locationIds.map((locationId) => ({
      locationId,
      areaIds: [input.id],
      preferredInteractionIds: [],
    })),
  };
}

function commonMap(input: Readonly<{
  id: MapId;
  displayName: string;
  defaultSprite: string;
  regions: WorldMapV2['ground']['regions'];
  areas: WorldMapV2['areas'];
  wallRuns: WorldMapV2['walls']['runs'];
  objects: WorldMapV2['objects'];
  bindings: WorldMapV2['locationBindings'];
  portals: WorldMapV2['portals'];
  stagingTiles: readonly TilePoint[];
  spawns: Readonly<Record<string, TilePoint>>;
  terrainSolids?: WorldMapV2['terrainSolids'];
  effects?: WorldMapV2['effects'];
}>): WorldMapV2 {
  return {
    schemaVersion: 2,
    layoutRevision: LAYOUT_REVISION,
    id: input.id,
    displayName: input.displayName,
    width: 64,
    height: 48,
    tileSize: 32,
    ground: { defaultSprite: input.defaultSprite, regions: input.regions },
    terrainSolids: input.terrainSolids ?? [],
    walls: { runs: input.wallRuns },
    doors: [],
    objects: input.objects,
    effects: input.effects ?? [],
    roofGroups: [],
    areas: input.areas,
    buildings: [],
    locationBindings: input.bindings,
    portals: input.portals,
    stagingTiles: [...input.stagingTiles],
    spawns: { ...input.spawns },
  };
}

const RESIDENT_POSITIONS = [5, 12, 20, 30, 38, 44].flatMap((y) => [2, 4, 6, 60].map((x) => ({ x, y })));

function northwestMap(): WorldMapV2 {
  const spa = placeholderArea({
    id: 'shoreglass-spa', material: 'villa', bounds: { x: 28, y: 8, width: 8, height: 10 },
    locationIds: ['mina_spa'], signSprite: 'tile.sign-spa',
  });
  const bedroomObjects = [
    objectFromTiles({
      id: 'villa-bed', kind: 'bed', areaId: 'bedroom',
      tiles: [
        { x: 10, y: 9, sprite: 'tile.bed-head', solid: true },
        { x: 11, y: 9, sprite: 'tile.bed-foot', solid: true },
      ],
      interactions: [{ id: 'sleep-bed', kind: 'bed', approachTiles: [{ x: 10, y: 10 }] }],
    }),
    objectFromTiles({
      id: 'bedroom-storage', kind: 'storage', areaId: 'bedroom',
      tiles: [{ x: 13, y: 9, sprite: 'tile.counter-left', solid: true }],
    }),
    objectFromTiles({
      id: 'bedroom-details', kind: 'fixture', areaId: 'bedroom',
      tiles: [
        { x: 10, y: 12, sprite: 'tile.fixture-lamp' },
        { x: 13, y: 12, sprite: 'tile.fixture-planter' },
      ],
    }),
  ];
  const bathroomObjects = [
    objectFromTiles({
      id: 'bath-fixture', kind: 'bath', areaId: 'bathroom',
      tiles: [
        { x: 16, y: 9, sprite: 'tile.counter-left', solid: true },
        { x: 17, y: 9, sprite: 'tile.counter-right', solid: true },
      ],
    }),
    objectFromTiles({
      id: 'bathroom-lamp', kind: 'fixture', areaId: 'bathroom',
      tiles: [{ x: 18, y: 12, sprite: 'tile.fixture-lamp' }],
    }),
  ];
  const storageObjects = [
    objectFromTiles({
      id: 'villa-storage', kind: 'storage', areaId: 'storage',
      tiles: [
        { x: 21, y: 9, sprite: 'tile.counter-left', solid: true },
        { x: 22, y: 9, sprite: 'tile.counter-right', solid: true },
        { x: 23, y: 9, sprite: 'tile.counter-left', solid: true },
      ],
      interactions: [{ id: 'home-storage', kind: 'storage', approachTiles: [{ x: 22, y: 10 }] }],
    }),
    objectFromTiles({
      id: 'storage-details', kind: 'fixture', areaId: 'storage',
      tiles: [
        { x: 21, y: 12, sprite: 'tile.fixture-lamp' },
        { x: 23, y: 12, sprite: 'tile.fixture-planter' },
      ],
    }),
  ];
  const kitchenObjects = [
    objectFromTiles({
      id: 'kitchen-counter', kind: 'counter', areaId: 'kitchen',
      tiles: [10, 11, 12, 13].map((x, index) => ({
        x, y: 16, sprite: index % 2 === 0 ? 'tile.counter-left' : 'tile.counter-right', solid: true,
      })),
    }),
    objectFromTiles({
      id: 'kitchen-table', kind: 'table', areaId: 'kitchen',
      tiles: [
        { x: 10, y: 20, sprite: 'tile.table-left', solid: true },
        { x: 11, y: 20, sprite: 'tile.table-right', solid: true },
      ],
    }),
    objectFromTiles({
      id: 'kitchen-details', kind: 'fixture', areaId: 'kitchen',
      tiles: [
        { x: 13, y: 20, sprite: 'tile.fixture-lamp' },
        { x: 12, y: 22, sprite: 'tile.fixture-planter' },
      ],
    }),
  ];
  const socialObjects = [
    objectFromTiles({
      id: 'social-sofa', kind: 'sofa', areaId: 'social',
      tiles: [
        { x: 20, y: 18, sprite: 'tile.sofa-left', solid: true },
        { x: 21, y: 18, sprite: 'tile.sofa-right', solid: true },
      ],
      interactions: [{ id: 'social-seat', kind: 'social', approachTiles: [{ x: 19, y: 18 }] }],
    }),
    objectFromTiles({
      id: 'social-tables', kind: 'table', areaId: 'social',
      tiles: [
        { x: 18, y: 21, sprite: 'tile.table-left', solid: true },
        { x: 19, y: 21, sprite: 'tile.table-right', solid: true },
        { x: 22, y: 21, sprite: 'tile.table-left', solid: true },
        { x: 23, y: 21, sprite: 'tile.table-right', solid: true },
      ],
    }),
    objectFromTiles({
      id: 'social-counter', kind: 'counter', areaId: 'social',
      tiles: [
        { x: 17, y: 16, sprite: 'tile.counter-left', solid: true },
        { x: 18, y: 16, sprite: 'tile.counter-right', solid: true },
      ],
    }),
    objectFromTiles({
      id: 'social-details', kind: 'fixture', areaId: 'social',
      tiles: [
        { x: 22, y: 16, sprite: 'tile.fixture-lamp' },
        { x: 17, y: 22, sprite: 'tile.fixture-planter' },
        { x: 23, y: 22, sprite: 'tile.fixture-lamp' },
      ],
    }),
  ];
  const patio = objectFromTiles({
    id: 'sunward-patio-furniture', kind: 'patio-furniture', areaId: 'sunward-patio',
    tiles: [
      { x: 21, y: 26, sprite: 'tile.table-left', solid: true },
      { x: 22, y: 26, sprite: 'tile.table-right', solid: true },
      { x: 31, y: 27, sprite: 'tile.sofa-left', solid: true },
      { x: 32, y: 27, sprite: 'tile.sofa-right', solid: true },
      { x: 21, y: 31, sprite: 'tile.fixture-lamp' },
      { x: 24, y: 31, sprite: 'tile.fixture-planter' },
      { x: 27, y: 31, sprite: 'tile.fixture-lamp' },
      { x: 30, y: 31, sprite: 'tile.fixture-planter' },
      { x: 33, y: 31, sprite: 'tile.fixture-lamp' },
    ],
  });
  const promenade = objectFromTiles({
    id: 'promenade-details', kind: 'street-furniture', areaId: 'villa-promenade',
    tiles: clusteredTiles(
      { x: 38, y: 9 }, { x: 51, y: 17 }, 24, 6,
      ['tile.fixture-planter', 'tile.fixture-lamp', 'tile.sign-spa', 'tile.plant-palm'],
    ),
  });
  const market = objectFromTiles({
    id: 'beach-market-details', kind: 'market-stalls', areaId: 'beach-market',
    tiles: clusteredTiles(
      { x: 38, y: 26 }, { x: 51, y: 31 }, 16, 4,
      ['tile.sign-market', 'tile.counter-left', 'tile.counter-right', 'tile.fixture-lamp'],
    ),
  });
  const beach = objectFromTiles({
    id: 'public-beach-details', kind: 'beach-furniture', areaId: 'public-beach',
    tiles: clusteredTiles(
      { x: 36, y: 39 }, { x: 52, y: 41 }, 8, 2,
      ['tile.plant-palm', 'tile.fixture-planter', 'tile.fixture-lamp'],
    ),
  });

  const map = commonMap({
    id: 'northwest_residential', displayName: 'Sunward Villas', defaultSprite: 'tile.warm-sand',
    regions: [
      { id: 'villa-floor', x: 9, y: 8, width: 16, height: 16, sprite: 'tile.villa-floor' },
      { id: 'promenade-ground', x: 37, y: 8, width: 20, height: 14, sprite: 'tile.plaza-paver' },
      { id: 'market-ground', x: 37, y: 25, width: 20, height: 10, sprite: 'tile.boardwalk' },
      { id: 'beach-ground', x: 35, y: 38, width: 24, height: 6, sprite: 'tile.warm-sand' },
    ],
    areas: [
      { id: 'bedroom', bounds: { x: 9, y: 8, width: 7, height: 6 }, densityProfile: 'furnished-interior', intentionalOpenAreas: [], entranceTiles: [{ x: 14, y: 12 }], primaryRoutes: [], requiredPortalIds: [] },
      { id: 'bathroom', bounds: { x: 15, y: 8, width: 5, height: 6 }, densityProfile: 'furnished-interior', intentionalOpenAreas: [], entranceTiles: [{ x: 16, y: 11 }], primaryRoutes: [], requiredPortalIds: [] },
      { id: 'storage', bounds: { x: 19, y: 8, width: 6, height: 6 }, densityProfile: 'furnished-interior', intentionalOpenAreas: [], entranceTiles: [{ x: 20, y: 11 }], primaryRoutes: [], requiredPortalIds: [] },
      { id: 'kitchen', bounds: { x: 9, y: 14, width: 7, height: 10 }, densityProfile: 'furnished-interior', intentionalOpenAreas: [], entranceTiles: [{ x: 14, y: 19 }], primaryRoutes: [], requiredPortalIds: [] },
      { id: 'social', bounds: { x: 15, y: 14, width: 10, height: 10 }, densityProfile: 'furnished-interior', intentionalOpenAreas: [], entranceTiles: [{ x: 16, y: 19 }], primaryRoutes: [], requiredPortalIds: [] },
      spa.area,
      { id: 'sunward-patio', bounds: { x: 20, y: 25, width: 16, height: 10 }, densityProfile: 'relaxation-natural', intentionalOpenAreas: [], entranceTiles: [{ x: 23, y: 28 }], primaryRoutes: [], requiredPortalIds: [] },
      { id: 'villa-promenade', bounds: { x: 37, y: 8, width: 20, height: 14 }, densityProfile: 'active-public', intentionalOpenAreas: [], entranceTiles: [{ x: 46, y: 20 }], primaryRoutes: [{ x: 46, y: 8, width: 2, height: 14 }], requiredPortalIds: [] },
      { id: 'beach-market', bounds: { x: 37, y: 25, width: 20, height: 10 }, densityProfile: 'active-public', intentionalOpenAreas: [], entranceTiles: [{ x: 46, y: 34 }], primaryRoutes: [{ x: 46, y: 25, width: 2, height: 10 }], requiredPortalIds: [] },
      { id: 'public-beach', bounds: { x: 35, y: 38, width: 24, height: 6 }, densityProfile: 'relaxation-natural', intentionalOpenAreas: [], entranceTiles: [{ x: 46, y: 38 }], primaryRoutes: [], requiredPortalIds: [] },
    ],
    wallRuns: [
      { id: 'villa-north', material: 'villa', bounds: { x: 8, y: 7, width: 18, height: 1 }, openings: [] },
      { id: 'villa-south', material: 'villa', bounds: { x: 8, y: 24, width: 18, height: 1 }, openings: [{ id: 'villa-front-opening', tile: { x: 15, y: 24 } }] },
      { id: 'villa-west', material: 'villa', bounds: { x: 8, y: 8, width: 1, height: 16 }, openings: [] },
      { id: 'villa-east', material: 'villa', bounds: { x: 25, y: 8, width: 1, height: 16 }, openings: [] },
      { id: 'villa-upper-divider', material: 'villa', bounds: { x: 9, y: 14, width: 16, height: 1 }, openings: [{ id: 'bedroom-opening', tile: { x: 17, y: 14 } }, { id: 'bathroom-hall-opening', tile: { x: 18, y: 14 } }] },
      { id: 'villa-bed-bath-divider', material: 'villa', bounds: { x: 15, y: 8, width: 1, height: 6 }, openings: [{ id: 'bathroom-left-opening', tile: { x: 15, y: 11 } }] },
      { id: 'villa-bath-storage-divider', material: 'villa', bounds: { x: 19, y: 8, width: 1, height: 6 }, openings: [{ id: 'bathroom-right-opening', tile: { x: 19, y: 11 } }] },
      { id: 'villa-lower-divider', material: 'villa', bounds: { x: 15, y: 15, width: 1, height: 9 }, openings: [{ id: 'social-opening', tile: { x: 15, y: 19 } }, { id: 'villa-entry-hall-opening', tile: { x: 15, y: 23 } }] },
      ...spa.wallRuns,
    ],
    objects: [
      ...bedroomObjects, ...bathroomObjects, ...storageObjects, ...kitchenObjects, ...socialObjects,
      spa.object, patio, promenade, market, beach,
    ],
    bindings: [
      { locationId: 'protagonist_villa', areaIds: ['bedroom', 'bathroom', 'storage', 'kitchen', 'social'], preferredInteractionIds: ['social-seat'] },
      { locationId: 'linda_villa', areaIds: ['sunward-patio'], preferredInteractionIds: [] },
      ...spa.bindings,
    ],
    portals: [
      { id: 'to-downtown', edge: 'east', tile: { x: 63, y: 24 }, destinationMapId: 'northeast_downtown', destinationEntranceId: 'from-residential' },
      { id: 'to-commercial', edge: 'south', tile: { x: 32, y: 47 }, destinationMapId: 'southwest_commercial', destinationEntranceId: 'from-residential' },
    ],
    stagingTiles: [{ x: 62, y: 24 }, { x: 32, y: 46 }, { x: 16, y: 25 }],
    spawns: {
      protagonist: { x: 18, y: 18 }, linda: { x: 23, y: 28 }, generic_resident: { x: 29, y: 33 },
      linda_boyfriend: { x: 25, y: 28 }, mina_park: { x: 34, y: 15 }, rafael_cruz: { x: 27, y: 5 },
      sora_tan: { x: 27, y: 20 }, devon_price: { x: 37, y: 23 }, priya_nair: { x: 33, y: 36 },
      tomas_reed: { x: 43, y: 36 }, elise_moreau: { x: 53, y: 36 },
      'linda-home': { x: 23, y: 28 }, 'linda-relax': { x: 28, y: 30 },
      'generic-home': { x: 29, y: 33 }, 'generic-work': { x: 27, y: 28 },
      'home-visit': { x: 19, y: 18 },
      ...Object.fromEntries(RESIDENT_POSITIONS.map((tile, index) => [`resident_${String(index + 1).padStart(2, '0')}`, tile])),
    },
    effects: [
      { id: 'patio-fire', kind: 'fire', tile: { x: 27, y: 32 } },
      { id: 'beach-sparkle', kind: 'sparkle', tile: { x: 50, y: 40 } },
    ],
  });
  map.doors = [
    { id: 'villa-front-door', openingId: 'villa-front-opening', initialState: 'open', sprite: 'tile.open-door', roofGroupId: 'protagonist-villa-roof', interaction: { id: 'villa-front-door-use', areaId: 'social', approachTiles: [{ x: 16, y: 23 }, { x: 16, y: 25 }] } },
    { id: 'bedroom-door', openingId: 'bedroom-opening', initialState: 'open', sprite: 'tile.open-door', roofGroupId: 'protagonist-villa-roof' },
    { id: 'bathroom-hall-door', openingId: 'bathroom-hall-opening', initialState: 'open', sprite: 'tile.open-door', roofGroupId: 'protagonist-villa-roof' },
    { id: 'bathroom-left-door', openingId: 'bathroom-left-opening', initialState: 'open', sprite: 'tile.open-door', roofGroupId: 'protagonist-villa-roof' },
    { id: 'bathroom-right-door', openingId: 'bathroom-right-opening', initialState: 'open', sprite: 'tile.open-door', roofGroupId: 'protagonist-villa-roof' },
    { id: 'social-door', openingId: 'social-opening', initialState: 'open', sprite: 'tile.open-door', roofGroupId: 'protagonist-villa-roof' },
    { id: 'entry-hall-door', openingId: 'villa-entry-hall-opening', initialState: 'open', sprite: 'tile.open-door', roofGroupId: 'protagonist-villa-roof' },
  ];
  map.roofGroups = [{
    id: 'protagonist-villa-roof',
    cells: [{ x: 8, y: 7, width: 18, height: 18 }],
    interiorCells: [{ x: 9, y: 8, width: 16, height: 16 }],
  }];
  map.buildings = [{
    id: 'protagonist-villa',
    areaIds: ['bedroom', 'bathroom', 'storage', 'kitchen', 'social'],
    outerWallRunIds: ['villa-north', 'villa-south', 'villa-west', 'villa-east'],
    entranceOpeningIds: ['villa-front-opening'],
    roofGroupId: 'protagonist-villa-roof',
  }];
  map.startComposition = {
    cameraAnchor: { x: 23, y: 26 },
    requiredActorIds: ['protagonist', 'linda', 'generic_resident'],
    requiredDetailPartIds: [
      'social-sofa-part-01', 'social-sofa-part-02', 'social-tables-part-01', 'social-tables-part-02',
      'social-tables-part-03', 'social-tables-part-04', 'social-details-part-01', 'social-details-part-02',
      'sunward-patio-furniture-part-01', 'sunward-patio-furniture-part-02',
      'sunward-patio-furniture-part-05', 'sunward-patio-furniture-part-06',
    ],
    landmarkAreaIds: ['social', 'sunward-patio'],
  };
  return map;
}

function northeastMap(): WorldMapV2 {
  const club = placeholderArea({ id: 'club-strip', material: 'downtown', bounds: { x: 8, y: 7, width: 22, height: 13 }, locationIds: ['devon_bar'], signSprite: 'tile.sign-neon' });
  const market = placeholderArea({ id: 'night-market', material: 'downtown', bounds: { x: 38, y: 29, width: 18, height: 11 }, locationIds: ['elise_studio'], signSprite: 'tile.sign-market' });
  return commonMap({
    id: 'northeast_downtown', displayName: 'Neon Crescent', defaultSprite: 'tile.plaza-paver',
    regions: [
      { id: 'cross-street', x: 0, y: 22, width: 64, height: 5, sprite: 'tile.dark-asphalt' },
      { id: 'south-street', x: 30, y: 22, width: 5, height: 26, sprite: 'tile.dark-asphalt' },
      { id: 'club-floor', x: 8, y: 7, width: 22, height: 13, sprite: 'tile.boardwalk' },
      { id: 'market-floor', x: 38, y: 29, width: 18, height: 11, sprite: 'tile.warm-sand' },
    ],
    areas: [club.area, market.area], wallRuns: [...club.wallRuns, ...market.wallRuns],
    objects: [club.object, market.object], bindings: [...club.bindings, ...market.bindings],
    portals: [
      { id: 'from-residential', edge: 'west', tile: { x: 0, y: 24 }, destinationMapId: 'northwest_residential', destinationEntranceId: 'to-downtown' },
      { id: 'to-docks', edge: 'south', tile: { x: 32, y: 47 }, destinationMapId: 'southeast_docks', destinationEntranceId: 'from-downtown' },
    ],
    stagingTiles: [{ x: 1, y: 24 }, { x: 32, y: 46 }],
    spawns: {
      linda: { x: 18, y: 13 }, generic_resident: { x: 44, y: 34 }, devon_price: { x: 20, y: 13 },
      elise_moreau: { x: 46, y: 36 }, 'generic-meal': { x: 44, y: 34 }, 'generic-nightlife': { x: 18, y: 13 },
    },
    effects: [{ id: 'club-sparkle', kind: 'sparkle', tile: { x: 19, y: 11 } }, { id: 'bar-fire', kind: 'fire', tile: { x: 45, y: 34 } }],
  });
}

function southwestMap(): WorldMapV2 {
  const mall = placeholderArea({ id: 'shopping-mall', material: 'commercial', bounds: { x: 7, y: 9, width: 20, height: 15 }, locationIds: ['sora_boutique'], signSprite: 'tile.sign-market' });
  const restaurant = placeholderArea({ id: 'restaurant-row', material: 'commercial', bounds: { x: 38, y: 31, width: 20, height: 10 }, locationIds: ['rafael_cafe'], signSprite: 'tile.sign-market' });
  return commonMap({
    id: 'southwest_commercial', displayName: 'Palm Exchange', defaultSprite: 'tile.warm-sand',
    regions: [
      { id: 'north-road', x: 30, y: 0, width: 5, height: 48, sprite: 'tile.pale-concrete' },
      { id: 'east-road', x: 30, y: 22, width: 34, height: 5, sprite: 'tile.pale-concrete' },
      { id: 'mall-floor', x: 7, y: 9, width: 20, height: 15, sprite: 'tile.villa-floor' },
      { id: 'restaurant-floor', x: 38, y: 31, width: 20, height: 10, sprite: 'tile.boardwalk' },
    ],
    areas: [mall.area, restaurant.area], wallRuns: [...mall.wallRuns, ...restaurant.wallRuns],
    objects: [mall.object, restaurant.object], bindings: [...mall.bindings, ...restaurant.bindings],
    portals: [
      { id: 'from-residential', edge: 'north', tile: { x: 32, y: 0 }, destinationMapId: 'northwest_residential', destinationEntranceId: 'to-commercial' },
      { id: 'to-docks', edge: 'east', tile: { x: 63, y: 24 }, destinationMapId: 'southeast_docks', destinationEntranceId: 'from-commercial' },
    ],
    stagingTiles: [{ x: 32, y: 1 }, { x: 62, y: 24 }],
    spawns: {
      linda: { x: 15, y: 16 }, generic_resident: { x: 45, y: 35 }, sora_tan: { x: 20, y: 16 },
      rafael_cruz: { x: 46, y: 36 }, 'linda-shop': { x: 15, y: 16 },
    },
    effects: [{ id: 'mall-sparkle', kind: 'sparkle', tile: { x: 17, y: 16 } }],
  });
}

function southeastMap(): WorldMapV2 {
  const civic = placeholderArea({ id: 'government-yard', material: 'civic', bounds: { x: 7, y: 8, width: 20, height: 14 }, locationIds: ['priya_clinic', 'tomas_marina'], signSprite: 'tile.sign-civic' });
  const ferry = placeholderArea({ id: 'ferry-terminal', material: 'civic', bounds: { x: 34, y: 27, width: 18, height: 10 }, locationIds: ['ferry_terminal'], signSprite: 'tile.sign-civic' });
  return commonMap({
    id: 'southeast_docks', displayName: 'Harbor Authority', defaultSprite: 'tile.pale-concrete',
    regions: [
      { id: 'north-road', x: 30, y: 0, width: 5, height: 48, sprite: 'tile.plaza-paver' },
      { id: 'west-road', x: 0, y: 22, width: 35, height: 5, sprite: 'tile.plaza-paver' },
      { id: 'harbor-water', x: 52, y: 0, width: 12, height: 48, sprite: 'tile.shallow-water' },
      { id: 'government-ground', x: 7, y: 8, width: 20, height: 14, sprite: 'tile.spa-stone' },
      { id: 'ferry-pier', x: 34, y: 27, width: 18, height: 10, sprite: 'tile.boardwalk' },
    ],
    terrainSolids: [{ id: 'deep-harbor', kind: 'water', bounds: { x: 52, y: 0, width: 12, height: 48 } }],
    areas: [civic.area, ferry.area], wallRuns: [...civic.wallRuns, ...ferry.wallRuns],
    objects: [
      civic.object, ferry.object,
      objectFromTiles({ id: 'ferry-landmark', kind: 'ferry', areaId: 'ferry-terminal', tiles: [
        { x: 47, y: 34, sprite: 'tile.landmark-ferry-left' },
        { x: 48, y: 34, sprite: 'tile.landmark-ferry-right' },
      ] }),
    ],
    bindings: [...civic.bindings, ...ferry.bindings],
    portals: [
      { id: 'from-downtown', edge: 'north', tile: { x: 32, y: 0 }, destinationMapId: 'northeast_downtown', destinationEntranceId: 'to-docks' },
      { id: 'from-commercial', edge: 'west', tile: { x: 0, y: 24 }, destinationMapId: 'southwest_commercial', destinationEntranceId: 'to-docks' },
    ],
    stagingTiles: [{ x: 32, y: 1 }, { x: 1, y: 24 }],
    spawns: {
      linda: { x: 12, y: 14 }, generic_resident: { x: 39, y: 34 }, priya_nair: { x: 18, y: 15 },
      tomas_reed: { x: 42, y: 33 },
    },
    effects: [{ id: 'harbor-light', kind: 'sparkle', tile: { x: 42, y: 29 } }],
  });
}

const LOCATION_NEIGHBORHOODS = new Map<string, string>([
  ['northwest_residential', 'northwest_residential'], ['northeast_downtown', 'northeast_downtown'],
  ['southwest_commercial', 'southwest_commercial'], ['southeast_docks', 'southeast_docks'],
  ['protagonist_villa', 'northwest_residential'], ['linda_villa', 'northwest_residential'],
  ['mina_spa', 'northwest_residential'], ['devon_bar', 'northeast_downtown'],
  ['elise_studio', 'northeast_downtown'], ['rafael_cafe', 'southwest_commercial'],
  ['sora_boutique', 'southwest_commercial'], ['priya_clinic', 'southeast_docks'],
  ['tomas_marina', 'southeast_docks'], ['ferry_terminal', 'southeast_docks'],
]);

function sourceModule(valueName: string, value: unknown): string {
  return `/* Generated by scripts/content/build-map-v2.ts. */\nexport const ${valueName} = ${JSON.stringify(value, null, 2)} as const;\n`;
}

function spawn(catalog: ReturnType<typeof buildWorldMapV2Catalog>, mapId: MapId, id: string): TilePoint {
  const tile = catalog[mapId].source.spawns[id];
  if (!tile) throw new Error(`Generated layout has no ${mapId}/${id} spawn.`);
  return tile;
}

export async function buildProductionMaps(rootPath = process.cwd()): Promise<void> {
  const maps = {
    northwest_residential: northwestMap(),
    northeast_downtown: northeastMap(),
    southwest_commercial: southwestMap(),
    southeast_docks: southeastMap(),
  } as const;
  const catalog = buildWorldMapV2Catalog(maps, {
    locationNeighborhoodById: LOCATION_NEIGHBORHOODS,
    knownSprites: new Set(ATLAS_INDEX.tiles),
    validateDensity: true,
  });
  const names: Readonly<Record<MapId, string>> = {
    northwest_residential: 'northwest.json', northeast_downtown: 'northeast.json',
    southwest_commercial: 'southwest.json', southeast_docks: 'southeast.json',
  };
  await Promise.all((Object.keys(maps) as MapId[]).map((mapId) => writeFile(
    resolve(rootPath, 'content', 'maps', names[mapId]),
    `${JSON.stringify(maps[mapId], null, 2)}\n`,
  )));

  const actorLocationIds: Readonly<Record<string, string>> = {
    protagonist: 'protagonist_villa',
    linda: 'linda_villa',
    linda_boyfriend: 'linda_villa',
  };
  const actorTiles = Object.fromEntries([
    'protagonist', 'linda', 'generic_resident', 'linda_boyfriend', 'mina_park', 'rafael_cruz',
    'sora_tan', 'devon_price', 'priya_nair', 'tomas_reed', 'elise_moreau',
    ...RESIDENT_POSITIONS.map((_, index) => `resident_${String(index + 1).padStart(2, '0')}`),
  ].map((id) => [id, {
    mapId: 'northwest_residential',
    locationId: actorLocationIds[id] ?? 'northwest_residential',
    ...spawn(catalog, 'northwest_residential', id),
  }]));
  const generatedLayout = {
    layoutRevisions: Object.fromEntries((Object.keys(catalog) as MapId[]).sort(compareAscii).map((mapId) => [
      mapId, catalog[mapId].source.layoutRevision,
    ])),
    actorTiles,
    scheduleTiles: {
      linda_home: { mapId: 'northwest_residential', locationId: 'linda_villa', ...spawn(catalog, 'northwest_residential', 'linda-home') },
      linda_relax: { mapId: 'northwest_residential', locationId: 'northwest_residential', ...spawn(catalog, 'northwest_residential', 'linda-relax') },
      linda_shop: { mapId: 'southwest_commercial', locationId: 'southwest_commercial', ...spawn(catalog, 'southwest_commercial', 'linda-shop') },
      generic_home: { mapId: 'northwest_residential', locationId: 'northwest_residential', ...spawn(catalog, 'northwest_residential', 'generic-home') },
      generic_work: { mapId: 'northwest_residential', locationId: 'northwest_residential', ...spawn(catalog, 'northwest_residential', 'generic-work') },
      generic_meal: { mapId: 'northeast_downtown', locationId: 'northeast_downtown', ...spawn(catalog, 'northeast_downtown', 'generic-meal') },
      generic_nightlife: { mapId: 'northeast_downtown', locationId: 'northeast_downtown', ...spawn(catalog, 'northeast_downtown', 'generic-nightlife') },
    },
    workTiles: {
      mina_park: { mapId: 'northwest_residential', locationId: 'mina_spa', ...spawn(catalog, 'northwest_residential', 'mina_park') },
      rafael_cruz: { mapId: 'southwest_commercial', locationId: 'rafael_cafe', ...spawn(catalog, 'southwest_commercial', 'rafael_cruz') },
      sora_tan: { mapId: 'southwest_commercial', locationId: 'sora_boutique', ...spawn(catalog, 'southwest_commercial', 'sora_tan') },
      devon_price: { mapId: 'northeast_downtown', locationId: 'devon_bar', ...spawn(catalog, 'northeast_downtown', 'devon_price') },
      priya_nair: { mapId: 'southeast_docks', locationId: 'priya_clinic', ...spawn(catalog, 'southeast_docks', 'priya_nair') },
      tomas_reed: { mapId: 'southeast_docks', locationId: 'tomas_marina', ...spawn(catalog, 'southeast_docks', 'tomas_reed') },
      elise_moreau: { mapId: 'northeast_downtown', locationId: 'elise_studio', ...spawn(catalog, 'northeast_downtown', 'elise_moreau') },
    },
    homeVisitTile: { mapId: 'northwest_residential', locationId: 'protagonist_villa', ...spawn(catalog, 'northwest_residential', 'home-visit') },
  };
  await writeFile(
    resolve(rootPath, 'src', 'domain', 'state', 'generated-layout.ts'),
    sourceModule('GENERATED_LAYOUT', generatedLayout),
  );
  await writeFile(
    resolve(rootPath, 'src', 'world', 'transfers', 'generated-routes.ts'),
    sourceModule('GENERATED_NEIGHBORHOOD_ROUTES', deriveNeighborhoodRoutes(catalog)),
  );
}
