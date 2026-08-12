import type { TokenFrame } from './character-source';

type Point = readonly [x: number, y: number];

function setToken(frame: TokenFrame, x: number, y: number, token: string): void {
  const row = [...(frame[y] as string)];
  row[x] = token;
  frame[y] = row.join('');
}

function hairPoint(mask: TokenFrame, x: number, y: number, maximumY: number): boolean {
  if (y < 0 || y > maximumY || y >= mask.length || x < 0 || x >= (mask[y]?.length ?? 0)) return false;
  return ['H', 'h', 'K'].includes(mask[y]?.[x] as string);
}

function components(mask: TokenFrame, maximumY: number): Point[][] {
  const visited = new Set<string>();
  const result: Point[][] = [];
  for (let y = 0; y <= Math.min(maximumY, mask.length - 1); y += 1) {
    for (let x = 0; x < (mask[y]?.length ?? 0); x += 1) {
      const key = `${x},${y}`;
      if (visited.has(key) || !hairPoint(mask, x, y, maximumY)) continue;
      const component: Point[] = [];
      const queue: Point[] = [[x, y]];
      visited.add(key);
      while (queue.length > 0) {
        const point = queue.shift() as Point;
        component.push(point);
        for (const [nextX, nextY] of [
          [point[0] - 1, point[1]],
          [point[0] + 1, point[1]],
          [point[0], point[1] - 1],
          [point[0], point[1] + 1],
        ] as const) {
          const nextKey = `${nextX},${nextY}`;
          if (!visited.has(nextKey) && hairPoint(mask, nextX, nextY, maximumY)) {
            visited.add(nextKey);
            queue.push([nextX, nextY]);
          }
        }
      }
      result.push(component);
    }
  }
  return result;
}

/** Replaces noise-like hair pixels with connected top-left light and lower-right shadow planes. */
export function applyConnectedHairLighting(
  frame: TokenFrame,
  mask: TokenFrame,
  maximumY = frame.length - 1,
): void {
  for (const component of components(mask, maximumY)) {
    if (component.length < 3) continue;
    for (const [x, y] of component) {
      if (['H', 'h', 'K'].includes(frame[y]?.[x] as string)) setToken(frame, x, y, 'H');
    }
    const top = Math.min(...component.map(([, y]) => y));
    const bottom = Math.max(...component.map(([, y]) => y));
    const height = bottom - top + 1;
    const pointsByRow = new Map<number, number[]>();
    for (const [x, y] of component) {
      const row = pointsByRow.get(y) ?? [];
      row.push(x);
      pointsByRow.set(y, row);
    }
    for (const [y, sourceColumns] of pointsByRow) {
      const columns = sourceColumns.sort((left, right) => left - right);
      const left = columns[0] as number;
      const right = columns.at(-1) as number;
      const width = right - left + 1;
      const highlightWidth = Math.max(1, Math.floor(width * 0.28));
      const highlightShift = Math.min(2, Math.floor((y - top) / 3));
      if (y <= top + Math.ceil(height * 0.72)) {
        for (let x = left + highlightShift; x < left + highlightShift + highlightWidth; x += 1) {
          if (component.some(([pointX, pointY]) => pointX === x && pointY === y) && frame[y]?.[x] === 'H') {
            setToken(frame, x, y, 'h');
          }
        }
      }
      if (component.length >= 12 && width >= 5 && y >= top + 1 && y <= top + Math.ceil(height * 0.55)) {
        const secondaryStart = left + Math.floor(width * 0.52) + Math.min(1, Math.floor((y - top) / 4));
        for (let x = secondaryStart; x < secondaryStart + Math.max(1, Math.floor(width * 0.16)); x += 1) {
          if (component.some(([pointX, pointY]) => pointX === x && pointY === y) && frame[y]?.[x] === 'H') {
            setToken(frame, x, y, 'h');
          }
        }
      }
      const shadowWidth = Math.max(1, Math.floor(width * 0.16));
      if (y >= top + Math.floor(height * 0.35)) {
        for (let x = right - shadowWidth + 1; x <= right; x += 1) {
          if (component.some(([pointX, pointY]) => pointX === x && pointY === y) && frame[y]?.[x] === 'H') {
            setToken(frame, x, y, 'K');
          }
        }
      }
    }
  }
}
