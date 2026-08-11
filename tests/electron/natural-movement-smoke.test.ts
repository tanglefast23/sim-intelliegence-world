import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { PNG } from 'pngjs';

import { WORLD_MAP_CATALOG } from '../../src/application/runtime/map-catalog';
import { buildDeterministicMovementTrace } from '../../src/render/movement-evidence';
import {
  evaluateNaturalMovementRendererFps,
  validateNaturalMovementReport,
} from '../../scripts/electron/natural-movement-report';

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
          npcs: {
            resident: {
              ...npcActor,
              direction: index % 2 === 0 ? 'left' as const : 'right' as const,
              walkFrame: (index + 1) % 2 as 0 | 1,
            },
          },
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
        schemaVersion: 2,
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
        rendererFpsEvidence: {
          measuredFps: 54,
          profile: 'qualification',
          thresholdFps: 55,
          thresholdPassed: false,
          thresholdRequired: true,
        },
      };
      expect(() => validateNaturalMovementReport(report, root))
        .toThrow('below 55');
      const qualifyingEvidence = evaluateNaturalMovementRendererFps(55, 'qualification');
      expect(() => validateNaturalMovementReport({
        ...report,
        package: {
          ...report.package,
          standard: { ...report.package.standard, rendererFps: 55 },
        },
        rendererFpsEvidence: qualifyingEvidence,
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
        rendererFpsEvidence: qualifyingEvidence,
      }, root)).toThrow('Reduced-motion movement summary does not match');
      expect(() => validateNaturalMovementReport({
        ...report,
        package: {
          ...report.package,
          standard: {
            ...report.package.standard,
            rendererFps: 55,
            samples: report.package.standard.samples.map((sample) => ({
              ...sample,
              npcs: Object.fromEntries(Object.entries(sample.npcs).map(([id, npc]) => [id, {
                ...npc,
                direction: sample.player.direction,
                walkFrame: sample.player.walkFrame,
              }])),
            })),
          },
        },
        rendererFpsEvidence: qualifyingEvidence,
      }, root)).toThrow('independent direction and walking phase');
      const platformShellReport = {
        ...report,
        rendererFpsEvidence: evaluateNaturalMovementRendererFps(23.96, 'platform-shell'),
        package: {
          ...report.package,
          standard: { ...report.package.standard, rendererFps: 23.96 },
        },
      };
      expect(() => validateNaturalMovementReport(platformShellReport, root, {
        requiredProfile: 'platform-shell',
      })).not.toThrow();
      expect(() => validateNaturalMovementReport(platformShellReport, root, {
        requiredProfile: 'qualification',
      })).toThrow('does not match required profile');
      expect(() => validateNaturalMovementReport({
        ...platformShellReport,
        rendererFpsEvidence: {
          ...platformShellReport.rendererFpsEvidence,
          thresholdPassed: true,
        },
      }, root)).toThrow('does not match the measured package result');
      expect(() => evaluateNaturalMovementRendererFps(60, 'weakened')).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
