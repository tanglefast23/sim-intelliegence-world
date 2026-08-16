import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PNG } from 'pngjs';

const spikeRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(spikeRoot, '../..');
function sampledColors(image, minimumX, maximumX) {
  const colors = new Set();
  for (let y = 100; y < image.height; y += 4) {
    for (let x = minimumX; x < maximumX; x += 4) {
      colors.add(image.data.readUInt32BE((y * image.width + x) * 4));
    }
  }
  return colors.size;
}

const threePackage = JSON.parse(await readFile(join(repoRoot, 'node_modules/three/package.json'), 'utf8'));
if (threePackage.version !== '0.185.1') throw new Error(`Unexpected Three.js version: ${threePackage.version}.`);

for (const comparison of [
  { file: 'comparison.png', width: 1420, height: 810, regions: [[30, 670], [700, 1340]] },
  { file: 'comparison-three-way.png', width: 1920, height: 760, regions: [[20, 620], [636, 1236], [1252, 1852]] },
]) {
  const image = PNG.sync.read(await readFile(join(spikeRoot, comparison.file)));
  const colors = comparison.regions.map(([minimumX, maximumX]) => sampledColors(image, minimumX, maximumX));
  if (image.width !== comparison.width || image.height !== comparison.height || colors.some((count) => count < 150)) {
    throw new Error(`Invalid ${comparison.file}: ${image.width}x${image.height}, colors ${colors.join('/')}.`);
  }
  console.log(`Three.js pixel-villa check passed: ${comparison.file}, ${image.width}x${image.height}, colors ${colors.join('/')}.`);
}
