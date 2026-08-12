import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as unknown;
if (typeof electronPath !== 'string') {
  throw new Error('The Electron executable could not be resolved.');
}

const child = spawn(electronPath, [resolve('build/electron/main/index.js')], {
  cwd: process.cwd(),
  detached: false,
  env: {
    ...process.env,
    SI_WORLD_DEV_HARNESS: '1',
    SI_WORLD_DEV_HARNESS_ROOT: resolve('.'),
  },
  shell: false,
  stdio: 'inherit',
  windowsHide: false,
});

child.once('error', (error) => {
  throw error;
});
child.once('close', (code) => {
  process.exitCode = code ?? 1;
});
