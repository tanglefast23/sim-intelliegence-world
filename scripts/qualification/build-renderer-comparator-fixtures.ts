import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { PNG } from 'pngjs';

const WIDTH = 32;
const HEIGHT = 32;
const MASK_PIXEL = 4 * WIDTH + 4;

function baseImage(): PNG {
  const image = new PNG({ width: WIDTH, height: HEIGHT });
  for (let offset = 0; offset < image.data.length; offset += 4) {
    image.data[offset] = 48;
    image.data[offset + 1] = 48;
    image.data[offset + 2] = 48;
    image.data[offset + 3] = 255;
  }
  const offset = MASK_PIXEL * 4;
  image.data[offset] = 220;
  image.data[offset + 1] = 220;
  image.data[offset + 2] = 220;
  return image;
}

export function rendererComparatorFixturePngs(): Readonly<Record<string, Buffer>> {
  const baseline = baseImage();
  const identical = PNG.sync.read(PNG.sync.write(baseline));
  const parityChanged = PNG.sync.read(PNG.sync.write(baseline));
  parityChanged.data[MASK_PIXEL * 4] = 211;
  for (let pixel = 10; pixel < 16; pixel += 1) parityChanged.data[pixel * 4] = 51;
  const enhancedChanged = PNG.sync.read(PNG.sync.write(baseline));
  enhancedChanged.data[MASK_PIXEL * 4] = 48;
  enhancedChanged.data[MASK_PIXEL * 4 + 1] = 48;
  enhancedChanged.data[MASK_PIXEL * 4 + 2] = 48;
  const baselineBytes = PNG.sync.write(baseline);
  const identicalBytes = PNG.sync.write(identical);
  const zoomFixtures = Object.fromEntries(
    Array.from({ length: 41 }, (_, index) => (1 + index * 0.05).toFixed(2))
      .flatMap((zoom) => [
        [`zoom-sampling/${zoom}-baseline.png`, baselineBytes],
        [`zoom-sampling/${zoom}-candidate.png`, identicalBytes],
      ]),
  );
  return {
    'comparator-baseline.png': baselineBytes,
    'comparator-identical.png': identicalBytes,
    'comparator-parity-changed.png': PNG.sync.write(parityChanged),
    'comparator-enhanced-changed.png': PNG.sync.write(enhancedChanged),
    ...zoomFixtures,
  };
}

function main(): void {
  const output = resolve('tests/fixtures/rendering');
  mkdirSync(output, { recursive: true });
  for (const [name, bytes] of Object.entries(rendererComparatorFixturePngs())) {
    const destination = resolve(output, name);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, bytes, { flush: true });
  }
  process.stdout.write('Renderer comparator PNG fixtures generated.\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
