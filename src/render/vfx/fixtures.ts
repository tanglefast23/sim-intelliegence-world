import type { WorldMapV2Catalog } from '../../world/maps/catalog';

export const EXPECTED_VFX_ANCHORS = Object.freeze([
  Object.freeze({ mapId: 'northeast_downtown', id: 'club-insects', kind: 'insects', x: 25, y: 18 }),
  Object.freeze({ mapId: 'northeast_downtown', id: 'club-neon-east', kind: 'neon', x: 23, y: 20 }),
  Object.freeze({ mapId: 'northeast_downtown', id: 'club-neon-west', kind: 'neon', x: 15, y: 20 }),
  Object.freeze({ mapId: 'northeast_downtown', id: 'club-sparkle', kind: 'sparkle', x: 19, y: 11 }),
  Object.freeze({ mapId: 'northeast_downtown', id: 'market-sparkle', kind: 'sparkle', x: 45, y: 34 }),
  Object.freeze({ mapId: 'northwest_residential', id: 'beach-sparkle', kind: 'sparkle', x: 50, y: 40 }),
  Object.freeze({ mapId: 'northwest_residential', id: 'garden-insects', kind: 'insects', x: 31, y: 26 }),
  Object.freeze({ mapId: 'northwest_residential', id: 'patio-fire', kind: 'fire', x: 27, y: 32 }),
  Object.freeze({ mapId: 'northwest_residential', id: 'patio-leaves', kind: 'leaves', x: 30, y: 30 }),
  Object.freeze({ mapId: 'northwest_residential', id: 'patio-palm', kind: 'palm', x: 35, y: 31 }),
  Object.freeze({ mapId: 'northwest_residential', id: 'patio-water-glint', kind: 'water', x: 25, y: 29 }),
  Object.freeze({ mapId: 'southeast_docks', id: 'harbor-water-glint', kind: 'water', x: 55, y: 34 }),
  Object.freeze({ mapId: 'southeast_docks', id: 'yard-insects', kind: 'insects', x: 27, y: 32 }),
  Object.freeze({ mapId: 'southeast_docks', id: 'yard-steam', kind: 'steam', x: 21, y: 32 }),
  Object.freeze({ mapId: 'southwest_commercial', id: 'courtyard-insects', kind: 'insects', x: 25, y: 35 }),
  Object.freeze({ mapId: 'southwest_commercial', id: 'courtyard-steam-east', kind: 'steam', x: 19, y: 36 }),
  Object.freeze({ mapId: 'southwest_commercial', id: 'courtyard-steam-west', kind: 'steam', x: 12, y: 34 }),
  Object.freeze({ mapId: 'southwest_commercial', id: 'courtyard-water-glint', kind: 'water', x: 22, y: 32 }),
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
