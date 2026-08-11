import {
  HFM_PILOT_LOOKS,
  HFM_PILOT_PORTRAIT_CELL,
  HFM_PILOT_WORLD_CELL,
  makePilotPortraitGrid,
  makePilotWorldGrid,
} from '../hfm-character-pilot';

function silhouette(rows: readonly string[]): string {
  return rows.map((row) => [...row].map((token) => token === '.' ? '.' : '#').join('')).join('\n');
}

function garmentSpan(row: string): number {
  const garmentTokens = new Set(['c', 'C', 'E', 'a', 'A', 'W']);
  const columns = [...row].flatMap((token, x) => garmentTokens.has(token) ? [x] : []);
  if (columns.length === 0) return 0;
  return Math.max(...columns) - Math.min(...columns) + 1;
}

describe('HFM geometry character pilot', () => {
  test('limits the pilot to five non-production identities', () => {
    expect(HFM_PILOT_LOOKS.map(({ id }) => id)).toEqual([
      'protagonist',
      'linda',
      'devon-price',
      'mina-park',
      'rafael-cruz',
    ]);
  });

  test.each(HFM_PILOT_LOOKS.map((look) => [look.id, look] as const))(
    '%s uses exact HFM cells and one shared head geometry',
    (_id, look) => {
      const portrait = makePilotPortraitGrid(look, 'rest');
      const world = makePilotWorldGrid(look, 0);
      expect(portrait).toHaveLength(HFM_PILOT_PORTRAIT_CELL.height);
      expect(world).toHaveLength(HFM_PILOT_WORLD_CELL.height);
      expect(portrait.every((row) => row.length === HFM_PILOT_PORTRAIT_CELL.width)).toBe(true);
      expect(world.every((row) => row.length === HFM_PILOT_WORLD_CELL.width)).toBe(true);
      expect(portrait.slice(0, 15)).toEqual(world.slice(0, 15));
    },
  );

  test.each(HFM_PILOT_LOOKS.map((look) => [look.id, look] as const))(
    '%s has stepped portrait shoulders instead of a square bust',
    (_id, look) => {
      const portrait = makePilotPortraitGrid(look, 'rest');
      expect(garmentSpan(portrait[16] as string)).toBeLessThan(garmentSpan(portrait[17] as string));
      expect(garmentSpan(portrait[17] as string)).toBeLessThan(garmentSpan(portrait[19] as string));
    },
  );

  test.each(HFM_PILOT_LOOKS.map((look) => [look.id, look] as const))(
    '%s keeps separate legs, feet, and visible arm or hand pixels',
    (_id, look) => {
      const world = makePilotWorldGrid(look, 0);
      expect(world[26]?.slice(9, 11)).not.toBe('..');
      expect(world[26]?.slice(13, 15)).not.toBe('..');
      expect(world[29]?.slice(8, 11)).not.toBe('...');
      expect(world[29]?.slice(13, 16)).not.toBe('...');
      const sideSkin = world.slice(18, 23).join('').split('').filter((token) => token === 'S' || token === 's');
      expect(sideSkin.length).toBeGreaterThanOrEqual(2);
    },
  );

  test('gives all five pilots distinct silhouettes', () => {
    const signatures = HFM_PILOT_LOOKS.map((look) => silhouette(makePilotWorldGrid(look, 0)));
    expect(new Set(signatures).size).toBe(HFM_PILOT_LOOKS.length);
  });

  test.each(HFM_PILOT_LOOKS.map((look) => [look.id, look] as const))(
    '%s keeps all portrait expressions distinct',
    (_id, look) => {
      const rest = makePilotPortraitGrid(look, 'rest');
      const joy = makePilotPortraitGrid(look, 'joy');
      const upset = makePilotPortraitGrid(look, 'upset');
      expect(rest).not.toEqual(joy);
      expect(rest).not.toEqual(upset);
      expect(joy).not.toEqual(upset);
    },
  );
});
