export type AtmospherePeriod = 'dawn' | 'day' | 'dusk' | 'night';

export type WorldAtmosphere = Readonly<{
  period: AtmospherePeriod;
  wash: string;
  shade: string;
  accent: string;
}>;

export function worldAtmosphere(absoluteMinute: number): WorldAtmosphere {
  const minute = ((absoluteMinute % 1_440) + 1_440) % 1_440;
  if (minute < 300 || minute >= 1_260) {
    return { period: 'night', wash: '#18294430', shade: '#090b12a6', accent: '#9edbd8' };
  }
  if (minute < 570) {
    return { period: 'dawn', wash: '#f0a45f24', shade: '#38203338', accent: '#ffd27a' };
  }
  if (minute < 1_020) {
    return { period: 'day', wash: '#f8d58a0d', shade: '#27352224', accent: '#fff1ad' };
  }
  return { period: 'dusk', wash: '#c55f3030', shade: '#24142c45', accent: '#ffbd74' };
}

export function mapEffectVisible(kind: string, absoluteMinute: number): boolean {
  const period = worldAtmosphere(absoluteMinute).period;
  return kind !== 'neon' || period === 'dusk' || period === 'night';
}
