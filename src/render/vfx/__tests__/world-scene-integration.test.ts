import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { WORLD_LAYER_ORDER } from '../../world-frame';

describe('WorldScene procedural VFX integration', () => {
  const scene = readFileSync(resolve(process.cwd(), 'src/render/WorldScene.tsx'), 'utf8');
  const responsiveEvidence = readFileSync(resolve(process.cwd(), 'src/render/responsive-evidence.ts'), 'utf8');

  test('preserves the seven-layer order and existing responsive evidence version', () => {
    expect(WORLD_LAYER_ORDER).toEqual(['floor', 'prop', 'shadow', 'character', 'effect', 'wall', 'roof']);
    expect(responsiveEvidence).toContain('schemaVersion: 1');
    expect(scene).toContain('drawCounts');
    expect(scene).toContain('effect: visibleEffects.length');
  });

  test('keeps circle mode smoke-only and does not mount the procedural driver in that mode', () => {
    expect(scene).toContain("const vfxMode = smokeMode && window.siWorldVfxMode === 'circle'");
    expect(scene).toContain("vfxMode === 'procedural' ? (");
    expect(scene).toContain('<ProceduralMapEffects');
    expect(scene).toContain("vfxMode === 'circle'");
  });

  test('uses effective speed, full bounds, map identity, and per-emitter fallback', () => {
    expect(scene).toContain('const speed = effectiveSpeed(runtime.worldState.clock);');
    expect(scene).toContain('running={speed > 0}');
    expect(scene).toContain('vfxBoundsIntersectWorldRect(effect, vfxViewport)');
    expect(scene).toContain('partitionVfxEmitters(mapId, visibleEffects)');
    expect(scene).toContain('mapEntryIdentity={mapId}');
    expect(scene).toContain('vfxEmitters.fallback');
  });

  test('publishes separate strict VFX evidence without changing save or preference data', () => {
    expect(scene).toContain('nativeID="world-vfx-state"');
    expect(scene).toContain('parseVfxEvidence');
    expect(scene).not.toMatch(/save.*vfx|presentationPreferences.*vfx/iu);
  });
});
