import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PNG } from 'pngjs';

import { validateArtQualityEvidence } from '../../src/render/art-quality-evidence';

function pngBuffer(width: number, height: number, first: number, second: number): Buffer {
  const image = new PNG({ width, height });
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const pixelIndex = offset / 4;
    const value = (pixelIndex % 17 === 0 ? first : second) + (pixelIndex % 11);
    image.data[offset] = value;
    image.data[offset + 1] = (value + 30) % 255;
    image.data[offset + 2] = (value + 90) % 255;
    image.data[offset + 3] = 255;
  }
  return PNG.sync.write(image);
}

function png(path: string, first: number, second: number): void {
  writeFileSync(path, pngBuffer(640, 360, first, second));
}

describe('Phase 28 packaged art-quality evidence', () => {
  test('restores a maximized smoke window before the next serial resize', () => {
    const main = readFileSync(join(process.cwd(), 'electron/main/index.ts'), 'utf8');
    const resize = main.slice(
      main.indexOf('async function resizeContentAndWait'),
      main.indexOf('async function clickAriaButton'),
    );
    expect(resize).toContain('window.isMaximized()');
    expect(resize.indexOf('window.unmaximize()')).toBeLessThan(resize.indexOf('window.setContentSize(width, height)'));
    expect(main).toContain('Math.abs(candidateSurface.width - bounds.width) <= 1');
    expect(main).toContain('overflow?.body === false && overflow.surface === false');
  });

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
      const testedCommit = 'a'.repeat(40);
      const packageProvenance = {
        executable: '/package/SI World',
        sizeBytes: 100,
        modifiedMilliseconds: 1,
        payload: '/package/app.asar',
        payloadSizeBytes: 200,
        payloadSha256: 'c'.repeat(64),
      };
      const responsiveReport = (artMode: 'legacy' | 'enhanced') => ({
        schemaVersion: 1,
        highDpi: false,
        testedCommit,
        packageProvenance,
        targets: [{
          requested: { width: 1920, height: 1080 },
          afterResizeEvidence: {
            content: { width: 1920, height: 1080 },
            devicePixelRatio: 1,
            selectedWorldZoom: 1,
            camera: { x: 400, y: 300, zoom: 1 },
            mapId: 'northwest_residential',
            artMode,
          },
          conversationEvidence: { uiScale: 1 },
          screenshots: {
            zoom: artMode === 'legacy'
              ? ['legacy-1.png', 'legacy-2.png', 'legacy-3.png']
              : ['enhanced-1.png', 'enhanced-2.png', 'enhanced-3.png'],
            conversation: 'conversation-1.png',
          },
        }],
      });
      writeFileSync(join(root, 'legacy.json'), `${JSON.stringify(responsiveReport('legacy'))}\n`);
      writeFileSync(join(root, 'enhanced.json'), `${JSON.stringify(responsiveReport('enhanced'))}\n`);
      writeFileSync(join(root, 'performance.json'), `${JSON.stringify({
        schemaVersion: 1,
        compareArtModes: true,
        includeMaximumLoad: true,
        qualification: true,
        testedCommit,
        packageProvenance,
        matchedInputs: {
          mapId: 'northwest_residential',
          content: { width: 2560, height: 1440 },
          surface: { x: 0, y: 0, width: 2560, height: 1400 },
          devicePixelRatio: 2,
          selectedWorldZoom: 1,
          camera: { x: -241, y: 126, zoom: 1 },
          uiScale: 1,
          testedCommit,
          packageProvenance,
        },
        performanceAcceptance: {
          enhancedToLegacyMedianRatio: 1,
          maximumMedianRatio: 1.1,
          minimumRoundedFps: 60,
          addedStaticBatches: 1,
          maximumAddedStaticBatches: 1,
          passed: true,
        },
        modes: {
          legacy: { roundedFps: 120, medianFrameTimeMilliseconds: 8.3, staticBatchCount: 1 },
          enhanced: { roundedFps: 120, medianFrameTimeMilliseconds: 8.3, staticBatchCount: 2 },
        },
      })}\n`);
      const report = {
        schemaVersion: 1,
        artRevision: 2,
        testedCommit,
        packageProvenance,
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
      expect(() => validateArtQualityEvidence({ ...report, artRevision: 3 }, root)).toThrow(
        'full-cast portrait matrix',
      );
      const characterIds = [
        'devon-price', 'elise-moreau', 'generic-resident', 'linda', 'mina-park',
        'priya-nair', 'protagonist', 'rafael-cruz', 'sora-tan', 'tomas-reed',
      ] as const;
      const fullCastPortraitMatrix = [1, 1.25, 1.5].flatMap((uiScale) => characterIds.map((characterId) => ({
        characterId,
        uiScale,
        screenshot: `portrait-${uiScale}-${characterId}.png`,
        evidence: {
          content: { width: 1440, height: 900 },
          devicePixelRatio: 1,
          selectedWorldZoom: 1,
          uiScale,
          camera: { x: 400, y: 300, zoom: 1 },
          mapId: 'northwest_residential',
          artMode: 'enhanced',
        },
        portraitRect: { x: 20, y: 20, width: 82, height: 90 },
        inputRect: { x: 120, y: 700, width: 600, height: 44 },
        transcriptFontSize: 16,
      })));
      const portraitPng = pngBuffer(1280, 720, 45, 95);
      fullCastPortraitMatrix.forEach(({ screenshot }) => writeFileSync(join(root, screenshot), portraitPng));
      writeFileSync(join(root, 'enhanced.json'), `${JSON.stringify({
        ...responsiveReport('enhanced'),
        fullCastPortraitMatrix,
      })}\n`);
      expect(validateArtQualityEvidence({ ...report, artRevision: 3 }, root)).toMatchObject({ artRevision: 3 });
      writeFileSync(join(root, 'performance.json'), '{}\n');
      expect(() => validateArtQualityEvidence(report, root)).toThrow();
      writeFileSync(join(root, 'performance.json'), `${JSON.stringify({
        schemaVersion: 1,
        compareArtModes: true,
        includeMaximumLoad: true,
        qualification: true,
        testedCommit,
        packageProvenance,
        matchedInputs: {
          mapId: 'northwest_residential',
          content: { width: 2560, height: 1440 },
          surface: { x: 0, y: 0, width: 2560, height: 1400 },
          devicePixelRatio: 2,
          selectedWorldZoom: 1,
          camera: { x: -241, y: 126, zoom: 1 },
          uiScale: 1,
          testedCommit,
          packageProvenance,
        },
        performanceAcceptance: {
          enhancedToLegacyMedianRatio: 1,
          maximumMedianRatio: 1.1,
          minimumRoundedFps: 60,
          addedStaticBatches: 1,
          maximumAddedStaticBatches: 1,
          passed: true,
        },
        modes: {
          legacy: { roundedFps: 120, medianFrameTimeMilliseconds: 8.3, staticBatchCount: 1 },
          enhanced: { roundedFps: 120, medianFrameTimeMilliseconds: 8.3, staticBatchCount: 2 },
        },
      })}\n`);
      writeFileSync(join(root, 'enhanced-1.png'), readFileSync(join(root, 'legacy-1.png')));
      expect(() => validateArtQualityEvidence(report, root)).toThrow('identical');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
