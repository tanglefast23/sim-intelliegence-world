import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { buildAtlas } from './build-world-atlas';
import { decodePng } from './png';

function rectanglePixels(
  atlas: ReturnType<typeof decodePng>,
  rectangle: Readonly<{ x: number; y: number; width: number; height: number }>,
): Buffer {
  const result = Buffer.alloc(rectangle.width * rectangle.height * 4);
  for (let row = 0; row < rectangle.height; row += 1) {
    const sourceStart = ((rectangle.y + row) * atlas.width + rectangle.x) * 4;
    atlas.data.copy(result, row * rectangle.width * 4, sourceStart, sourceStart + rectangle.width * 4);
  }
  return result;
}

function main(root = process.cwd()): void {
  const built = buildAtlas(root);
  const atlas = decodePng(built.png);
  const aggregate = createHash('sha256');
  const cells: Record<string, string> = {};
  for (const id of [...built.index.publicSpriteIds].sort()) {
    const rectangle = built.index.sprites[id];
    if (!rectangle) throw new Error(`Missing public cell ${id}.`);
    const pixels = rectanglePixels(atlas, rectangle);
    aggregate.update(`${id}\0${rectangle.width}x${rectangle.height}\0`);
    aggregate.update(pixels);
    cells[id] = createHash('sha256').update(pixels).digest('hex');
  }
  const output = resolve(root, `assets/source/art/revision-${built.index.artRevision}-pixel-hashes.json`);
  writeFileSync(output, `${JSON.stringify({
    schemaVersion: 1,
    artRevision: built.index.artRevision,
    allPublicCellsAggregateSha256: aggregate.digest('hex'),
    cells,
  }, null, 2)}\n`, { encoding: 'utf8', flush: true });
  process.stdout.write(`Art pixel baseline: ${output}\n`);
}

main();
