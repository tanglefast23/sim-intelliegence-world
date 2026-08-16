import type { MapId } from '../world/maps/catalog';
import { worldAtmosphere } from './atmosphere';

export type DistrictLightPool = Readonly<{ radius: number; x: number; y: number }>;

export type DistrictLighting = Readonly<{
  accent: string;
  casters: readonly Readonly<{ x: number; y: number }>[];
  name: string;
  /**
   * Additive glow drawn at each lamp sprite. Kept well above poolOpacity because additive light
   * on a lit floor needs real strength to read, and a lamp that is on should look on in daylight.
   */
  lampGlowOpacity: number;
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
    casters: [{ x: 17, y: 24 }, { x: 27, y: 32 }, { x: 53, y: 39 }],
    intensity: 1,
    name: 'SUNWARD AMBER',
    shelterShade: '#18274433',
    pools: [
      { x: 27, y: 32, radius: 52 },
      { x: 41, y: 27, radius: 46 },
      { x: 51, y: 39, radius: 48 },
    ],
  },
  northeast_downtown: {
    accent: '#ff5f9f',
    casters: [{ x: 16, y: 20 }, { x: 41, y: 20 }, { x: 43, y: 41 }],
    intensity: 1,
    name: 'NEON ROSE',
    shadowColor: '#29265358',
    shelterShade: '#2023443d',
    pools: [
      { x: 19, y: 20, radius: 50 },
      { x: 50, y: 20, radius: 46 },
      { x: 48, y: 41, radius: 48 },
    ],
  },
  southwest_commercial: {
    accent: '#ffd06a',
    casters: [{ x: 12, y: 32 }, { x: 20, y: 32 }, { x: 49, y: 43 }],
    intensity: 0.95,
    name: 'SAFFRON LANTERN',
    shadowColor: '#26386466',
    shelterShade: '#1830504d',
    pools: [
      { x: 12, y: 37, radius: 44 },
      { x: 21, y: 35, radius: 48 },
      { x: 49, y: 43, radius: 46 },
    ],
  },
  southeast_docks: {
    accent: '#67d3ce',
    casters: [{ x: 17, y: 20 }, { x: 44, y: 20 }, { x: 49, y: 34 }],
    intensity: 1,
    name: 'HARBOR TEAL',
    shadowColor: '#21324958',
    shelterShade: '#13343f42',
    pools: [
      { x: 17, y: 20, radius: 48 },
      { x: 44, y: 20, radius: 46 },
      { x: 49, y: 34, radius: 50 },
    ],
  },
};

export function districtLighting(mapId: MapId, absoluteMinute: number): DistrictLighting {
  const { intensity, shadowColor = '#25285852', ...district } = DISTRICTS[mapId];
  const period = worldAtmosphere(absoluteMinute).period;
  if (period === 'dusk') {
    return { ...district, lampGlowOpacity: 0.55 * intensity, poolOpacity: 0.2 * intensity, shadow: { color: shadowColor, x: 23, y: 10 } };
  }
  if (period === 'night') {
    return { ...district, lampGlowOpacity: 0.7 * intensity, poolOpacity: 0.28 * intensity, shadow: { color: '#090b1252', x: 5, y: 4 } };
  }
  if (period === 'dawn') {
    return { ...district, lampGlowOpacity: 0.5 * intensity, poolOpacity: 0.13 * intensity, shadow: { color: '#2f213f52', x: -16, y: 8 } };
  }
  return { ...district, lampGlowOpacity: 0.34 * intensity, poolOpacity: 0.04 * intensity, shadow: { color: '#28332230', x: 5, y: 3 } };
}
