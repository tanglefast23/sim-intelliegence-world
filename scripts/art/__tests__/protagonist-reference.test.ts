import { WORLD_CELL } from '../character-source';
import { PROTAGONIST_REFERENCE_FRAME_IDS, protagonistReferenceFrames } from '../protagonist-reference';

describe('black-haired protagonist reference frames', () => {
  const frames = protagonistReferenceFrames('protagonist')!;

  test('maps the supplied front, rear, left, and right views into all eight walking cells', () => {
    expect(Object.keys(frames)).toEqual(PROTAGONIST_REFERENCE_FRAME_IDS);
    for (const frame of Object.values(frames)) {
      expect(frame).toHaveLength(WORLD_CELL.height);
      expect(frame.every((row) => row.length === WORLD_CELL.width)).toBe(true);
      expect(frame[0]).toBe('.'.repeat(WORLD_CELL.width));
      expect(frame.every((row) => row[0] === '.' && row.at(-1) === '.')).toBe(true);
      expect(frame.join('')).toContain('H');
      expect(frame.join('')).toContain('C');
      expect(frame.join('')).toContain('A');
    }
    expect(frames['front-1']).not.toEqual(frames['rear-1']);
    expect(frames['left-1']).not.toEqual(frames['right-1']);
  });

  test('uses one stable supplied pose for both atlas cells in each direction', () => {
    for (const direction of ['front', 'rear', 'left', 'right'] as const) {
      const first = frames[`${direction}-1`];
      const second = frames[`${direction}-2`];
      expect(second).toEqual(first);
    }
  });

  test('uses identical four-pixel eyes in the front view', () => {
    for (const row of frames['front-1'].slice(13, 15)) {
      expect(row.slice(7, 11)).toBe('WKWD');
      expect(row.slice(13, 17)).toBe('WKWD');
    }
  });

  test('does not override NPC generation', () => {
    expect(protagonistReferenceFrames('linda')).toBeUndefined();
  });
});
