import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { PNG } from 'pngjs';
import { z } from 'zod';

import { CHARACTER_IDS } from '../../src/render/atlas';
import { resolveTestedCommit } from '../qualification/tested-commit';
import { resolveEvidenceSource } from '../qualification/evidence-source';
import { resolveEvidenceOutputRoot } from '../verification/evidence-output';
import {
  findPackagedExecutable,
  validateScreenshotBuffers,
  validateWorldZoomEvidence,
} from './package-smoke-utils';
import { validateArtModePerformance } from './art-mode-performance';

const PointSchema = z.object({ x: z.number(), y: z.number() }).strict();
const SizeSchema = z.object({ width: z.number().positive(), height: z.number().positive() }).strict();
const RectSchema = z.object({ x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive() }).strict();
const DrawCountsSchema = z.object({
  floor: z.number().int().nonnegative(),
  prop: z.number().int().nonnegative(),
  shadow: z.number().int().nonnegative(),
  character: z.number().int().nonnegative(),
  effect: z.number().int().nonnegative(),
  wall: z.number().int().nonnegative(),
  roof: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
}).strict();
const PerformanceFixtureSchema = z.object({
  schemaVersion: z.literal(1),
  maximumLoad: z.object({
    contentWidth: z.number().int().positive(),
    contentHeight: z.number().int().positive(),
    minimumDevicePixelRatio: z.number().positive(),
    selectedWorldZoom: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    minimumRoundedFps: z.number().int().positive(),
    requiredLayers: z.array(z.enum(['floor', 'prop', 'shadow', 'character', 'effect', 'wall', 'roof'])).min(1),
  }).strict(),
}).strict();
const EvidenceSchema = z.object({
  schemaVersion: z.literal(1),
  content: SizeSchema,
  surface: RectSchema,
  coverage: z.object({ width: z.number().min(0.9).max(1), height: z.number().min(0.85).max(1) }).strict(),
  devicePixelRatio: z.number().positive(),
  canvas: z.object({ backingWidth: z.number().int().positive(), backingHeight: z.number().int().positive() }).strict(),
  automaticWorldZoom: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  selectedWorldZoom: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  uiScale: z.union([z.literal(1), z.literal(1.25), z.literal(1.5)]),
  camera: z.object({ x: z.number().int(), y: z.number().int(), zoom: z.union([z.literal(1), z.literal(2), z.literal(3)]) }).strict(),
  mapId: z.literal('northwest_residential'),
  artMode: z.enum(['legacy', 'enhanced']),
  presentationHash: z.string().regex(/^[0-9a-f]{8}$/u),
  minimumFontSize: z.number().min(11),
  minimumPointerTarget: z.number().min(36),
  activePanel: z.object({ id: z.string().min(1), rect: RectSchema }).strict().nullable(),
  conversationInput: RectSchema.nullable(),
  roofGroupId: z.string().nullable(),
  roofState: z.enum(['hidden', 'restored']),
  drawCounts: DrawCountsSchema,
  staticBatchCount: z.number().int().positive(),
  overflow: z.object({ body: z.literal(false), surface: z.literal(false) }).strict(),
}).strict();
const TargetReportSchema = z.object({
  requested: SizeSchema,
  measuredSurface: RectSchema,
  centerBefore: PointSchema,
  centerAfter: PointSchema,
  clickedTile: PointSchema,
  afterResizeEvidence: EvidenceSchema,
  conversationEvidence: EvidenceSchema,
  screenshots: z.object({
    zoom: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]),
    conversation: z.string().min(1),
  }).strict(),
}).strict();
const MaximumLoadSchema = z.object({
  evidence: EvidenceSchema,
  rendererFps: z.number().positive(),
  displayRafFps: z.number().positive(),
  medianFrameTimeMilliseconds: z.number().positive(),
  sampledFrames: z.number().int().positive(),
  cameraChangeFrames: z.number().int().positive(),
  roundedFps: z.number().int().positive(),
  qualificationRequired: z.boolean(),
  allOrdinaryLayersEnabled: z.literal(true),
  screenshot: z.string().min(1),
}).strict();
const FullCastPortraitEntrySchema = z.object({
  characterId: z.enum(CHARACTER_IDS),
  uiScale: z.union([z.literal(1), z.literal(1.25), z.literal(1.5)]),
  screenshot: z.string().min(1),
  evidence: EvidenceSchema,
  portraitRect: RectSchema,
  inputRect: RectSchema,
  transcriptFontSize: z.number().positive(),
}).strict();
const ResponsiveSmokeSchema = z.object({
  schemaVersion: z.literal(1),
  highDpi: z.boolean(),
  requestedDeviceScaleFactor: z.union([z.literal(1), z.literal(1.25), z.literal(1.5), z.literal(2)]),
  geometry: z.object({
    schemaVersion: z.literal(1),
    mapId: z.literal('northwest_residential'),
    map: z.object({
      widthTiles: z.number().int().positive(),
      heightTiles: z.number().int().positive(),
      tileSize: z.number().int().positive(),
    }).strict(),
    start: z.object({ protagonist: PointSchema, cameraAnchor: PointSchema, movementTarget: PointSchema }).strict(),
    roof: z.object({ id: z.string().min(1), interiorTile: PointSchema, exteriorTile: PointSchema }).strict(),
  }).passthrough(),
  targets: z.array(TargetReportSchema).min(1),
  fullCastPortraitMatrix: z.array(FullCastPortraitEntrySchema).length(CHARACTER_IDS.length * 3).nullable(),
  maximumLoad: MaximumLoadSchema.nullable(),
}).strict();

const commandArguments = process.argv.slice(2);
const compareArtModes = commandArguments.includes('--compare-art-modes');
const includeMaximumLoad = commandArguments.includes('--include-maximum-load');
const artModeArguments = commandArguments.filter((argument) => argument.startsWith('--art-mode='));
if (artModeArguments.length > 1) throw new Error('Only one art mode can be supplied.');
const artMode = artModeArguments[0]?.slice('--art-mode='.length);
if (artMode !== undefined && artMode !== 'legacy' && artMode !== 'enhanced') {
  throw new Error('Art mode must be legacy or enhanced.');
}
if (compareArtModes && artMode) throw new Error('Art-mode comparison selects both modes itself.');
if (compareArtModes && !includeMaximumLoad) {
  throw new Error('--compare-art-modes requires --include-maximum-load.');
}
const deviceScaleArguments = commandArguments.filter((argument) => argument.startsWith('--device-scale-factor='));
if (deviceScaleArguments.length > 1) throw new Error('Only one device scale factor can be supplied.');
const requestedDeviceScaleFactor = Number(
  deviceScaleArguments[0]?.slice('--device-scale-factor='.length) ??
  (commandArguments.includes('--high-dpi') || includeMaximumLoad ? 2 : 1),
);
if (![1, 1.25, 1.5, 2].includes(requestedDeviceScaleFactor)) {
  throw new Error('Device scale factor must be 1, 1.25, 1.5, or 2.');
}
const highDpi = commandArguments.includes('--high-dpi') || includeMaximumLoad;
if (highDpi && requestedDeviceScaleFactor !== 2) {
  throw new Error('High-DPI maximum-load smoke requires device scale factor 2.');
}
const qualification = commandArguments.includes('--qualification');
const fullCastPortraitSmoke = process.env.SI_WORLD_FULL_CAST_PORTRAIT_SMOKE === '1';
const performanceFixture = PerformanceFixtureSchema.parse(
  JSON.parse(readFileSync(resolve('tests/fixtures/performance/phase-22.json'), 'utf8')) as unknown,
);
const evidenceSource = resolveEvidenceSource([
  '.github/workflows/ci.yml',
  'assets/generated/atlas-index.json',
  'assets/source/art/decal-recipes.json',
  'assets/source/art/material-recipes.json',
  'assets/source/art/roof-recipes.json',
  'scripts/art/character-look-roster.ts',
  'scripts/art/character-source.ts',
  'electron/main/index.ts',
  'electron/preload/index.ts',
  'forge.config.ts',
  'package.json',
  'scripts/electron/run-responsive-package-smoke.ts',
  'src/render/WorldScene.tsx',
  'src/render/responsive-evidence.ts',
  'src/render/smoke-geometry.ts',
  'src/ui/CharacterPortrait.tsx',
  'src/ui/ConversationPanel.tsx',
  'src/ui/WorldInput.tsx',
  'src/world/presentation/art-presentation.ts',
  'src/world/presentation/material-selection.ts',
  'src/world/presentation/material-transitions.ts',
  'tests/fixtures/performance/phase-22.json',
]);

function expectedResizedCenter(
  centerBefore: z.infer<typeof PointSchema>,
  surface: z.infer<typeof RectSchema>,
  zoom: 1 | 2 | 3,
  map: Readonly<{ widthTiles: number; heightTiles: number; tileSize: number }>,
): z.infer<typeof PointSchema> {
  const axis = (center: number, viewportPixels: number, mapPixels: number): number => {
    const visibleWorldPixels = viewportPixels / zoom;
    if (visibleWorldPixels >= mapPixels) return mapPixels / 2;
    return Math.min(mapPixels - visibleWorldPixels / 2, Math.max(visibleWorldPixels / 2, center));
  };
  return {
    x: axis(centerBefore.x, surface.width, map.widthTiles * map.tileSize),
    y: axis(centerBefore.y, surface.height, map.heightTiles * map.tileSize),
  };
}

const outputRoot = process.env.SI_WORLD_PACKAGE_OUTPUT_ROOT
  ? resolve(process.cwd(), process.env.SI_WORLD_PACKAGE_OUTPUT_ROOT)
  : join(process.cwd(), 'out');
const evidenceRoot = resolveEvidenceOutputRoot(commandArguments, {
  allowedFlags: [
    '--high-dpi',
    '--qualification',
    '--compare-art-modes',
    '--include-maximum-load',
    '--art-mode=legacy',
    '--art-mode=enhanced',
    '--device-scale-factor=1',
    '--device-scale-factor=1.25',
    '--device-scale-factor=1.5',
    '--device-scale-factor=2',
  ],
  defaultRelative: `output/verification/${compareArtModes ? 'responsive-art-modes' : qualification ? 'responsive-qualification' : highDpi ? 'responsive-high-dpi' : `responsive-dpr-${requestedDeviceScaleFactor}`}`,
});
mkdirSync(evidenceRoot, { recursive: true });
const executable = findPackagedExecutable(outputRoot);
const executableStats = statSync(executable);
const payloadCandidates = [
  resolve(dirname(executable), '..', 'Resources', 'app.asar'),
  resolve(dirname(executable), 'resources', 'app.asar'),
  resolve(dirname(executable), '..', 'resources', 'app.asar'),
];
const payload = payloadCandidates.find((candidate) => existsSync(candidate));
if (!payload) throw new Error('Packaged app payload app.asar is missing.');
const payloadBytes = readFileSync(payload);
const packageProvenance = Object.freeze({
  executable,
  sizeBytes: executableStats.size,
  modifiedMilliseconds: Math.round(executableStats.mtimeMs),
  payload,
  payloadSizeBytes: payloadBytes.length,
  payloadSha256: createHash('sha256').update(payloadBytes).digest('hex'),
});

if (compareArtModes) {
  const reports: Record<'legacy' | 'enhanced', Record<string, unknown>> = {} as Record<'legacy' | 'enhanced', Record<string, unknown>>;
  for (const mode of ['legacy', 'enhanced'] as const) {
    const modeRoot = join(evidenceRoot, mode);
    const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const result = spawnSync(command, [
      'tsx',
      'scripts/electron/run-responsive-package-smoke.ts',
      '--high-dpi',
      ...(qualification ? ['--qualification'] : []),
      `--art-mode=${mode}`,
      '--output-root',
      modeRoot,
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: process.env,
      maxBuffer: 10_000_000,
      shell: false,
      timeout: 360_000,
    });
    if (result.status !== 0) {
      throw new Error(`Responsive ${mode} art-mode pass failed: ${result.stderr.slice(-5_000)} ${result.stdout.slice(-5_000)}`);
    }
    reports[mode] = JSON.parse(readFileSync(join(modeRoot, 'responsive-report.json'), 'utf8')) as Record<string, unknown>;
  }
  const inputRecord = (report: Record<string, unknown>) => {
    const targets = report.targets as readonly Record<string, unknown>[];
    const maximumLoad = report.maximumLoad as { evidence?: Record<string, unknown> };
    return {
      geometry: report.geometry,
      requestedTargets: targets.map(({ requested }) => requested),
      highDpi: report.highDpi,
      mapId: maximumLoad.evidence?.mapId,
      content: maximumLoad.evidence?.content,
      surface: maximumLoad.evidence?.surface,
      devicePixelRatio: maximumLoad.evidence?.devicePixelRatio,
      selectedWorldZoom: maximumLoad.evidence?.selectedWorldZoom,
      camera: maximumLoad.evidence?.camera,
      uiScale: maximumLoad.evidence?.uiScale,
      testedCommit: report.testedCommit,
      packageProvenance: report.packageProvenance,
    };
  };
  if (JSON.stringify(inputRecord(reports.legacy)) !== JSON.stringify(inputRecord(reports.enhanced))) {
    throw new Error('Legacy and enhanced art-mode inputs or package provenance do not match.');
  }
  const modeRecord = (mode: 'legacy' | 'enhanced') => {
    const maximumLoad = reports[mode].maximumLoad as Record<string, unknown> | null;
    if (!maximumLoad) throw new Error(`${mode} art mode did not emit maximum-load evidence.`);
    const evidence = maximumLoad.evidence as Record<string, unknown>;
    if (evidence.artMode !== mode) throw new Error(`${mode} art mode reported ${String(evidence.artMode)}.`);
    const requiredNumber = (field: string): number => {
      const value = maximumLoad[field];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${mode} art mode has invalid ${field}.`);
      }
      return value;
    };
    const staticBatchCount = evidence.staticBatchCount;
    if (typeof staticBatchCount !== 'number' || !Number.isInteger(staticBatchCount) || staticBatchCount < 1) {
      throw new Error(`${mode} art mode has invalid staticBatchCount.`);
    }
    return {
      rendererFps: requiredNumber('rendererFps'),
      displayRafFps: requiredNumber('displayRafFps'),
      medianFrameTimeMilliseconds: requiredNumber('medianFrameTimeMilliseconds'),
      roundedFps: requiredNumber('roundedFps'),
      drawCounts: evidence.drawCounts,
      staticBatchCount,
      presentationHash: evidence.presentationHash,
      report: `${mode}/responsive-report.json`,
      screenshot: `${mode}/${String(maximumLoad.screenshot)}`,
    };
  };
  const legacy = modeRecord('legacy');
  const enhanced = modeRecord('enhanced');
  const nonPresentationCounts = (drawCounts: Record<string, unknown>) => Object.fromEntries(
    Object.entries(drawCounts).filter(([key]) => key !== 'floor' && key !== 'total'),
  );
  if (JSON.stringify(nonPresentationCounts(legacy.drawCounts as Record<string, unknown>)) !==
      JSON.stringify(nonPresentationCounts(enhanced.drawCounts as Record<string, unknown>))) {
    throw new Error('Legacy and enhanced art modes changed non-presentation draw counts.');
  }
  const performanceAcceptance = validateArtModePerformance(
    legacy,
    enhanced,
    performanceFixture.maximumLoad.minimumRoundedFps,
  );
  const comparisonPath = join(evidenceRoot, 'art-mode-comparison-report.json');
  writeFileSync(comparisonPath, `${JSON.stringify({
    schemaVersion: 1,
    compareArtModes: true,
    includeMaximumLoad: true,
    qualification,
    testedCommit: reports.legacy.testedCommit,
    packageProvenance,
    matchedInputs: inputRecord(reports.legacy),
    performanceAcceptance,
    modes: { legacy, enhanced },
  }, null, 2)}\n`, { encoding: 'utf8', flush: true });
  process.stdout.write(`Responsive art-mode comparison: ${comparisonPath}\n`);
  process.exit(0);
}

const smokeUserData = mkdtempSync(join(tmpdir(), 'si-world-responsive-smoke-'));
const child = spawn(executable, [`--force-device-scale-factor=${requestedDeviceScaleFactor}`], {
  detached: false,
  env: {
    ...process.env,
    SI_WORLD_RESPONSIVE_HIGH_DPI: highDpi ? '1' : '0',
    SI_WORLD_RESPONSIVE_DEVICE_SCALE_FACTOR: String(requestedDeviceScaleFactor),
    SI_WORLD_RESPONSIVE_SCREENSHOT_DIR: evidenceRoot,
    SI_WORLD_RESPONSIVE_SMOKE: '1',
    SI_WORLD_SMOKE: '1',
    ...(artMode ? { SI_WORLD_ART_MODE: artMode } : {}),
    ...(qualification ? { SI_WORLD_SMOKE_PROFILE: 'qualification' } : {}),
    SI_WORLD_SMOKE_USER_DATA: smokeUserData,
  },
  shell: false,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

let stdout = '';
let stderr = '';
const appendBounded = (current: string, chunk: Buffer): string => `${current}${chunk.toString('utf8')}`.slice(-2_000_000);
child.stdout.on('data', (chunk: Buffer) => {
  stdout = appendBounded(stdout, chunk);
  chunk.toString('utf8').split(/\r?\n/u)
    .filter((line) => line.startsWith('SI_WORLD_RESPONSIVE_PROGRESS '))
    .forEach((line) => process.stderr.write(`${line}\n`));
});
child.stderr.on('data', (chunk: Buffer) => { stderr = appendBounded(stderr, chunk); });

let timedOut = false;
const timeout = setTimeout(() => {
  timedOut = true;
  child.kill('SIGKILL');
}, 300_000);

child.once('error', (error) => {
  clearTimeout(timeout);
  rmSync(smokeUserData, { recursive: true, force: true });
  throw error;
});

child.once('close', (code) => {
  clearTimeout(timeout);
  try {
    if (code !== 0) {
      throw new Error(`Responsive package smoke ${timedOut ? 'timed out' : `exited with ${String(code)}`}. ${stderr.slice(-5_000)} ${stdout.slice(-5_000)}`);
    }
    const prefix = 'SI_WORLD_RESPONSIVE_SMOKE_RESULT ';
    const line = stdout.split(/\r?\n/u).find((candidate) => candidate.startsWith(prefix));
    if (!line) throw new Error('Packaged app did not emit responsive smoke evidence.');
    const report = ResponsiveSmokeSchema.parse(JSON.parse(line.slice(prefix.length)) as unknown);
    if (report.requestedDeviceScaleFactor !== requestedDeviceScaleFactor) {
      throw new Error('Responsive smoke device scale factor did not match its request.');
    }
    const expectedTargets = highDpi
      ? [{
        width: performanceFixture.maximumLoad.contentWidth,
        height: performanceFixture.maximumLoad.contentHeight,
      }]
      : [
        { width: 1_280, height: 720 },
        { width: 1_440, height: 900 },
        { width: 1_920, height: 1_080 },
        { width: 2_560, height: 1_440 },
        { width: 1_600, height: 720 },
      ];
    if (JSON.stringify(report.targets.map(({ requested }) => requested)) !== JSON.stringify(expectedTargets)) {
      throw new Error('Responsive smoke target matrix is incomplete or out of order.');
    }
    for (const target of report.targets) {
      if (Math.abs(target.afterResizeEvidence.devicePixelRatio - requestedDeviceScaleFactor) > 0.01) {
        throw new Error(
          `Responsive smoke requested DPR ${requestedDeviceScaleFactor} but measured ${target.afterResizeEvidence.devicePixelRatio}.`,
        );
      }
      if (target.afterResizeEvidence.content.width !== target.requested.width ||
          target.afterResizeEvidence.content.height !== target.requested.height) {
        throw new Error('Responsive evidence did not match the requested content size.');
      }
      const expectedCenter = expectedResizedCenter(
        target.centerBefore,
        target.measuredSurface,
        target.afterResizeEvidence.selectedWorldZoom,
        report.geometry.map,
      );
      if (Math.abs(expectedCenter.x - target.centerAfter.x) > 1 ||
          Math.abs(expectedCenter.y - target.centerAfter.y) > 1) {
        throw new Error(
          `Responsive resize did not preserve the centered world point at ${target.requested.width}x${target.requested.height}: ` +
          `${JSON.stringify({ before: target.centerBefore, expected: expectedCenter, after: target.centerAfter })}`,
        );
      }
      if (target.conversationEvidence.activePanel?.id !== 'world-ui-conversation-panel' ||
          !target.conversationEvidence.conversationInput) {
        throw new Error('Responsive conversation geometry is incomplete.');
      }
      const zoomPaths = target.screenshots.zoom.map((name) => join(evidenceRoot, name));
      validateWorldZoomEvidence(zoomPaths);
      const conversationPath = join(evidenceRoot, target.screenshots.conversation);
      validateScreenshotBuffers(readFileSync(zoomPaths[0]!), readFileSync(conversationPath));
      const decoded = PNG.sync.read(readFileSync(conversationPath));
      if (decoded.width < 640 || decoded.height < 360) throw new Error('Responsive conversation screenshot is too small.');
    }
    if (highDpi) {
      if (!report.maximumLoad ||
          report.maximumLoad.evidence.devicePixelRatio < performanceFixture.maximumLoad.minimumDevicePixelRatio ||
          report.maximumLoad.evidence.selectedWorldZoom !== performanceFixture.maximumLoad.selectedWorldZoom) {
        throw new Error('High-DPI maximum-load evidence is missing.');
      }
      for (const layer of performanceFixture.maximumLoad.requiredLayers) {
        if (report.maximumLoad.evidence.drawCounts[layer] <= 0) {
          throw new Error(`High-DPI maximum-load evidence is missing layer ${layer}.`);
        }
      }
      if (report.maximumLoad.qualificationRequired &&
          report.maximumLoad.roundedFps < performanceFixture.maximumLoad.minimumRoundedFps) {
        throw new Error('High-DPI maximum-load qualification did not pass rounded 60 FPS.');
      }
      const maximumLoadPath = join(evidenceRoot, report.maximumLoad.screenshot);
      const decoded = PNG.sync.read(readFileSync(maximumLoadPath));
      if (decoded.width < performanceFixture.maximumLoad.contentWidth ||
          decoded.height < performanceFixture.maximumLoad.contentHeight) {
        throw new Error('High-DPI maximum-load screenshot dimensions are incomplete.');
      }
    } else if (report.maximumLoad !== null) {
      throw new Error('Ordinary responsive smoke emitted unexpected maximum-load evidence.');
    }
    if ((report.fullCastPortraitMatrix !== null) !== fullCastPortraitSmoke) {
      throw new Error('Responsive full-cast portrait matrix mode did not match its request.');
    }
    if (report.fullCastPortraitMatrix) {
      const expected = [1, 1.25, 1.5].flatMap((uiScale) => (
        CHARACTER_IDS.map((characterId) => ({ characterId, uiScale }))
      ));
      const actual = report.fullCastPortraitMatrix.map(({ characterId, uiScale }) => ({ characterId, uiScale }));
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error('Responsive full-cast portrait matrix is incomplete or out of order.');
      }
      for (const entry of report.fullCastPortraitMatrix) {
        if (entry.evidence.uiScale !== entry.uiScale ||
            entry.evidence.activePanel?.id !== 'world-ui-conversation-panel' ||
            !entry.evidence.conversationInput) {
          throw new Error(`Responsive portrait ${entry.characterId} at ${entry.uiScale}x lacks panel evidence.`);
        }
        const screenshotPath = join(evidenceRoot, entry.screenshot);
        const decoded = PNG.sync.read(readFileSync(screenshotPath));
        if (decoded.width < 1_280 || decoded.height < 720) {
          throw new Error(`Responsive portrait ${entry.screenshot} is too small.`);
        }
      }
    }
    const evidencePath = join(evidenceRoot, 'responsive-report.json');
    writeFileSync(evidencePath, `${JSON.stringify({
      ...report,
      evidenceSource,
      packageProvenance,
      testedCommit: resolveTestedCommit(),
    }, null, 2)}\n`, { encoding: 'utf8', flush: true });
    process.stdout.write(`Responsive packaged smoke: ${evidencePath}\n`);
  } finally {
    rmSync(smokeUserData, { recursive: true, force: true });
  }
});
