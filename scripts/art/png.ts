import { PNG } from 'pngjs';

export type Bitmap = Readonly<{
  width: number;
  height: number;
  data: Buffer;
}>;

export type Rgba = readonly [red: number, green: number, blue: number, alpha: number];

export function createBitmap(width: number, height: number, fill: Rgba = [0, 0, 0, 0]): Bitmap {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error('Bitmap dimensions must be positive integers.');
  }
  const data = Buffer.alloc(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset] = fill[0];
    data[offset + 1] = fill[1];
    data[offset + 2] = fill[2];
    data[offset + 3] = fill[3];
  }
  return { width, height, data };
}

export function parseHexColor(source: string): Rgba {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/iu.exec(source);
  if (!match) {
    throw new Error(`Invalid RGB color: ${source}`);
  }
  return [
    Number.parseInt(match[1] as string, 16),
    Number.parseInt(match[2] as string, 16),
    Number.parseInt(match[3] as string, 16),
    255,
  ];
}

export function setPixel(bitmap: Bitmap, x: number, y: number, color: Rgba): void {
  if (x < 0 || y < 0 || x >= bitmap.width || y >= bitmap.height) {
    throw new Error(`Pixel ${x},${y} is outside ${bitmap.width}x${bitmap.height}.`);
  }
  const offset = (y * bitmap.width + x) * 4;
  bitmap.data[offset] = color[0];
  bitmap.data[offset + 1] = color[1];
  bitmap.data[offset + 2] = color[2];
  bitmap.data[offset + 3] = color[3];
}

export function fillRect(
  bitmap: Bitmap,
  x: number,
  y: number,
  width: number,
  height: number,
  color: Rgba,
): void {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      setPixel(bitmap, column, row, color);
    }
  }
}

export function blit(source: Bitmap, target: Bitmap, targetX: number, targetY: number): void {
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const sourceOffset = (y * source.width + x) * 4;
      const alpha = source.data[sourceOffset + 3] as number;
      if (alpha === 0) {
        continue;
      }
      setPixel(target, targetX + x, targetY + y, [
        source.data[sourceOffset] as number,
        source.data[sourceOffset + 1] as number,
        source.data[sourceOffset + 2] as number,
        alpha,
      ]);
    }
  }
}

function controlledPixel(source: Bitmap, x: number, y: number): Rgba {
  const offset = (y * source.width + x) * 4;
  const alpha = source.data[offset + 3] as number;
  if (alpha === 0) return [0, 0, 0, 0];
  return [
    source.data[offset] as number,
    source.data[offset + 1] as number,
    source.data[offset + 2] as number,
    alpha,
  ];
}

/** Copies the complete cell and owns every edge and corner pixel in its gutter. */
export function blitWithExtrudedGutter(
  source: Bitmap,
  target: Bitmap,
  targetX: number,
  targetY: number,
  gutter: number,
): void {
  if (!Number.isInteger(gutter) || gutter < 0) {
    throw new Error('Extruded gutter must be a nonnegative integer.');
  }
  if (
    targetX - gutter < 0 || targetY - gutter < 0 ||
    targetX + source.width + gutter > target.width ||
    targetY + source.height + gutter > target.height
  ) {
    throw new Error('Extruded cell exceeds the target bitmap.');
  }
  for (let y = -gutter; y < source.height + gutter; y += 1) {
    for (let x = -gutter; x < source.width + gutter; x += 1) {
      const sourceX = Math.max(0, Math.min(source.width - 1, x));
      const sourceY = Math.max(0, Math.min(source.height - 1, y));
      setPixel(target, targetX + x, targetY + y, controlledPixel(source, sourceX, sourceY));
    }
  }
}

export function blitScaled(
  source: Bitmap,
  target: Bitmap,
  targetX: number,
  targetY: number,
  scale: number,
): void {
  if (!Number.isInteger(scale) || scale < 1) {
    throw new Error('Pixel-art scale must be a positive integer.');
  }
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const sourceOffset = (y * source.width + x) * 4;
      const alpha = source.data[sourceOffset + 3] as number;
      if (alpha === 0) {
        continue;
      }
      fillRect(target, targetX + x * scale, targetY + y * scale, scale, scale, [
        source.data[sourceOffset] as number,
        source.data[sourceOffset + 1] as number,
        source.data[sourceOffset + 2] as number,
        alpha,
      ]);
    }
  }
}

export function encodePng(bitmap: Bitmap): Buffer {
  const png = new PNG({ width: bitmap.width, height: bitmap.height, colorType: 6, inputColorType: 6 });
  png.data = Buffer.from(bitmap.data);
  return PNG.sync.write(png, {
    colorType: 6,
    inputColorType: 6,
    bitDepth: 8,
    deflateLevel: 9,
    deflateStrategy: 3,
  });
}

export function decodePng(source: Buffer): Bitmap {
  const decoded = PNG.sync.read(source);
  return { width: decoded.width, height: decoded.height, data: Buffer.from(decoded.data) };
}
