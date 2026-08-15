import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('procedural VFX package smoke wiring', () => {
  const main = readFileSync(resolve(process.cwd(), 'electron/main/index.ts'), 'utf8');
  const preload = readFileSync(resolve(process.cwd(), 'electron/preload/index.ts'), 'utf8');
  const runner = readFileSync(resolve(process.cwd(), 'scripts/electron/run-procedural-vfx-package-smoke.ts'), 'utf8');
  const scene = readFileSync(resolve(process.cwd(), 'src/render/WorldScene.tsx'), 'utf8');

  test('keeps the VFX-only switch smoke-gated and fixes enhanced ground art', () => {
    expect(main).toContain("const smokeVfxMode = process.env.SI_WORLD_VFX_MODE;");
    expect(main).toContain("['circle', 'procedural'].includes(smokeVfxMode)");
    expect(preload).toContain("contextBridge.exposeInMainWorld('siWorldVfxMode', smokeVfxMode)");
    expect(runner).toContain("z.string().startsWith('Art mode enhanced;')");
  });

  test('captures all six anchors at three zoom levels in standard and reduced motion', () => {
    expect(runner).toContain('EXPECTED_VFX_ANCHORS');
    expect(runner).toContain("['circle', 'standard']");
    expect(runner).toContain("['procedural', 'reduced']");
    expect(runner).toContain('validateWorldZoomEvidence');
    expect(scene).toContain('window.siWorldOpenVfxFixture =');
  });

  test('records pause, grayscale, provenance, and VFX-only performance gates', () => {
    expect(main).toContain('VFX age advanced while paused');
    expect(runner).toContain('writeGrayscaleProof');
    expect(runner).toContain('resolveEvidenceSource');
    expect(runner).toContain('validateVfxModePerformance');
    expect(runner).toContain('qualification ? 60 : 0');
    expect(runner).toContain('SI_WORLD_PROCEDURAL_VFX_SMOKE_RESULT');
  });
});
