import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';

import { PNG } from 'pngjs';

const outputDirectory = join(process.cwd(), 'assets/proof');
mkdirSync(outputDirectory, { recursive: true });

const png = new PNG({ height: 32, width: 32 });
const palette = [
  [23, 32, 27, 255],
  [245, 221, 157, 255],
  [207, 111, 75, 255],
  [130, 166, 108, 255],
] as const;
for (let y = 0; y < png.height; y += 1) {
  for (let x = 0; x < png.width; x += 1) {
    const color = palette[(Math.floor(x / 8) + Math.floor(y / 8)) % palette.length];
    const offset = (y * png.width + x) * 4;
    if (!color) {
      throw new Error('Proof palette lookup failed.');
    }
    png.data[offset] = color[0];
    png.data[offset + 1] = color[1];
    png.data[offset + 2] = color[2];
    png.data[offset + 3] = color[3];
  }
}
writeFileSync(join(outputDirectory, 'phase2-atlas.png'), PNG.sync.write(png));

const sampleRate = 8_000;
const durationSeconds = 0.12;
const sampleCount = Math.floor(sampleRate * durationSeconds);
const dataSize = sampleCount * 2;
const wav = Buffer.alloc(44 + dataSize);
wav.write('RIFF', 0);
wav.writeUInt32LE(36 + dataSize, 4);
wav.write('WAVE', 8);
wav.write('fmt ', 12);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(dataSize, 40);
for (let sample = 0; sample < sampleCount; sample += 1) {
  const envelope = 1 - sample / sampleCount;
  const value = Math.round(Math.sin((2 * Math.PI * 440 * sample) / sampleRate) * envelope * 8_000);
  wav.writeInt16LE(value, 44 + sample * 2);
}
writeFileSync(join(outputDirectory, 'phase2-tone.wav'), wav);

console.log(`Proof assets generated in ${dirname(join(outputDirectory, 'phase2-atlas.png'))}`);
