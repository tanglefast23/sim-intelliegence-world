import type { CharacterSource, TokenFrame } from './character-source';

const SHOE_BAND_TOP = 25;
const SOLE_FOR: Readonly<Record<string, string>> = { W: 'D' };

function paintedColumns(row: string): number[] {
  return [...row].flatMap((token, column) => token === '.' ? [] : [column]);
}

function shoeGroups(rows: readonly string[]): { start: number; end: number }[] {
  const width = rows[0]?.length ?? 0;
  const groups: { start: number; end: number }[] = [];
  for (let column = 0; column < width; column += 1) {
    const isShoe = rows.slice(SHOE_BAND_TOP).some((row) => SOLE_FOR[row[column] as string]);
    if (!isShoe) {
      continue;
    }
    const previous = groups.at(-1);
    if (previous && previous.end === column - 1) {
      previous.end = column;
    } else {
      groups.push({ start: column, end: column });
    }
  }
  return groups;
}

function bottomShoeRow(rows: readonly string[], group: { start: number; end: number }): number {
  let bottom = -1;
  for (let row = SHOE_BAND_TOP; row < rows.length; row += 1) {
    for (let column = group.start; column <= group.end; column += 1) {
      if (SOLE_FOR[rows[row]?.[column] as string]) {
        bottom = row;
      }
    }
  }
  return bottom;
}

function withRearSole(rows: readonly string[]): string[] {
  const groups = shoeGroups(rows);
  if (groups.length < 2) {
    return [...rows];
  }
  const bottoms = groups.map((group) => bottomShoeRow(rows, group));
  const nearest = Math.max(...bottoms);
  if (bottoms.every((bottom) => bottom === nearest)) {
    return [...rows];
  }
  const nearColumns = groups
    .filter((_group, index) => bottoms[index] === nearest)
    .flatMap((group) => Array.from(
      { length: group.end - group.start + 1 },
      (_unused, offset) => group.start + offset,
    ));
  return rows.map((source, row) => {
    if (row < SHOE_BAND_TOP) {
      return source;
    }
    const tokens = [...source];
    for (const column of nearColumns) {
      const sole = SOLE_FOR[tokens[column] as string];
      if (sole) {
        tokens[column] = sole;
      }
    }
    return tokens.join('');
  });
}

/**
 * SI World's self-contained build-time adaptation of HFM's rear-frame method.
 * It preserves the authored silhouette and stride, removes face/shirt-front
 * detail inside that silhouette, and exposes the near shoe sole.
 */
export function deriveRearFrame(front: readonly string[], source: CharacterSource): TokenFrame {
  const detailTokens = new Set(source.rearStyle.torsoDetailTokens);
  const rear = front.map((row, rowIndex) => {
    if (rowIndex < 4 || rowIndex > 22) {
      return row;
    }
    const columns = paintedColumns(row);
    if (columns.length < 3) {
      return row;
    }
    const first = columns[0] as number;
    const last = columns.at(-1) as number;
    const tokens = [...row];
    for (let column = first + 1; column < last; column += 1) {
      if (tokens[column] === '.') {
        continue;
      }
      if (rowIndex <= 10) {
        tokens[column] = source.rearStyle.head;
      } else if (rowIndex <= 14) {
        tokens[column] = source.rearStyle.lower;
      } else if (detailTokens.has(tokens[column] as string)) {
        tokens[column] = source.rearStyle.clothing;
      }
    }
    return tokens.join('');
  });
  return withRearSole(rear);
}
