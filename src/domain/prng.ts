import { PRNG_VERSION } from './version';

const UINT32_RANGE = 0x1_0000_0000;

export type PrngState = Readonly<{
  version: typeof PRNG_VERSION;
  cursor: number;
}>;

export type DeterministicPrng = Readonly<{
  nextUint32: () => number;
  nextFloat: () => number;
  nextInt: (exclusiveMaximum: number) => number;
  snapshot: () => PrngState;
}>;

function normalizeCursor(cursor: number): number {
  if (!Number.isSafeInteger(cursor) || cursor < 0 || cursor > 0xffff_ffff) {
    throw new RangeError('PRNG cursor must be an unsigned 32-bit integer.');
  }

  return cursor >>> 0;
}

export function createPrng(seedOrState: number | PrngState): DeterministicPrng {
  let cursor =
    typeof seedOrState === 'number'
      ? normalizeCursor(seedOrState)
      : restoreCursor(seedOrState);

  const nextUint32 = (): number => {
    cursor = (cursor + 0x6d2b_79f5) >>> 0;
    let mixed = cursor;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return (mixed ^ (mixed >>> 14)) >>> 0;
  };

  return {
    nextUint32,
    nextFloat: () => nextUint32() / UINT32_RANGE,
    nextInt: (exclusiveMaximum: number) => {
      if (!Number.isSafeInteger(exclusiveMaximum) || exclusiveMaximum <= 0) {
        throw new RangeError('PRNG exclusive maximum must be a positive integer.');
      }

      return Math.floor((nextUint32() / UINT32_RANGE) * exclusiveMaximum);
    },
    snapshot: () => ({ version: PRNG_VERSION, cursor }),
  };
}

function restoreCursor(state: PrngState): number {
  if (state.version !== PRNG_VERSION) {
    throw new Error(`Unsupported PRNG version: ${String(state.version)}`);
  }

  return normalizeCursor(state.cursor);
}
