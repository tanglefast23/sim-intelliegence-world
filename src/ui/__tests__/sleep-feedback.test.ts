import { sleepCompletionFeedback } from '../sleep-feedback';

describe('sleep completion feedback', () => {
  test.each([
    ['nap', 0, 'NAP COMPLETE · +0 ENERGY'],
    ['nap', 10, 'NAP COMPLETE · +10 ENERGY'],
    ['nap', 25, 'NAP COMPLETE · +25 ENERGY'],
    ['overnight', 10, 'RESTED UNTIL 08:00 · +10 ENERGY'],
    ['overnight', 80, 'RESTED UNTIL 08:00 · +80 ENERGY'],
  ] as const)('reports the actual %s energy delta', (mode, energyDelta, expected) => {
    expect(sleepCompletionFeedback({ mode, energyDelta })).toBe(expected);
  });
});
