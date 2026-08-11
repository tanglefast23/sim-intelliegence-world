export type AtlasPackInput = Readonly<{
  id: string;
  width: number;
  height: number;
}>;

export type AtlasPackPlacement = Readonly<{
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  outerX: number;
  outerY: number;
  outerWidth: number;
  outerHeight: number;
}>;

export type AtlasPackResult = Readonly<{
  width: number;
  height: number;
  placements: readonly AtlasPackPlacement[];
}>;

export type AtlasPackOptions = Readonly<{
  maximumWidth: number;
  maximumHeight: number;
  gutter: number;
  candidateWidths?: readonly number[];
}>;

function validateInputs(inputs: readonly AtlasPackInput[], options: AtlasPackOptions): void {
  const ids = inputs.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) throw new Error('Atlas pack IDs must be unique.');
  for (const value of [options.maximumWidth, options.maximumHeight]) {
    if (!Number.isInteger(value) || value <= 0) throw new Error('Atlas limits must be positive integers.');
  }
  if (!Number.isInteger(options.gutter) || options.gutter < 0) {
    throw new Error('Atlas gutter must be a nonnegative integer.');
  }
  for (const input of inputs) {
    if (!Number.isInteger(input.width) || !Number.isInteger(input.height) || input.width <= 0 || input.height <= 0) {
      throw new Error(`Atlas cell ${input.id} must have positive integer dimensions.`);
    }
  }
}

/**
 * Stable order: taller outer rectangles first, then wider rectangles, then the
 * Unicode code-point order of the public or internal ID. This order is part of
 * the generated-art contract.
 */
export function stableAtlasPackOrder(inputs: readonly AtlasPackInput[], gutter: number): AtlasPackInput[] {
  return [...inputs].sort((left, right) => {
    const heightDifference = (right.height + gutter * 2) - (left.height + gutter * 2);
    if (heightDifference !== 0) return heightDifference;
    const widthDifference = (right.width + gutter * 2) - (left.width + gutter * 2);
    if (widthDifference !== 0) return widthDifference;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
}

function packAtWidth(
  ordered: readonly AtlasPackInput[],
  width: number,
  maximumHeight: number,
  gutter: number,
): AtlasPackResult | null {
  let x = 0;
  let y = 0;
  let shelfHeight = 0;
  const placements: AtlasPackPlacement[] = [];
  for (const input of ordered) {
    const outerWidth = input.width + gutter * 2;
    const outerHeight = input.height + gutter * 2;
    if (outerWidth > width || outerHeight > maximumHeight) return null;
    if (x + outerWidth > width) {
      x = 0;
      y += shelfHeight;
      shelfHeight = 0;
    }
    if (y + outerHeight > maximumHeight) return null;
    placements.push({
      id: input.id,
      x: x + gutter,
      y: y + gutter,
      width: input.width,
      height: input.height,
      outerX: x,
      outerY: y,
      outerWidth,
      outerHeight,
    });
    x += outerWidth;
    shelfHeight = Math.max(shelfHeight, outerHeight);
  }
  return { width, height: y + shelfHeight, placements };
}

export function packAtlasRectangles(
  inputs: readonly AtlasPackInput[],
  options: AtlasPackOptions,
): AtlasPackResult {
  validateInputs(inputs, options);
  if (inputs.length === 0) return { width: 1, height: 1, placements: [] };
  const ordered = stableAtlasPackOrder(inputs, options.gutter);
  const defaultCandidates = [64, 128, 256, 512, options.maximumWidth];
  const candidates = [...new Set(options.candidateWidths ?? defaultCandidates)]
    .filter((width) => Number.isInteger(width) && width > 0 && width <= options.maximumWidth)
    .sort((left, right) => left - right);
  const results = candidates
    .map((width) => packAtWidth(ordered, width, options.maximumHeight, options.gutter))
    .filter((result): result is AtlasPackResult => result !== null && result.height > 0);
  if (results.length === 0) {
    throw new Error(`Atlas cells exceed the ${options.maximumWidth}x${options.maximumHeight} limit.`);
  }
  return results.sort((left, right) => {
    const areaDifference = left.width * left.height - right.width * right.height;
    if (areaDifference !== 0) return areaDifference;
    if (left.height !== right.height) return left.height - right.height;
    return left.width - right.width;
  })[0] as AtlasPackResult;
}
