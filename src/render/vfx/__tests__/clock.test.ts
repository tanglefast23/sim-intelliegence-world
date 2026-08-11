import { advanceAmbientVfxClock, INITIAL_AMBIENT_VFX_CLOCK } from '../clock';
import { effectiveSpeed } from '../../../domain/clock/clock';

describe('ambient VFX clock', () => {
  test('starts and resumes with a zero delta, then clamps submitted time', () => {
    const started = advanceAmbientVfxClock(INITIAL_AMBIENT_VFX_CLOCK, 16, { running: true });
    expect(started).toEqual({ ageMilliseconds: 0, frameActive: true, lastSubmittedDeltaMilliseconds: 0 });
    const advanced = advanceAmbientVfxClock(started, 80, { running: true });
    expect(advanced).toEqual({ ageMilliseconds: 50, frameActive: true, lastSubmittedDeltaMilliseconds: 50 });
    const paused = advanceAmbientVfxClock(advanced, 16, { running: false });
    expect(paused.ageMilliseconds).toBe(50);
    const resumed = advanceAmbientVfxClock(paused, 16, { running: true });
    expect(resumed).toEqual({ ageMilliseconds: 50, frameActive: true, lastSubmittedDeltaMilliseconds: 0 });
  });

  test('treats speed one, speed two, and panel-open time as the same running input', () => {
    const active = advanceAmbientVfxClock(INITIAL_AMBIENT_VFX_CLOCK, 0, { running: true });
    const speedOne = advanceAmbientVfxClock(active, 20, { running: true });
    const speedTwo = advanceAmbientVfxClock(active, 20, { running: true });
    const panelOpen = advanceAmbientVfxClock(active, 20, { running: true });
    expect(speedOne).toEqual(speedTwo);
    expect(panelOpen).toEqual(speedOne);
    const clock = { absoluteMinute: 0, subMinuteMilliseconds: 0, selectedSpeed: 2 as const, pauseTokens: [] };
    expect(effectiveSpeed(clock)).toBe(2);
    expect(effectiveSpeed({ ...clock, pauseTokens: ['pause:conversation:test'] })).toBe(0);
    expect(effectiveSpeed({ ...clock, pauseTokens: ['pause:transition:test'] })).toBe(0);
  });

  test('freezes pause-token time and drops the first frame after suspension', () => {
    const active = advanceAmbientVfxClock(INITIAL_AMBIENT_VFX_CLOCK, 0, { running: true });
    const advanced = advanceAmbientVfxClock(active, 40, { running: true });
    const pauseToken = advanceAmbientVfxClock(advanced, 5_000, { running: false });
    expect(pauseToken.ageMilliseconds).toBe(40);
    const suspended = advanceAmbientVfxClock(advanced, 5_000, {
      running: true,
      resumedFromSuspension: true,
    });
    expect(suspended).toEqual({ ageMilliseconds: 40, frameActive: true, lastSubmittedDeltaMilliseconds: 0 });
  });

  test('rejects invalid frame deltas', () => {
    expect(() => advanceAmbientVfxClock(INITIAL_AMBIENT_VFX_CLOCK, -1, { running: true })).toThrow('non-negative');
    expect(() => advanceAmbientVfxClock(INITIAL_AMBIENT_VFX_CLOCK, Number.NaN, { running: true })).toThrow('finite');
  });
});
