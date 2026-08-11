import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PNG } from 'pngjs';

import { WORLD_MAP_CATALOG } from '../../src/application/runtime/map-catalog';
import { buildDeterministicMovementTrace } from '../../src/render/movement-evidence';
import { validateNaturalMovementReport } from '../../scripts/electron/natural-movement-report';

function screenshot(path: string, fill: number): void {
  const png = new PNG({ width: 640, height: 360 });
  png.data.fill(fill);
  writeFileSync(path, PNG.sync.write(png));
}

describe('natural-movement packaged evidence', () => {
  test('fixed 16 ms traces are identical and prove diagonals, curves, and both foot frames', () => {
    const map = WORLD_MAP_CATALOG.northwest_residential;
    const first = buildDeterministicMovementTrace(map, { x: 18, y: 18 }, { x: 22, y: 22 });
    const second = buildDeterministicMovementTrace(map, { x: 18, y: 18 }, { x: 22, y: 22 });
    expect(second).toEqual(first);
    expect(first.path.some((tile, index) => {
      const prior = index === 0 ? first.start : first.path[index - 1]!;
      return prior.x !== tile.x && prior.y !== tile.y;
    })).toBe(true);
    expect(first.samples.some(({ curveActive }) => curveActive)).toBe(true);
    expect(new Set(first.samples.map(({ walkFrame }) => walkFrame)).size).toBe(2);
  });

  test('rejects a package report that weakens the performance gate', () => {
    const root = mkdtempSync(join(tmpdir(), 'si-world-natural-report-'));
    try {
      screenshot(join(root, 'standard.png'), 32);
      screenshot(join(root, 'reduced.png'), 64);
      const trace = buildDeterministicMovementTrace(
        WORLD_MAP_CATALOG.northwest_residential,
        { x: 18, y: 18 },
        { x: 22, y: 22 },
      );
      const actor = {
        committed: { x: 18, y: 18 }, visualFoot: { x: 592, y: 605 },
        direction: 'down' as const, walkFrame: 0 as const, status: 'moving' as const,
        target: { x: 22, y: 22 }, curveActive: true,
      };
      const npcActor = {
        committed: actor.committed,
        visualFoot: actor.visualFoot,
        direction: actor.direction,
        walkFrame: actor.walkFrame,
        status: actor.status,
        curveActive: actor.curveActive,
      };
      const pass = {
        schemaVersion: 1 as const,
        samples: Array.from({ length: 5 }, (_, index) => ({
          player: {
            ...actor,
            visualFoot: { x: actor.visualFoot.x + index, y: actor.visualFoot.y + index },
            walkFrame: index % 2 as 0 | 1,
          },
          npcs: { resident: { ...npcActor, walkFrame: index % 2 as 0 | 1 } },
          reducedMotion: false,
          ...(index === 4 ? { evidenceTag: 'interruption' as const } : {}),
        })),
        firstSegmentUniquePositions: 5,
        curveObserved: true,
        interruptionObserved: true,
        playerWalkFrames: [0, 1] as const,
        npcWalkFrames: [0, 1] as const,
        rendererFps: 54,
        displayRafFps: 60,
      };
      const report = {
        schemaVersion: 1,
        testedCommit: 'a'.repeat(40),
        evidenceSource: { baseCommit: 'a'.repeat(40), sourceSha256: 'b'.repeat(64), sourcePaths: ['source.ts'] },
        traceDeterministic: true,
        trace,
        package: {
          standard: { ...pass, mode: 'standard', screenshotNames: ['standard.png'] },
          reduced: {
            ...pass,
            mode: 'reduced',
            rendererFps: null,
            displayRafFps: null,
            samples: pass.samples.map((sample) => ({ ...sample, reducedMotion: true })),
            screenshotNames: ['reduced.png'],
          },
        },
      };
      expect(() => validateNaturalMovementReport(report, root))
        .toThrow('below 55');
      expect(() => validateNaturalMovementReport({
        ...report,
        package: {
          ...report.package,
          standard: { ...report.package.standard, rendererFps: 55 },
        },
      }, root))
        .not.toThrow();
      expect(() => validateNaturalMovementReport({
        ...report,
        package: {
          ...report.package,
          standard: { ...report.package.standard, rendererFps: 55 },
          reduced: {
            ...report.package.reduced,
            samples: report.package.reduced.samples.map(({ evidenceTag: _evidenceTag, ...sample }) => sample),
          },
        },
      }, root)).toThrow('Reduced-motion movement summary does not match');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
