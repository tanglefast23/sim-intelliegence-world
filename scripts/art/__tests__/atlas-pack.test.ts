import { packAtlasRectangles, stableAtlasPackOrder } from '../atlas-pack';

const limits = { maximumWidth: 1024, maximumHeight: 1024, gutter: 1 } as const;

describe('stable atlas packer', () => {
  test('uses the documented stable order and byte-identical positions', () => {
    const cells = [
      { id: 'z', width: 32, height: 32 },
      { id: 'portrait', width: 40, height: 44 },
      { id: 'a', width: 32, height: 32 },
      { id: 'character', width: 24, height: 30 },
    ];
    expect(stableAtlasPackOrder(cells, 1).map(({ id }) => id)).toEqual(['portrait', 'a', 'z', 'character']);
    expect(packAtlasRectangles(cells, limits)).toEqual(packAtlasRectangles([...cells].reverse(), limits));
  });

  test('accepts the exact maximum and rejects a one-pixel overflow', () => {
    expect(packAtlasRectangles(
      [{ id: 'exact', width: 1024, height: 1024 }],
      { maximumWidth: 1024, maximumHeight: 1024, gutter: 0, candidateWidths: [1024] },
    )).toMatchObject({ width: 1024, height: 1024 });
    expect(() => packAtlasRectangles(
      [{ id: 'overflow', width: 1024, height: 1025 }],
      { maximumWidth: 1024, maximumHeight: 1024, gutter: 0, candidateWidths: [1024] },
    )).toThrow('1024x1024');
  });

  test('returns inner rectangles surrounded by owned one-pixel gutters', () => {
    const result = packAtlasRectangles([{ id: 'cell', width: 32, height: 32 }], limits);
    expect(result.placements[0]).toMatchObject({
      x: 1, y: 1, width: 32, height: 32,
      outerX: 0, outerY: 0, outerWidth: 34, outerHeight: 34,
    });
  });
});
