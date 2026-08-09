import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import {
  findPackageArchive,
  findPackagedExecutable,
  parseSmokeResult,
  validatePackageListing,
  validateScreenshotEvidence,
} from './package-smoke-utils';

const outputRoot = join(process.cwd(), 'out');
const executable = findPackagedExecutable(outputRoot);
const archive = findPackageArchive(outputRoot);
const asarCli = join(process.cwd(), 'node_modules/@electron/asar/bin/asar.js');
const listing = execFileSync(process.execPath, [asarCli, 'list', archive], {
  encoding: 'utf8',
  maxBuffer: 10_000_000,
});
validatePackageListing(listing);
const screenshotDirectory = join(process.cwd(), 'artifacts/phase-02');
const screenshotPath = join(screenshotDirectory, 'packaged-electron.png');
const loadingScreenshotPath = join(screenshotDirectory, 'packaged-loading.png');
mkdirSync(screenshotDirectory, { recursive: true });
rmSync(loadingScreenshotPath, { force: true });
rmSync(screenshotPath, { force: true });
const child = spawn(executable, [], {
  detached: false,
  env: {
    ...process.env,
    SI_WORLD_SMOKE: '1',
    SI_WORLD_SMOKE_LOADING_SCREENSHOT: loadingScreenshotPath,
    SI_WORLD_SMOKE_SCREENSHOT: screenshotPath,
  },
  shell: false,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

let stdout = '';
let stderr = '';
const appendBounded = (current: string, chunk: Buffer): string =>
  `${current}${chunk.toString('utf8')}`.slice(-1_000_000);
child.stdout.on('data', (chunk: Buffer) => {
  stdout = appendBounded(stdout, chunk);
});
child.stderr.on('data', (chunk: Buffer) => {
  stderr = appendBounded(stderr, chunk);
});

const timeout = setTimeout(() => child.kill('SIGKILL'), 45_000);
child.once('error', (error) => {
  clearTimeout(timeout);
  throw error;
});
child.once('close', (code) => {
  clearTimeout(timeout);
  if (code !== 0) {
    throw new Error(`Packaged app exited with ${String(code)}. ${stderr.slice(-2_000)}`);
  }
  const report = parseSmokeResult(stdout);
  validateScreenshotEvidence(loadingScreenshotPath, screenshotPath);
  process.stdout.write(
    `Packaged Electron smoke: ${JSON.stringify(report)} loading=${loadingScreenshotPath} ready=${screenshotPath}\n`,
  );
});
