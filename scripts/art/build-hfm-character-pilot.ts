import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { resolveEvidenceOutputRoot } from '../verification/evidence-output';
import {
  HFM_PILOT_LOOKS,
  HFM_PILOT_PORTRAIT_CELL,
  HFM_PILOT_WORLD_CELL,
  renderPilotPortrait,
  renderPilotWorld,
} from './hfm-character-pilot';
import {
  blit,
  blitScaled,
  createBitmap,
  decodePng,
  encodePng,
  fillRect,
  parseHexColor,
  setPixel,
  type Bitmap,
  type Rgba,
} from './png';

const PIXEL_FONT: Readonly<Record<string, readonly string[]>> = {
  ' ': ['000', '000', '000', '000', '000'],
  '+': ['000', '010', '111', '010', '000'],
  '-': ['000', '000', '111', '000', '000'],
  A: ['010', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  C: ['011', '100', '100', '100', '011'],
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'],
  F: ['111', '100', '110', '100', '100'],
  G: ['011', '100', '101', '101', '011'],
  H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  J: ['001', '001', '001', '101', '010'],
  K: ['101', '101', '110', '101', '101'],
  L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'],
  N: ['101', '111', '111', '111', '101'],
  O: ['010', '101', '101', '101', '010'],
  P: ['110', '101', '110', '100', '100'],
  Q: ['010', '101', '101', '111', '011'],
  R: ['110', '101', '110', '101', '101'],
  S: ['011', '100', '010', '001', '110'],
  T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '111'],
  V: ['101', '101', '101', '101', '010'],
  W: ['101', '101', '111', '111', '101'],
  X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'],
  Z: ['111', '001', '010', '100', '111'],
};

function drawText(bitmap: Bitmap, source: string, x: number, y: number, color: Rgba, scale = 1): void {
  [...source.toUpperCase()].forEach((character, characterIndex) => {
    const glyph = PIXEL_FONT[character] ?? PIXEL_FONT[' '] as readonly string[];
    glyph.forEach((row, rowIndex) => {
      [...row].forEach((pixel, columnIndex) => {
        if (pixel === '1') {
          fillRect(bitmap, x + (characterIndex * 4 + columnIndex) * scale, y + rowIndex * scale, scale, scale, color);
        }
      });
    });
  });
}

function centeredText(bitmap: Bitmap, source: string, centerX: number, y: number, color: Rgba, scale = 1): void {
  const width = Math.max(0, (source.length * 4 - 1) * scale);
  drawText(bitmap, source, Math.round(centerX - width / 2), y, color, scale);
}

function border(bitmap: Bitmap, x: number, y: number, width: number, height: number, color: Rgba, size: number): void {
  fillRect(bitmap, x, y, width, size, color);
  fillRect(bitmap, x, y + height - size, width, size, color);
  fillRect(bitmap, x, y, size, height, color);
  fillRect(bitmap, x + width - size, y, size, height, color);
}

function crop(source: Bitmap, x: number, y: number, width: number, height: number): Bitmap {
  const target = createBitmap(width, height);
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      const sourceOffset = ((y + row) * source.width + x + column) * 4;
      const alpha = source.data[sourceOffset + 3] as number;
      if (alpha === 0) continue;
      setPixel(target, column, row, [
        source.data[sourceOffset] as number,
        source.data[sourceOffset + 1] as number,
        source.data[sourceOffset + 2] as number,
        alpha,
      ]);
    }
  }
  return target;
}

function buildPilotSheet(): Bitmap {
  const sheet = createBitmap(1516, 218, parseHexColor('#f4f1ea'));
  const ink = parseHexColor('#241f2e');
  const blue = parseHexColor('#2f6fc4');
  const panel = parseHexColor('#a3c8f0');
  const muted = parseHexColor('#6b6675');
  HFM_PILOT_LOOKS.forEach((look, index) => {
    const x = 22 + index * 300;
    const y = 20;
    fillRect(sheet, x, y, 290, 196, parseHexColor('#f8f6ef'));
    border(sheet, x, y, 290, 196, ink, 3);
    centeredText(sheet, look.name, x + 145, y + 10, ink, 2);
    const panelXs = [x + 12, x + 106, x + 200] as const;
    panelXs.forEach((panelX) => fillRect(sheet, panelX, y + 37, 78, 96, panel));
    blitScaled(renderPilotPortrait(look, 'rest'), sheet, panelXs[0] + 3, y + 40, 3);
    blitScaled(renderPilotPortrait(look, 'joy'), sheet, panelXs[1] + 3, y + 40, 3);
    blitScaled(renderPilotWorld(look, 0), sheet, panelXs[2] + 3, y + 40, 3);
    centeredText(sheet, look.shortFeature, x + 145, y + 143, blue);
    centeredText(sheet, 'REST', panelXs[0] + 39, y + 170, muted);
    centeredText(sheet, 'JOY', panelXs[1] + 39, y + 170, muted);
    centeredText(sheet, 'WORLD', panelXs[2] + 39, y + 170, muted);
  });
  return sheet;
}

function buildNativeSheet(): Bitmap {
  const sheet = createBitmap(700, 150, parseHexColor('#17151b'));
  const cream = parseHexColor('#f4f1ea');
  const ink = parseHexColor('#241f2e');
  const gold = parseHexColor('#f7d894');
  HFM_PILOT_LOOKS.forEach((look, index) => {
    const x = 8 + index * 138;
    fillRect(sheet, x, 8, 130, 134, index % 2 === 0 ? parseHexColor('#27252d') : cream);
    centeredText(sheet, look.name, x + 65, 16, index % 2 === 0 ? cream : ink);
    fillRect(sheet, x + 8, 34, 40, 50, index % 2 === 0 ? parseHexColor('#17151b') : parseHexColor('#a3c8f0'));
    fillRect(sheet, x + 50, 34, 40, 50, index % 2 === 0 ? cream : parseHexColor('#17151b'));
    fillRect(sheet, x + 92, 34, 30, 50, index % 2 === 0 ? parseHexColor('#17151b') : parseHexColor('#a3c8f0'));
    blit(renderPilotPortrait(look, 'rest'), sheet, x + 16, 44);
    blit(renderPilotPortrait(look, 'joy'), sheet, x + 58, 44);
    blit(renderPilotWorld(look, 0), sheet, x + 95, 43);
    centeredText(sheet, 'NATIVE 1X', x + 65, 96, index % 2 === 0 ? gold : ink);
    centeredText(sheet, look.shortFeature, x + 65, 112, index % 2 === 0 ? cream : ink);
  });
  return sheet;
}

export function writeHfmCharacterPilot(outputRoot: string, root = process.cwd()): readonly string[] {
  mkdirSync(outputRoot, { recursive: true });
  const pilot = buildPilotSheet();
  const pilotFile = 'si-hfm-pilot-contact-sheet.png';
  writeFileSync(resolve(outputRoot, pilotFile), encodePng(pilot), { flush: true });

  const native = buildNativeSheet();
  const nativeFile = 'si-hfm-pilot-native-1x.png';
  writeFileSync(resolve(outputRoot, nativeFile), encodePng(native), { flush: true });

  const referencePath = resolve(root, '../Hero_Football_Manager/art/superhero-homage-preview.png');
  const reference = decodePng(readFileSync(referencePath));
  const comparison = createBitmap(1516, 456, parseHexColor('#17151b'));
  blit(crop(reference, 0, 0, Math.min(1516, reference.width), Math.min(218, reference.height)), comparison, 0, 0);
  fillRect(comparison, 0, 218, 1516, 20, parseHexColor('#241f2e'));
  centeredText(comparison, 'HFM REFERENCE ABOVE - SI PILOT BELOW', 758, 224, parseHexColor('#f7d894'), 2);
  blit(pilot, comparison, 0, 238);
  const comparisonFile = 'hfm-vs-si-pilot.png';
  writeFileSync(resolve(outputRoot, comparisonFile), encodePng(comparison), { flush: true });

  const files = [pilotFile, nativeFile, comparisonFile] as const;
  writeFileSync(resolve(outputRoot, 'pilot-report.json'), `${JSON.stringify({
    schemaVersion: 1,
    productionAtlasChanged: false,
    worldCell: HFM_PILOT_WORLD_CELL,
    portraitCell: HFM_PILOT_PORTRAIT_CELL,
    characters: HFM_PILOT_LOOKS.map(({ id, name, feature, outfit }) => ({ id, name, feature, outfit })),
    reference: referencePath,
    files,
  }, null, 2)}\n`, { encoding: 'utf8', flush: true });
  return files;
}

function main(root = process.cwd()): void {
  const outputRoot = resolveEvidenceOutputRoot(process.argv.slice(2), {
    required: true,
    allowedRootPrefixes: ['artifacts/phase-24/art-quality'],
  }, root);
  const files = writeHfmCharacterPilot(outputRoot, root);
  process.stdout.write(`HFM character pilot: ${files.map((file) => resolve(outputRoot, file)).join(', ')}\n`);
}

try {
  main();
} catch (error: unknown) {
  process.stderr.write(`HFM character pilot failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
