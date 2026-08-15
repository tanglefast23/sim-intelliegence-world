import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { WORLD_LAYER_ORDER } from '../../world-frame';

describe('WorldScene procedural VFX integration', () => {
  // Stage 5 split the world scene: WorldScene is the controller, SkiaWorldSurface holds every
  // Skia drawing surface. Together they are the scene these contracts describe.
  const scene = [
    readFileSync(resolve(process.cwd(), 'src/render/WorldScene.tsx'), 'utf8'),
    readFileSync(resolve(process.cwd(), 'src/render/SkiaWorldSurface.tsx'), 'utf8'),
  ].join('\n');
  const responsiveEvidence = readFileSync(resolve(process.cwd(), 'src/render/responsive-evidence.ts'), 'utf8');

  test('preserves the seven-layer order and existing responsive evidence version', () => {
    expect(WORLD_LAYER_ORDER).toEqual(['floor', 'prop', 'shadow', 'character', 'effect', 'wall', 'roof']);
    expect(responsiveEvidence).toContain('schemaVersion: 1');
    expect(scene).toContain('drawCounts');
    expect(scene).toContain('const drawCounts = worldFrame.drawCounts;');
    expect(scene).toContain('window.siWorldMeasureResponsiveEvidence = () =>');
  });

  test('keeps circle mode smoke-only and does not mount the procedural driver in that mode', () => {
    expect(scene).toContain("const vfxMode = smokeMode && window.siWorldVfxMode === 'circle'");
    expect(scene).toContain("vfxMode === 'procedural' ? (");
    expect(scene).toContain('<ProceduralMapEffects');
    expect(scene).toContain("window.siWorldVfxMode === 'circle'");
  });

  test('keeps time in the controller and gives the renderer sampled geometry only', () => {
    expect(scene).toContain('const speed = effectiveSpeed(runtime.worldState.clock);');
    expect(scene).toContain("const running = !rendererSuspended && vfxMode === 'procedural' && (forceAmbientMotion || speed > 0);");
    expect(scene).toContain('advanceAmbientVfxClock');
    expect(scene).toContain('animationTimestampMilliseconds: rendererParityPulseFrozen ? 0 : vfxClock.current.ageMilliseconds');
    expect(scene).toContain('vfxAgeStep: rendererParityPulseFrozen ? 0 : vfxAgeStep');
    expect(scene).toContain('geometries={worldFrame.effects}');
    expect(scene).toContain('worldFrame.fallbackEffects');
  });

  test('publishes separate strict VFX evidence without changing save or preference data', () => {
    expect(scene).toContain('nativeID="world-vfx-state"');
    expect(scene).toContain('parseVfxEvidence');
    expect(scene).not.toMatch(/save.*vfx|presentationPreferences.*vfx/iu);
  });
});
