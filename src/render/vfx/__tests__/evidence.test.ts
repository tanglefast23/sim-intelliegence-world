import { parseVfxEvidence } from '../evidence';
import { TRANSIENT_VFX_MAX_RECTS } from '../transient';

const VALID = {
  schemaVersion: 2,
  mode: 'procedural',
  mapId: 'northwest_residential',
  vfxRevision: 2,
  ageStep: 2,
  reducedMotion: false,
  visibleEmitterIds: ['patio-fire'],
  culledEmitterIds: ['beach-sparkle'],
  fallbackEmitterIds: [],
  primitiveCounts: { fire: 4, sparkle: 0, insects: 0, leaves: 0, neon: 0, palm: 0, steam: 0, water: 0, total: 4 },
  renderNodeCount: 6,
  updateRateHz: 1_000 / 334,
  transient: {
    revision: 1,
    enabled: true,
    activeCueIds: ['dust-1'],
    liveRects: 5,
    groundRects: 5,
    aerialRects: 0,
    glows: 0,
    droppedCues: 0,
    updateRateHz: 20,
  },
} as const;

describe('VFX evidence', () => {
  test('accepts the strict version-two record', () => {
    expect(parseVfxEvidence(VALID)).toEqual(VALID);
  });

  test('rejects unknown fields and ambient update rates above three changes per second', () => {
    expect(() => parseVfxEvidence({ ...VALID, extra: true })).toThrow();
    expect(() => parseVfxEvidence({ ...VALID, updateRateHz: 3.01 })).toThrow();
  });

  test('requires the transient block and rejects unknown fields inside it', () => {
    const { transient: _omitted, ...withoutTransient } = VALID;
    expect(() => parseVfxEvidence(withoutTransient)).toThrow();
    expect(() => parseVfxEvidence({ ...VALID, transient: { ...VALID.transient, extra: true } })).toThrow();
  });

  test('refuses a transient rect count above the particle cap', () => {
    // A backstop, not the enforcement: `sampleTransientVfx` owns the cap. This makes a leak throw
    // rather than overrun silently.
    expect(() => parseVfxEvidence({
      ...VALID,
      transient: { ...VALID.transient, liveRects: TRANSIENT_VFX_MAX_RECTS + 1 },
    })).toThrow();
  });

  test('keeps the ambient and transient rates on separate ceilings', () => {
    expect(parseVfxEvidence(VALID).transient.updateRateHz).toBe(20);
    expect(() => parseVfxEvidence({
      ...VALID,
      transient: { ...VALID.transient, updateRateHz: 20.01 },
    })).toThrow();
  });
});
