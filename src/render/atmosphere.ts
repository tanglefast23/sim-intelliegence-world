export type AtmospherePeriod = 'dawn' | 'day' | 'dusk' | 'night';

export type WorldAtmosphere = Readonly<{
  period: AtmospherePeriod;
  wash: string;
  horizon: string;
  shade: string;
  accent: string;
}>;

export function worldAtmosphere(absoluteMinute: number): WorldAtmosphere {
  const minute = ((absoluteMinute % 1_440) + 1_440) % 1_440;
  if (minute < 300 || minute >= 1_260) {
    return { period: 'night', wash: '#18294430', horizon: '#4c4f7a1c', shade: '#090b12a6', accent: '#9edbd8' };
  }
  if (minute < 570) {
    return { period: 'dawn', wash: '#f0a45f24', horizon: '#ffd58b26', shade: '#38203338', accent: '#ffd27a' };
  }
  if (minute < 1_020) {
    return { period: 'day', wash: '#f8d58a0d', horizon: '#fff0bd12', shade: '#27352224', accent: '#fff1ad' };
  }
  return { period: 'dusk', wash: '#df784f29', horizon: '#f4ae7422', shade: '#301c343f', accent: '#ffbd74' };
}
