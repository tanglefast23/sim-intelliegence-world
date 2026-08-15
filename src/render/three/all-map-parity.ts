import type { MapId } from '../../world/maps/catalog';

export type AllMapParityCase = Readonly<{
  devicePixelRatio: 1 | 1.25 | 1.5 | 2;
  effectId: string;
  id: string;
  mapId: MapId;
  viewport: Readonly<{ height: number; width: number }>;
  zoom: 1 | 2 | 3;
}>;

export const ALL_MAP_PARITY_CASES: readonly AllMapParityCase[] = Object.freeze([
  { id: 'northwest-1280x720-dpr1-zoom1', mapId: 'northwest_residential', effectId: 'patio-fire', viewport: { width: 1280, height: 720 }, devicePixelRatio: 1, zoom: 1 },
  { id: 'northeast-1440x900-dpr1-zoom2', mapId: 'northeast_downtown', effectId: 'club-neon-east', viewport: { width: 1440, height: 900 }, devicePixelRatio: 1, zoom: 2 },
  { id: 'southwest-1600x720-dpr1-zoom3', mapId: 'southwest_commercial', effectId: 'courtyard-insects', viewport: { width: 1600, height: 720 }, devicePixelRatio: 1, zoom: 3 },
  { id: 'southeast-1920x1080-dpr1-zoom1', mapId: 'southeast_docks', effectId: 'yard-steam', viewport: { width: 1920, height: 1080 }, devicePixelRatio: 1, zoom: 1 },
  { id: 'maximum-load-2560x1440-dpr1-zoom1', mapId: 'northwest_residential', effectId: 'patio-fire', viewport: { width: 2560, height: 1440 }, devicePixelRatio: 1, zoom: 1 },
  { id: 'northwest-1440x900-dpr1_25-zoom1', mapId: 'northwest_residential', effectId: 'patio-fire', viewport: { width: 1440, height: 900 }, devicePixelRatio: 1.25, zoom: 1 },
  { id: 'northeast-1600x720-dpr1_25-zoom2', mapId: 'northeast_downtown', effectId: 'club-neon-east', viewport: { width: 1600, height: 720 }, devicePixelRatio: 1.25, zoom: 2 },
  { id: 'southwest-1920x1080-dpr1_25-zoom3', mapId: 'southwest_commercial', effectId: 'courtyard-insects', viewport: { width: 1920, height: 1080 }, devicePixelRatio: 1.25, zoom: 3 },
  { id: 'southeast-2560x1440-dpr1_25-zoom1', mapId: 'southeast_docks', effectId: 'yard-steam', viewport: { width: 2560, height: 1440 }, devicePixelRatio: 1.25, zoom: 1 },
  { id: 'northwest-1600x720-dpr1_5-zoom2', mapId: 'northwest_residential', effectId: 'patio-fire', viewport: { width: 1600, height: 720 }, devicePixelRatio: 1.5, zoom: 2 },
  { id: 'northeast-1920x1080-dpr1_5-zoom3', mapId: 'northeast_downtown', effectId: 'club-neon-east', viewport: { width: 1920, height: 1080 }, devicePixelRatio: 1.5, zoom: 3 },
  { id: 'southwest-2560x1440-dpr1_5-zoom1', mapId: 'southwest_commercial', effectId: 'courtyard-insects', viewport: { width: 2560, height: 1440 }, devicePixelRatio: 1.5, zoom: 1 },
  { id: 'southeast-1280x720-dpr1_5-zoom2', mapId: 'southeast_docks', effectId: 'yard-steam', viewport: { width: 1280, height: 720 }, devicePixelRatio: 1.5, zoom: 2 },
  { id: 'northwest-1920x1080-dpr2-zoom3', mapId: 'northwest_residential', effectId: 'patio-fire', viewport: { width: 1920, height: 1080 }, devicePixelRatio: 2, zoom: 3 },
  { id: 'northeast-2560x1440-dpr2-zoom1', mapId: 'northeast_downtown', effectId: 'club-neon-east', viewport: { width: 2560, height: 1440 }, devicePixelRatio: 2, zoom: 1 },
  { id: 'southwest-1280x720-dpr2-zoom2', mapId: 'southwest_commercial', effectId: 'courtyard-insects', viewport: { width: 1280, height: 720 }, devicePixelRatio: 2, zoom: 2 },
  { id: 'southeast-1440x900-dpr2-zoom3', mapId: 'southeast_docks', effectId: 'yard-steam', viewport: { width: 1440, height: 900 }, devicePixelRatio: 2, zoom: 3 },
]);
