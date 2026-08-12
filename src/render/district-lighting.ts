import type { MapId } from '../world/maps/catalog';
import { worldAtmosphere } from './atmosphere';

export type DistrictLightPool = Readonly<{ radius: number; x: number; y: number }>;

export type DistrictLighting = Readonly<{
  accent: string;
  casters: readonly Readonly<{ x: number; y: number }>[];
  name: string;
  poolOpacity: number;
  pools: readonly DistrictLightPool[];
  shadow: Readonly<{ color: string; x: number; y: number }>;
  shelterShade: string;
}>;

type DistrictPreset = Pick<DistrictLighting, 'accent' | 'casters' | 'name' | 'pools' | 'shelterShade'> & Readonly<{
  intensity: number;
  shadowColor?: string;
}>;

const DISTRICTS: Readonly<Record<MapId, DistrictPreset>> = {
  northwest_residential: {
    accent: '#ffc45c',
    casters: [{ x: 13, y: 20 }, { x: 22, y: 16 }, { x: 38, y: 9 }],
    intensity: 1,
    name: 'SUNWARD AMBER',
    shelterShade: '#18274433',
    pools: [
      { x: 18, y: 21, radius: 82 },
      { x: 31, y: 12, radius: 72 },
      { x: 39, y: 27, radius: 76 },
    ],
  },
  northeast_downtown: {
    accent: '#ff5f9f',
    casters: [{ x: 11, y: 20 }, { x: 41, y: 20 }, { x: 40, y: 41 }],
    intensity: 1,
    name: 'NEON ROSE',
    shadowColor: '#29265358',
    shelterShade: '#2023443d',
    pools: [
      { x: 19, y: 19, radius: 78 },
      { x: 49, y: 19, radius: 72 },
      { x: 48, y: 40, radius: 76 },
    ],
  },
  southwest_commercial: {
    accent: '#ffd06a',
    casters: [{ x: 14, y: 21 }, { x: 28, y: 6 }, { x: 22, y: 32 }],
    intensity: 0.95,
    name: 'SAFFRON LANTERN',
    shadowColor: '#26386466',
    shelterShade: '#1830504d',
    pools: [
      { x: 17, y: 21, radius: 72 },
      { x: 49, y: 21, radius: 70 },
      { x: 22, y: 33, radius: 82 },
    ],
  },
  southeast_docks: {
    accent: '#67d3ce',
    casters: [{ x: 16, y: 19 }, { x: 43, y: 19 }, { x: 42, y: 40 }],
    intensity: 1,
    name: 'HARBOR TEAL',
    shadowColor: '#21324958',
    shelterShade: '#13343f42',
    pools: [
      { x: 17, y: 19, radius: 74 },
      { x: 44, y: 19, radius: 70 },
      { x: 43, y: 40, radius: 80 },
    ],
  },
};

export function districtLighting(mapId: MapId, absoluteMinute: number): DistrictLighting {
  const { intensity, shadowColor = '#25285852', ...district } = DISTRICTS[mapId];
  const period = worldAtmosphere(absoluteMinute).period;
  if (period === 'dusk') {
    return { ...district, poolOpacity: 0.2 * intensity, shadow: { color: shadowColor, x: 23, y: 10 } };
  }
  if (period === 'night') {
    return { ...district, poolOpacity: 0.28 * intensity, shadow: { color: '#090b1252', x: 5, y: 4 } };
  }
  if (period === 'dawn') {
    return { ...district, poolOpacity: 0.13 * intensity, shadow: { color: '#2f213f52', x: -16, y: 8 } };
  }
  return { ...district, poolOpacity: 0.04 * intensity, shadow: { color: '#28332230', x: 5, y: 3 } };
}
