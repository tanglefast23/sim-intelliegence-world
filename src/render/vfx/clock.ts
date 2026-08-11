import {
  VFX_MAX_DELTA_MILLISECONDS,
  type AmbientVfxClock,
  type AmbientVfxClockInput,
} from './types';

export const INITIAL_AMBIENT_VFX_CLOCK: AmbientVfxClock = Object.freeze({
  ageMilliseconds: 0,
  frameActive: false,
  lastSubmittedDeltaMilliseconds: 0,
});

export function advanceAmbientVfxClock(
  state: AmbientVfxClock,
  deltaMilliseconds: number,
  input: AmbientVfxClockInput,
): AmbientVfxClock {
  if (!Number.isFinite(deltaMilliseconds) || deltaMilliseconds < 0) {
    throw new Error('A VFX frame delta must be a finite non-negative number.');
  }
  if (!input.running) {
    return Object.freeze({
      ageMilliseconds: state.ageMilliseconds,
      frameActive: false,
      lastSubmittedDeltaMilliseconds: 0,
    });
  }
  if (!state.frameActive || input.resumedFromSuspension === true) {
    return Object.freeze({
      ageMilliseconds: state.ageMilliseconds,
      frameActive: true,
      lastSubmittedDeltaMilliseconds: 0,
    });
  }
  const submitted = Math.min(deltaMilliseconds, VFX_MAX_DELTA_MILLISECONDS);
  return Object.freeze({
    ageMilliseconds: state.ageMilliseconds + submitted,
    frameActive: true,
    lastSubmittedDeltaMilliseconds: submitted,
  });
}
