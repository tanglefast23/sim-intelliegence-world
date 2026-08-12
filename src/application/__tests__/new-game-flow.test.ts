import { normalizePlayerName } from '../new-game-name';

describe('new game flow', () => {
  test.each([
    ['  Mistake  ', 'Mistake'],
    ['Joe   Mac', 'Joe Mac'],
    ['\tIsland\nGuest\t', 'Island Guest'],
  ])('normalizes a player-facing name without changing the stable ID', (source, expected) => {
    expect(normalizePlayerName(source)).toBe(expected);
  });

  test('caps a name at the state contract limit', () => {
    expect(normalizePlayerName('A'.repeat(40))).toHaveLength(32);
  });
});
