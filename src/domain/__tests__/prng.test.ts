import { createPrng } from '../prng';

function take(count: number, seed = 0x51_57_0a_1d): number[] {
  const prng = createPrng(seed);
  return Array.from({ length: count }, () => prng.nextUint32());
}

describe('deterministic PRNG', () => {
  test('the same seed creates byte-identical output', () => {
    const first = JSON.stringify(take(128));
    const second = JSON.stringify(take(128));

    expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
  });

  test('a saved cursor resumes the exact sequence', () => {
    const original = createPrng(42);
    Array.from({ length: 17 }, () => original.nextUint32());
    const saved = original.snapshot();
    const expected = Array.from({ length: 20 }, () => original.nextUint32());

    const restored = createPrng(JSON.parse(JSON.stringify(saved)));
    const actual = Array.from({ length: 20 }, () => restored.nextUint32());

    expect(actual).toEqual(expected);
  });

  test('integer samples remain inside the requested range', () => {
    const prng = createPrng(7);
    const samples = Array.from({ length: 1_000 }, () => prng.nextInt(9));

    expect(samples.every((sample) => sample >= 0 && sample < 9)).toBe(true);
  });

  test('invalid saved state fails explicitly', () => {
    expect(() => createPrng({ version: 'mulberry32-v1', cursor: -1 })).toThrow(
      'unsigned 32-bit integer',
    );
  });
});
