import type { WorldMapV2Catalog } from '../../world/maps/catalog';

export const EXPECTED_VFX_ANCHORS = Object.freeze([
  Object.freeze({ mapId: 'northeast_downtown', id: 'club-sparkle', kind: 'sparkle', x: 19, y: 11 }),
  Object.freeze({ mapId: 'northeast_downtown', id: 'market-sparkle', kind: 'sparkle', x: 45, y: 34 }),
  Object.freeze({ mapId: 'northwest_residential', id: 'beach-sparkle', kind: 'sparkle', x: 50, y: 40 }),
  Object.freeze({ mapId: 'northwest_residential', id: 'patio-fire', kind: 'fire', x: 27, y: 32 }),
] as const);

export function catalogueVfxAnchors(catalog: WorldMapV2Catalog) {
  return Object.values(catalog).flatMap((map) => map.source.effects.map((effect) => ({
    mapId: map.source.id,
    id: effect.id,
    kind: effect.kind,
    x: effect.tile.x,
    y: effect.tile.y,
  }))).sort((left, right) => (
    left.mapId.localeCompare(right.mapId, 'en') || left.id.localeCompare(right.id, 'en')
  ));
}
