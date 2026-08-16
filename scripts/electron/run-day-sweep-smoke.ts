import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { z } from 'zod';

import { resolveEvidenceOutputRoot } from '../verification/evidence-output';
import { findPackagedExecutable } from './package-smoke-utils';

/**
 * Day-sweep evidence: one scene per district, four times of day, hidden window.
 *
 * The continuous sun is the only part of the lighting work whose claim cannot be settled by a unit
 * test. A test can prove the shadow vector never steps like a bucket; it cannot show that the
 * light sweeps. This runner holds each district's camera, zoom and fixture still and moves only
 * the clock, so every difference between a district's four frames is the sun.
 *
 * One packaged window at device scale 1, `show: false` under SI_WORLD_SMOKE, audio muted, and
 * every screenshot taken with `stayHidden: true`. Nothing here touches the desktop.
 */
const FrameSchema = z.object({
  mapId: z.string().min(1),
  effectId: z.string().min(1),
  minute: z.number().int().nonnegative(),
  screenshot: z.string().min(1),
  camera: z.object({ x: z.number(), y: z.number(), zoom: z.number() }).strict(),
}).strict();
const ResultSchema = z.object({
  schemaVersion: z.literal(1),
  minutes: z.array(z.number().int().nonnegative()).length(4),
  frames: z.array(FrameSchema).length(16),
}).strict();

const outputRoot = process.env.SI_WORLD_PACKAGE_OUTPUT_ROOT
  ? resolve(process.cwd(), process.env.SI_WORLD_PACKAGE_OUTPUT_ROOT)
  : join(process.cwd(), 'out');
const evidenceRoot = resolveEvidenceOutputRoot(process.argv.slice(2), {
  defaultRelative: 'output/verification/day-sweep',
});
const executable = findPackagedExecutable(outputRoot);
const screenshotDirectory = join(evidenceRoot, 'frames');
mkdirSync(screenshotDirectory, { recursive: true });

async function run(): Promise<z.infer<typeof ResultSchema>> {
  const userData = mkdtempSync(join(tmpdir(), 'si-world-day-sweep-'));
  try {
    return await new Promise((resolveRun, rejectRun) => {
      const child = spawn(executable, ['--force-device-scale-factor=1', '--force-prefers-reduced-motion'], {
        env: {
          ...process.env,
          SI_WORLD_DAY_SWEEP_SMOKE: '1',
          SI_WORLD_DAY_SWEEP_SCREENSHOT_DIR: screenshotDirectory,
          SI_WORLD_SMOKE: '1',
          SI_WORLD_SMOKE_USER_DATA: userData,
        },
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      let stdout = '';
      let stderr = '';
      const append = (current: string, chunk: Buffer): string => `${current}${chunk.toString('utf8')}`.slice(-2_000_000);
      child.stdout.on('data', (chunk: Buffer) => { stdout = append(stdout, chunk); });
      child.stderr.on('data', (chunk: Buffer) => { stderr = append(stderr, chunk); });
      const timeout = setTimeout(() => child.kill('SIGKILL'), 300_000);
      child.once('error', (error) => {
        clearTimeout(timeout);
        rejectRun(error);
      });
      child.once('close', (code) => {
        clearTimeout(timeout);
        const prefix = 'SI_WORLD_DAY_SWEEP_SMOKE_RESULT ';
        const line = stdout.split(/\r?\n/u).find((candidate) => candidate.startsWith(prefix));
        if (code !== 0 || !line) {
          rejectRun(new Error(`Day-sweep smoke exited with ${String(code)}. ${stderr.slice(-5_000)} ${stdout.slice(-5_000)}`));
          return;
        }
        try {
          resolveRun(ResultSchema.parse(JSON.parse(line.slice(prefix.length)) as unknown));
        } catch (error) {
          rejectRun(error);
        }
      });
    });
  } finally {
    rmSync(userData, { force: true, recursive: true });
  }
}

async function main(): Promise<void> {
  const result = await run();
  // Every district must be held at ONE camera across its four minutes, or the frames record a
  // camera move rather than a sun move and the whole sheet means nothing.
  for (const mapId of [...new Set(result.frames.map((frame) => frame.mapId))]) {
    const cameras = result.frames.filter((frame) => frame.mapId === mapId).map(({ camera }) => JSON.stringify(camera));
    if (new Set(cameras).size !== 1) {
      throw new Error(`Day sweep moved the camera on ${mapId}: ${[...new Set(cameras)].join(' ')}`);
    }
  }
  writeFileSync(join(evidenceRoot, 'day-sweep-report.json'), `${JSON.stringify(result, undefined, 2)}\n`);
  process.stdout.write(`Day sweep captured ${result.frames.length} frames into ${evidenceRoot}\n`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
