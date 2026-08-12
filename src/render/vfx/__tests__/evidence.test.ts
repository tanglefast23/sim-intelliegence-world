import { parseVfxEvidence } from '../evidence';

const VALID = {
  schemaVersion: 1,
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
} as const;

describe('VFX evidence', () => {
  test('accepts the strict version-one record', () => {
    expect(parseVfxEvidence(VALID)).toEqual(VALID);
  });

  test('rejects unknown fields and update rates above three changes per second', () => {
    expect(() => parseVfxEvidence({ ...VALID, extra: true })).toThrow();
    expect(() => parseVfxEvidence({ ...VALID, updateRateHz: 3.01 })).toThrow();
  });
});
