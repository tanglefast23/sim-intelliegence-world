import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { WORLD_MAP_CATALOG } from '../../src/application/runtime/map-catalog';
import type { MapId } from '../../src/world/maps/catalog';

export const TIER_B_MAPS = [
  { id: 'northeast_downtown', source: 'content/maps/northeast.json' },
  { id: 'southwest_commercial', source: 'content/maps/southwest.json' },
  { id: 'southeast_docks', source: 'content/maps/southeast.json' },
] as const;

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function sortedEntries<Value>(source: ReadonlyMap<string, Value>): readonly [string, Value][] {
  return [...source.entries()].sort(([left], [right]) => left.localeCompare(right, 'en'));
}

export type ContentAuthorityMapReport = Readonly<{
  mapId: string;
  mapSourceSha256: string;
  layoutRevision: number;
  placementHash: string;
  solidOwnerHash: string;
  routeHash: string;
  densityHash: string;
  interactionHash: string;
  authoritativeHash: string;
}>;

export type ContentAuthorityReport = Readonly<{
  schemaVersion: 1;
  maps: readonly ContentAuthorityMapReport[];
}>;

export function buildContentAuthorityReport(root = process.cwd()): ContentAuthorityReport {
  return Object.freeze({
    schemaVersion: 1,
    maps: Object.freeze(TIER_B_MAPS.map(({ id, source }) => {
      const map = WORLD_MAP_CATALOG[id as MapId];
      const sourceBytes = readFileSync(resolve(root, source));
      const placement = {
        areas: map.source.areas,
        buildings: map.source.buildings,
        terrainSolids: map.source.terrainSolids,
        walls: map.wallTiles.map(({ id: wallId, runId, material, tile, adjacencyMask, sprite }) => ({
          id: wallId, runId, material, tile, adjacencyMask, sprite,
        })),
        doors: sortedEntries(map.doorById),
        objectParts: sortedEntries(map.objectPartById),
        objectFootprints: map.source.objects.map(({ id: objectId, anchor, depthAnchorOffset, solidFootprints, renderParts }) => ({
          id: objectId, anchor, depthAnchorOffset, solidFootprints, renderParts,
        })),
        roofs: map.source.roofGroups,
        spawns: map.source.spawns,
      };
      const solidOwners = sortedEntries(map.staticSolidOwnerByTile);
      const routes = [...map.source.portals].sort((left, right) => left.id.localeCompare(right.id, 'en'));
      const density = sortedEntries(map.densityByAreaId);
      const interactions = sortedEntries(map.interactionById);
      const hashes = {
        placementHash: hash(placement),
        solidOwnerHash: hash(solidOwners),
        routeHash: hash(routes),
        densityHash: hash(density),
        interactionHash: hash(interactions),
      };
      return Object.freeze({
        mapId: id,
        mapSourceSha256: createHash('sha256').update(sourceBytes).digest('hex'),
        layoutRevision: map.source.layoutRevision,
        ...hashes,
        authoritativeHash: hash({ mapId: id, layoutRevision: map.source.layoutRevision, ...hashes }),
      });
    })),
  });
}
