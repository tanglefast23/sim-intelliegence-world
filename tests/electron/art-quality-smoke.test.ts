import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PNG } from 'pngjs';

import { validateArtQualityEvidence } from '../../src/render/art-quality-evidence';

function png(path: string, first: number, second: number): void {
  const image = new PNG({ width: 640, height: 360 });
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const pixelIndex = offset / 4;
    const value = (pixelIndex % 17 === 0 ? first : second) + (pixelIndex % 11);
    image.data[offset] = value;
    image.data[offset + 1] = (value + 30) % 255;
    image.data[offset + 2] = (value + 90) % 255;
    image.data[offset + 3] = 255;
  }
  writeFileSync(path, PNG.sync.write(image));
}

describe('Phase 28 packaged art-quality evidence', () => {
  test('requires distinct nonblank before and after frames, three UI scales, and lifecycle proof', () => {
    const root = join(tmpdir(), `si-world-art-quality-${process.pid}`);
    rmSync(root, { recursive: true, force: true });
    mkdirSync(root, { recursive: true });
    try {
      const imageNames = [
        'legacy-1.png', 'enhanced-1.png', 'legacy-2.png', 'enhanced-2.png', 'legacy-3.png', 'enhanced-3.png',
        'conversation-1.png', 'conversation-125.png', 'conversation-15.png',
        'grayscale-1.png',
        ...Array.from({ length: 8 }, (_unused, index) => `life-${index}.png`),
      ];
      imageNames.forEach((name, index) => png(join(root, name), 20 + index, 80 + index));
      for (const name of ['legacy.json', 'enhanced.json', 'performance.json']) {
        writeFileSync(join(root, name), '{}\n');
      }
      const report = {
        schemaVersion: 1,
        artRevision: 2,
        testedCommit: 'a'.repeat(40),
        capturePolicy: {
          stateBased: true, minimumPaints: 2, absoluteDeadlineMilliseconds: 1000, pngPixelValidation: true,
        },
        fixedCamera: [1, 2, 3].map((zoom) => ({
          zoom,
          legacy: `legacy-${zoom}.png`,
          enhanced: `enhanced-${zoom}.png`,
        })),
        grayscaleFixedCamera: 'grayscale-1.png',
        conversationFixtures: {
          '1': 'conversation-1.png', '1.25': 'conversation-125.png', '1.5': 'conversation-15.png',
        },
        lifecycleFiles: Array.from({ length: 8 }, (_unused, index) => `life-${index}.png`),
        reports: { legacyResponsive: 'legacy.json', enhancedResponsive: 'enhanced.json', performance: 'performance.json' },
        hashes: { atlas: 'b'.repeat(64) },
      };
      expect(validateArtQualityEvidence(report, root)).toMatchObject({ artRevision: 2 });
      writeFileSync(join(root, 'enhanced-1.png'), readFileSync(join(root, 'legacy-1.png')));
      expect(() => validateArtQualityEvidence(report, root)).toThrow('identical');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
