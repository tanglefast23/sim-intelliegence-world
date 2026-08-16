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

/**
 * The global sun, continuous across the 1440-minute day.
 *
 * The four `worldAtmosphere` periods stay exactly as they are: `mapEffectVisible` and the audio
 * policy read them, and neon must keep switching on a hard boundary. The sun is the CONTINUOUS
 * companion to those buckets, and it is what lighting, shadows and ground light read instead.
 *
 * `light` carries HUE ONLY, at a max channel of about 1. Level is `elevation`. Splitting the two
 * is what stops the night floor and the sunset warmth from fighting each other: a caller that
 * wants "dimmer" scales by elevation and a caller that wants "warmer" multiplies by light.
 */
export type WorldSun = Readonly<{
  /** 0 at night through 1 at solar noon. */
  elevation: number;
  /** Shadow displacement in world pixels for a tile-tall caster. y grows DOWN. */
  shadowX: number;
  shadowY: number;
  /** hypot(shadowX, shadowY), so no caller re-derives it. */
  shadowLength: number;
  /** Shadow tint before any district hue bias, 8-digit hex. */
  shadowColor: string;
  /** Sunlight hue, 6-digit hex. */
  light: string;
  /** 0 in full day through 1 at deep night: how much lamps own the picture. */
  lampMix: number;
}>;

const SUNRISE_MINUTE = 300;
const SUNSET_MINUTE = 1_260;

type SunKey = Readonly<{
  minute: number;
  shadowX: number;
  shadowY: number;
  shadowColor: string;
  light: string;
}>;

/**
 * Authored keyframes, not a trig model.
 *
 * A sun model with fudge factors would be longer than this table and would still have to be bent
 * back onto the art direction that already exists. The four BUCKET CENTRE keys reproduce the
 * shipped `districtLighting` shadow vectors exactly, so the day looks like itself at the four
 * moments it used to be authored for. The sunrise and sunset keys are NEW, and they are what turns
 * four steps into a sweep: first and last light rake long, solar noon flattens.
 *
 * Every key is a calibration knob. Move one and only that part of the day moves.
 */
const SUN_KEYS: readonly SunKey[] = Object.freeze([
  // night bucket centre: today's `night` shadow, exactly.
  { minute: 60, shadowX: 5, shadowY: 4, shadowColor: '#090b1252', light: '#eff2ff' },
  // first light: the longest amber rake. New.
  { minute: SUNRISE_MINUTE, shadowX: -24, shadowY: 10, shadowColor: '#2f213f52', light: '#ffe2c6' },
  // dawn bucket centre: today's `dawn` shadow, exactly.
  { minute: 435, shadowX: -16, shadowY: 8, shadowColor: '#2f213f52', light: '#ffeeda' },
  // day bucket centre: today's `day` shadow, exactly. Shortest of the six.
  { minute: 795, shadowX: 5, shadowY: 3, shadowColor: '#28332230', light: '#fffdf6' },
  // dusk bucket centre: today's `dusk` shadow, exactly.
  { minute: 1_140, shadowX: 23, shadowY: 10, shadowColor: '#25285852', light: '#ffe5cf' },
  // last light: the longest blue-shifted rake. New. Wraps back to the night key through midnight.
  { minute: SUNSET_MINUTE, shadowX: 27, shadowY: 11, shadowColor: '#25285852', light: '#fae0d3' },
]);

function hexBytes(hex: string): readonly number[] {
  const raw = hex.startsWith('#') ? hex.slice(1) : hex;
  const pairs = raw.length >= 8 ? 4 : 3;
  return Array.from({ length: pairs }, (_unused, index) => (
    Number.parseInt(raw.slice(index * 2, index * 2 + 2), 16)
  ));
}

/** Channels as 0..1 floats. Alpha is dropped, because only lit surfaces read a colour this way. */
export function hexChannels(hex: string): readonly [number, number, number] {
  const bytes = hexBytes(hex);
  return [(bytes[0] ?? 255) / 255, (bytes[1] ?? 255) / 255, (bytes[2] ?? 255) / 255];
}

/**
 * Interpolates two hex colours in sRGB byte space and returns the same width it was given.
 *
 * sRGB byte space on purpose: every colour this touches was AUTHORED as an sRGB hex literal, so
 * mixing anywhere else would move the authored endpoints. Returning a hex string is what keeps
 * every downstream consumer's type unchanged.
 */
export function mixHex(from: string, to: string, amount: number): string {
  const a = hexBytes(from);
  const b = hexBytes(to);
  return `#${a.map((value, index) => {
    const other = b[index] ?? value;
    return Math.round(value + (other - value) * amount).toString(16).padStart(2, '0');
  }).join('')}`;
}

function sunSegment(minute: number): Readonly<{ from: SunKey; to: SunKey; amount: number }> {
  const first = SUN_KEYS[0] as SunKey;
  const last = SUN_KEYS[SUN_KEYS.length - 1] as SunKey;
  // Before the first key and after the last key are the SAME segment, wrapped through midnight.
  if (minute < first.minute || minute >= last.minute) {
    const span = first.minute + 1_440 - last.minute;
    const elapsed = minute < first.minute ? minute + 1_440 - last.minute : minute - last.minute;
    return { from: last, to: first, amount: elapsed / span };
  }
  for (let index = 0; index < SUN_KEYS.length - 1; index += 1) {
    const from = SUN_KEYS[index] as SunKey;
    const to = SUN_KEYS[index + 1] as SunKey;
    if (minute < to.minute) return { from, to, amount: (minute - from.minute) / (to.minute - from.minute) };
  }
  return { from: last, to: first, amount: 0 };
}

/**
 * Sampled from `state.clock.absoluteMinute`, which is an INTEGER.
 *
 * That is why nothing here is gated on `reducedMotion`. The sun steps once per game minute — one
 * real second at speed 1 — and never per animation frame, so it introduces no new motion to
 * reduce. The atmosphere wash has always changed with the clock under the same reasoning.
 */
export function worldSun(absoluteMinute: number): WorldSun {
  const minute = ((absoluteMinute % 1_440) + 1_440) % 1_440;
  const { from, to, amount } = sunSegment(minute);
  const eased = amount * amount * (3 - 2 * amount);
  const shadowX = from.shadowX + (to.shadowX - from.shadowX) * eased;
  const shadowY = from.shadowY + (to.shadowY - from.shadowY) * eased;
  const elevation = minute >= SUNRISE_MINUTE && minute < SUNSET_MINUTE
    ? Math.sin(Math.PI * (minute - SUNRISE_MINUTE) / (SUNSET_MINUTE - SUNRISE_MINUTE))
    : 0;
  return {
    elevation,
    shadowX,
    shadowY,
    shadowLength: Math.hypot(shadowX, shadowY),
    shadowColor: mixHex(from.shadowColor, to.shadowColor, eased),
    light: mixHex(from.light, to.light, eased),
    lampMix: 1 - elevation,
  };
}
