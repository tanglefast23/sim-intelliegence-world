import { shouldReportGameReady } from '../game-readiness';

describe('game readiness', () => {
  test('reports only playable new or active sessions', () => {
    expect(shouldReportGameReady('new')).toBe(true);
    expect(shouldReportGameReady('active')).toBe(true);
    expect(shouldReportGameReady('loading')).toBe(false);
    expect(shouldReportGameReady('failed')).toBe(false);
  });
});
