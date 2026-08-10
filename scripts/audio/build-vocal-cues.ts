import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type Cue = Readonly<{ duration: number; frequencies: readonly number[]; id: string }>;

const SAMPLE_RATE = 22_050;
const cues: readonly Cue[] = [
  { id: 'greeting', duration: 0.18, frequencies: [440, 660] },
  { id: 'laugh', duration: 0.26, frequencies: [620, 760, 680] },
  { id: 'sigh', duration: 0.34, frequencies: [420, 310, 220] },
  { id: 'consequence', duration: 0.28, frequencies: [220, 165] },
];

function writeAscii(buffer: Buffer, offset: number, text: string): void {
  buffer.write(text, offset, text.length, 'ascii');
}

function buildCue(cue: Cue): Buffer {
  const sampleCount = Math.round(cue.duration * SAMPLE_RATE);
  const dataBytes = sampleCount * 2;
  const output = Buffer.alloc(44 + dataBytes);
  writeAscii(output, 0, 'RIFF');
  output.writeUInt32LE(36 + dataBytes, 4);
  writeAscii(output, 8, 'WAVE');
  writeAscii(output, 12, 'fmt ');
  output.writeUInt32LE(16, 16);
  output.writeUInt16LE(1, 20);
  output.writeUInt16LE(1, 22);
  output.writeUInt32LE(SAMPLE_RATE, 24);
  output.writeUInt32LE(SAMPLE_RATE * 2, 28);
  output.writeUInt16LE(2, 32);
  output.writeUInt16LE(16, 34);
  writeAscii(output, 36, 'data');
  output.writeUInt32LE(dataBytes, 40);
  for (let index = 0; index < sampleCount; index += 1) {
    const progress = index / Math.max(1, sampleCount - 1);
    const segment = Math.min(cue.frequencies.length - 1, Math.floor(progress * cue.frequencies.length));
    const frequency = cue.frequencies[segment]!;
    const attack = Math.min(1, progress / 0.08);
    const release = Math.min(1, (1 - progress) / 0.22);
    const envelope = attack * release;
    const wobble = 1 + 0.025 * Math.sin(progress * Math.PI * 7);
    const sample = Math.round(Math.sin(2 * Math.PI * frequency * wobble * index / SAMPLE_RATE) * envelope * 7_200);
    output.writeInt16LE(sample, 44 + index * 2);
  }
  return output;
}

const outputDirectory = join(process.cwd(), 'assets/generated/audio');
mkdirSync(outputDirectory, { recursive: true });
for (const cue of cues) writeFileSync(join(outputDirectory, `${cue.id}.wav`), buildCue(cue));
process.stdout.write(`Built ${cues.length} deterministic vocal cues in ${outputDirectory}.\n`);
