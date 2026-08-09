import type { ClockState } from './clock';

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function addPauseToken(
  clock: ClockState,
  token: string,
): Readonly<{ clock: ClockState; changed: boolean }> {
  if (clock.pauseTokens.includes(token)) {
    return { clock: { ...clock, pauseTokens: [...clock.pauseTokens] }, changed: false };
  }
  return {
    clock: { ...clock, pauseTokens: [...clock.pauseTokens, token].sort(compareAscii) },
    changed: true,
  };
}

export function removePauseToken(
  clock: ClockState,
  token: string,
): Readonly<{ clock: ClockState; changed: boolean }> {
  const nextTokens = clock.pauseTokens.filter((candidate) => candidate !== token);
  return {
    clock: { ...clock, pauseTokens: nextTokens },
    changed: nextTokens.length !== clock.pauseTokens.length,
  };
}
