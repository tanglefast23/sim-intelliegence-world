import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { PNG } from 'pngjs';
import { z } from 'zod';

import { resolveEvidenceSource } from '../qualification/evidence-source';
import { resolveEvidenceOutputRoot } from '../verification/evidence-output';
import { EXPECTED_VFX_ANCHORS } from '../../src/render/vfx/fixtures';
import { VfxEvidenceSchema } from '../../src/render/vfx/evidence';
import { VFX_KINDS } from '../../src/render/vfx/types';
import { findPackagedExecutable, validateWorldZoomEvidence } from './package-smoke-utils';
import { validateVfxModePerformance } from './vfx-mode-performance';

const CameraSchema = z.object({ x: z.number(), y: z.number(), zoom: z.union([z.literal(1), z.literal(2), z.literal(3)]) }).strict();
const AnchorSchema = z.object({
  mapId: z.string().min(1),
  id: z.string().min(1),
  kind: z.enum(VFX_KINDS),
  x: z.number().int(),
  y: z.number().int(),
  fixtureEvidence: VfxEvidenceSchema,
  camera: CameraSchema,
  screenshots: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]),
}).strict();
const MaximumLoadSchema = z.object({
  rendererFps: z.number().positive(),
  displayRafFps: z.number().positive(),
  medianFrameTimeMilliseconds: z.number().positive(),
  sampledFrames: z.number().int().positive(),
  cameraChangeFrames: z.number().int().positive(),
  roundedFps: z.number().int().positive(),
  evidence: VfxEvidenceSchema,
}).strict();
const VfxSmokeSchema = z.object({
  schemaVersion: z.literal(1),
  mode: z.enum(['circle', 'procedural']),
  motionMode: z.enum(['standard', 'reduced']),
  artPresentation: z.string().startsWith('Art mode enhanced;'),
  contentSize: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }).strict(),
  devicePixelRatio: z.number().min(2),
  anchors: z.array(AnchorSchema).length(EXPECTED_VFX_ANCHORS.length),
  pause: z.object({
    frozen: z.literal(true),
    ageStep: z.number().int().nonnegative(),
    pausedScreenshot: z.string().min(1),
    resumedAgeStep: z.number().int().nonnegative(),
    resumedScreenshot: z.string().min(1),
  }).strict(),
  maximumLoad: MaximumLoadSchema,
}).strict();
type VfxSmoke = z.infer<typeof VfxSmokeSchema>;

const arguments_ = process.argv.slice(2);
const compareVfxModes = arguments_.includes('--compare-vfx-modes');
const includeMaximumLoad = arguments_.includes('--include-maximum-load');
const qualification = arguments_.includes('--qualification');
if (compareVfxModes && !includeMaximumLoad) {
  throw new Error('--compare-vfx-modes requires --include-maximum-load.');
}

const evidenceRoot = resolveEvidenceOutputRoot(arguments_, {
  allowedFlags: ['--compare-vfx-modes', '--include-maximum-load', '--qualification'],
  defaultRelative: 'output/verification/procedural-vfx',
});
mkdirSync(evidenceRoot, { recursive: true });
const packageRoot = process.env.SI_WORLD_PACKAGE_OUTPUT_ROOT
  ? resolve(process.cwd(), process.env.SI_WORLD_PACKAGE_OUTPUT_ROOT)
  : resolve(process.cwd(), 'out');
const executable = findPackagedExecutable(packageRoot);
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
  executableSizeBytes: executableStats.size,
  payload,
  payloadSizeBytes: payloadBytes.length,
  payloadSha256: createHash('sha256').update(payloadBytes).digest('hex'),
});
const evidenceSource = resolveEvidenceSource([
  'electron/main/index.ts',
  'electron/preload/index.ts',
  'scripts/electron/run-procedural-vfx-package-smoke.ts',
  'scripts/electron/vfx-mode-performance.ts',
  'src/application/DesktopBridge.ts',
  'src/render/WorldScene.tsx',
  'src/render/vfx/ProceduralMapEffects.tsx',
  'src/render/vfx/clock.ts',
  'src/render/vfx/evidence.ts',
  'src/render/vfx/fixtures.ts',
  'src/render/vfx/procedural-effects.ts',
  'src/render/vfx/seed.ts',
  'src/render/vfx/types.ts',
]);

function assertExpectedAnchors(report: VfxSmoke): void {
  const actual = report.anchors.map(({ mapId, id, kind, x, y }) => ({ mapId, id, kind, x, y }));
  if (JSON.stringify(actual) !== JSON.stringify(EXPECTED_VFX_ANCHORS)) {
    throw new Error(`Package VFX anchors do not match the authored fixture: ${JSON.stringify(actual)}.`);
  }
}

function runMode(mode: 'circle' | 'procedural', motionMode: 'standard' | 'reduced'): VfxSmoke {
  const modeRoot = join(evidenceRoot, `${mode}-${motionMode}`);
  mkdirSync(modeRoot, { recursive: true });
  const userData = mkdtempSync(join(tmpdir(), 'si-world-vfx-smoke-'));
  try {
    const child = spawnSync(executable, ['--force-device-scale-factor=2'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        SI_WORLD_PROCEDURAL_VFX_REDUCED: motionMode === 'reduced' ? '1' : '0',
        SI_WORLD_PROCEDURAL_VFX_SCREENSHOT_DIR: modeRoot,
        SI_WORLD_PROCEDURAL_VFX_SMOKE: '1',
        SI_WORLD_RESPONSIVE_HIGH_DPI: '1',
        SI_WORLD_SMOKE: '1',
        SI_WORLD_SMOKE_PROFILE: qualification ? 'qualification' : 'platform-shell',
        SI_WORLD_SMOKE_USER_DATA: userData,
        SI_WORLD_VFX_MODE: mode,
      },
      maxBuffer: 20 * 1024 * 1024,
      shell: false,
      timeout: 300_000,
      windowsHide: true,
    });
    if (child.error) throw child.error;
    if (child.status !== 0) {
      throw new Error(`Procedural VFX package smoke exited with ${String(child.status)}. ${child.stderr.slice(-5_000)} ${child.stdout.slice(-5_000)}`);
    }
    const prefix = 'SI_WORLD_PROCEDURAL_VFX_SMOKE_RESULT ';
    const line = child.stdout.split(/\r?\n/u).find((candidate) => candidate.startsWith(prefix));
    if (!line) throw new Error('Packaged app did not emit procedural VFX evidence.');
    const report = VfxSmokeSchema.parse(JSON.parse(line.slice(prefix.length)) as unknown);
    if (report.mode !== mode || report.motionMode !== motionMode) {
      throw new Error(`Packaged VFX mode mismatch: expected ${mode}/${motionMode}.`);
    }
    assertExpectedAnchors(report);
    for (const anchor of report.anchors) {
      validateWorldZoomEvidence(anchor.screenshots.map((name) => join(modeRoot, name)));
    }
    return report;
  } finally {
    rmSync(userData, { recursive: true, force: true });
  }
}

function writeGrayscaleProof(sourcePath: string, destinationPath: string): void {
  const image = PNG.sync.read(readFileSync(sourcePath));
  for (let offset = 0; offset < image.data.length; offset += 4) {
    const luminance = Math.round(
      (image.data[offset] ?? 0) * 0.2126 +
      (image.data[offset + 1] ?? 0) * 0.7152 +
      (image.data[offset + 2] ?? 0) * 0.0722,
    );
    image.data[offset] = luminance;
    image.data[offset + 1] = luminance;
    image.data[offset + 2] = luminance;
  }
  writeFileSync(destinationPath, PNG.sync.write(image), { flush: true });
}

const runKeys = compareVfxModes
  ? [
    ['circle', 'standard'],
    ['procedural', 'standard'],
    ['circle', 'reduced'],
    ['procedural', 'reduced'],
  ] as const
  : [['procedural', 'standard']] as const;
const reports = Object.fromEntries(runKeys.map(([mode, motionMode]) => [
  `${mode}-${motionMode}`,
  runMode(mode, motionMode),
])) as Record<string, VfxSmoke>;

let performanceAcceptance: ReturnType<typeof validateVfxModePerformance> | null = null;
let grayscaleProof: Readonly<{ fire: string; sparkle: string }> | null = null;
if (compareVfxModes) {
  const circle = reports['circle-standard'];
  const procedural = reports['procedural-standard'];
  if (!circle || !procedural) throw new Error('VFX comparison reports are incomplete.');
  performanceAcceptance = validateVfxModePerformance(circle.maximumLoad, procedural.maximumLoad, 60);
  const fire = procedural.anchors.find(({ kind }) => kind === 'fire');
  const sparkle = procedural.anchors.find(({ kind }) => kind === 'sparkle');
  if (!fire || !sparkle) throw new Error('Grayscale VFX proof requires fire and sparkle anchors.');
  const fireName = 'procedural-fire-1x-grayscale.png';
  const sparkleName = 'procedural-sparkle-1x-grayscale.png';
  writeGrayscaleProof(
    join(evidenceRoot, 'procedural-standard', fire.screenshots[0]),
    join(evidenceRoot, fireName),
  );
  writeGrayscaleProof(
    join(evidenceRoot, 'procedural-standard', sparkle.screenshots[0]),
    join(evidenceRoot, sparkleName),
  );
  grayscaleProof = { fire: fireName, sparkle: sparkleName };
}

const reportPath = join(evidenceRoot, 'procedural-vfx-package-report.json');
writeFileSync(reportPath, `${JSON.stringify({
  schemaVersion: 1,
  compareVfxModes,
  includeMaximumLoad,
  qualification,
  testedCommit: evidenceSource.baseCommit,
  evidenceSource,
  packageProvenance,
  performanceAcceptance,
  grayscaleProof,
  runs: reports,
}, null, 2)}\n`, { encoding: 'utf8', flush: true });
process.stdout.write(`Procedural VFX package report: ${reportPath}\n`);
