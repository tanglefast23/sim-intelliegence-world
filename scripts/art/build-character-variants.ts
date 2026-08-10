import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { PRODUCTION_FULL_AI_CAST } from '../../src/domain/state/production-cast';

type Command = Readonly<Record<string, unknown>>;
type CharacterSource = {
  id: string;
  displayName: string;
  palette: Record<string, string>;
  sourceLayers: { hair: { commands: Command[] }; accessory: { commands: Command[] } };
  portraitLayers: { hair: { commands: Command[] }; accessory: { commands: Command[] } };
};

const VARIANTS = {
  mina_park: { skin: ['#d7a276', '#9b664b'], hair: ['#28242d', '#514353'], clothes: ['#8f5f83', '#5d3d56', '#d5a6c6'], style: 'long' },
  rafael_cruz: { skin: ['#b9794f', '#805039'], hair: ['#34251f', '#70513e'], clothes: ['#bd5c3e', '#7b392c', '#efb458'], style: 'crop' },
  sora_tan: { skin: ['#e2b08a', '#a87358'], hair: ['#181923', '#4e4f69'], clothes: ['#3b8c8a', '#225b60', '#e6bd5c'], style: 'bob' },
  devon_price: { skin: ['#8f593d', '#643b2d'], hair: ['#17161b', '#4b4146'], clothes: ['#713d7e', '#45284f', '#c180c7'], style: 'fade' },
  priya_nair: { skin: ['#a96545', '#73422f'], hair: ['#242029', '#5a4656'], clothes: ['#e7e1d4', '#9ca6ae', '#4aa2a4'], style: 'bun' },
  tomas_reed: { skin: ['#d0a074', '#93694e'], hair: ['#5a514b', '#91877f'], clothes: ['#436982', '#2a465c', '#d5b15f'], style: 'part' },
  elise_moreau: { skin: ['#e1ad88', '#a8755c'], hair: ['#8c3e2d', '#d47754'], clothes: ['#bf8f33', '#795c25', '#f0ce6d'], style: 'wave' },
} as const;

const WORLD_HAIR: Record<string, Command[]> = {
  long: [
    { kind: 'rect', token: 'K', x: 6, y: 2, width: 12, height: 5 },
    { kind: 'rect', token: 'H', x: 7, y: 3, width: 10, height: 4 },
    { kind: 'rect', token: 'H', x: 5, y: 6, width: 3, height: 11 },
    { kind: 'rect', token: 'H', x: 16, y: 6, width: 3, height: 11 },
  ],
  crop: [
    { kind: 'rect', token: 'K', x: 6, y: 3, width: 12, height: 4 },
    { kind: 'rect', token: 'H', x: 7, y: 4, width: 10, height: 3 },
    { kind: 'pixels', token: 'h', points: [[8, 3], [10, 3], [12, 3], [14, 3], [16, 3]] },
  ],
  bob: [
    { kind: 'rect', token: 'K', x: 5, y: 2, width: 14, height: 7 },
    { kind: 'rect', token: 'H', x: 6, y: 3, width: 12, height: 6 },
    { kind: 'rect', token: 'H', x: 5, y: 8, width: 3, height: 7 },
    { kind: 'rect', token: 'H', x: 16, y: 8, width: 3, height: 7 },
  ],
  fade: [
    { kind: 'rect', token: 'K', x: 6, y: 4, width: 12, height: 3 },
    { kind: 'rect', token: 'H', x: 8, y: 3, width: 8, height: 3 },
  ],
  bun: [
    { kind: 'rect', token: 'K', x: 6, y: 3, width: 12, height: 4 },
    { kind: 'rect', token: 'H', x: 7, y: 4, width: 10, height: 3 },
    { kind: 'rect', token: 'K', x: 10, y: 0, width: 5, height: 4 },
    { kind: 'rect', token: 'H', x: 11, y: 1, width: 3, height: 3 },
  ],
  part: [
    { kind: 'rect', token: 'K', x: 6, y: 2, width: 12, height: 5 },
    { kind: 'rect', token: 'H', x: 7, y: 3, width: 11, height: 4 },
    { kind: 'pixels', token: 'h', points: [[8, 3], [9, 3], [10, 3], [11, 4], [12, 4]] },
  ],
  wave: [
    { kind: 'rect', token: 'K', x: 5, y: 2, width: 14, height: 5 },
    { kind: 'rect', token: 'H', x: 6, y: 3, width: 12, height: 4 },
    { kind: 'pixels', token: 'H', points: [[5, 7], [6, 8], [5, 9], [18, 7], [17, 8], [18, 9], [6, 10], [17, 10]] },
  ],
};

const PORTRAIT_HAIR: Record<string, Command[]> = {
  long: [{ kind: 'rect', token: 'K', x: 8, y: 2, width: 24, height: 11 }, { kind: 'rect', token: 'H', x: 10, y: 4, width: 20, height: 10 }, { kind: 'rect', token: 'H', x: 5, y: 11, width: 6, height: 25 }, { kind: 'rect', token: 'H', x: 29, y: 11, width: 6, height: 25 }],
  crop: [{ kind: 'rect', token: 'K', x: 8, y: 5, width: 24, height: 8 }, { kind: 'rect', token: 'H', x: 10, y: 7, width: 20, height: 6 }],
  bob: [{ kind: 'rect', token: 'K', x: 6, y: 2, width: 28, height: 15 }, { kind: 'rect', token: 'H', x: 8, y: 4, width: 24, height: 13 }, { kind: 'rect', token: 'H', x: 5, y: 15, width: 7, height: 17 }, { kind: 'rect', token: 'H', x: 28, y: 15, width: 7, height: 17 }],
  fade: [{ kind: 'rect', token: 'K', x: 8, y: 8, width: 24, height: 5 }, { kind: 'rect', token: 'H', x: 12, y: 5, width: 16, height: 7 }],
  bun: [{ kind: 'rect', token: 'K', x: 8, y: 6, width: 24, height: 7 }, { kind: 'rect', token: 'H', x: 10, y: 7, width: 20, height: 6 }, { kind: 'rect', token: 'K', x: 16, y: 0, width: 9, height: 8 }, { kind: 'rect', token: 'H', x: 18, y: 1, width: 5, height: 6 }],
  part: [{ kind: 'rect', token: 'K', x: 8, y: 3, width: 24, height: 10 }, { kind: 'rect', token: 'H', x: 10, y: 5, width: 21, height: 8 }, { kind: 'rect', token: 'h', x: 11, y: 5, width: 7, height: 2 }],
  wave: [{ kind: 'rect', token: 'K', x: 6, y: 2, width: 28, height: 11 }, { kind: 'rect', token: 'H', x: 8, y: 4, width: 24, height: 9 }, { kind: 'pixels', token: 'H', points: [[6, 13], [7, 15], [6, 17], [33, 13], [32, 15], [33, 17], [7, 19], [32, 19]] }],
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function main(): Promise<void> {
  const path = resolve(process.cwd(), 'assets/source/characters/generic-resident.json');
  const base = JSON.parse(await readFile(path, 'utf8')) as CharacterSource;
  for (const character of PRODUCTION_FULL_AI_CAST) {
    const variant = VARIANTS[character.id];
    const source = clone(base);
    source.id = character.visualId;
    source.displayName = character.displayName;
    [source.palette.S, source.palette.s] = variant.skin;
    [source.palette.H, source.palette.h] = variant.hair;
    [source.palette.C, source.palette.c, source.palette.A] = variant.clothes;
    source.sourceLayers.hair.commands = clone(WORLD_HAIR[variant.style]!);
    source.portraitLayers.hair.commands = clone(PORTRAIT_HAIR[variant.style]!);
    if (['rafael_cruz', 'devon_price', 'priya_nair', 'tomas_reed'].includes(character.id)) {
      source.sourceLayers.accessory.commands = [];
      source.portraitLayers.accessory.commands = [];
    }
    await writeFile(
      resolve(process.cwd(), 'assets/source/characters', `${character.visualId}.json`),
      `${JSON.stringify(source, null, 2)}\n`,
    );
  }
  process.stdout.write(`Built ${PRODUCTION_FULL_AI_CAST.length} layered character variants.\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`Character variant build failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
