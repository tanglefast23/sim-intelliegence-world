import { execFileSync, spawn } from 'node:child_process';
import { dirname, join } from 'node:path';

import { z } from 'zod';

import { findPackagedExecutable } from '../electron/package-smoke-utils';

const ReportSchema = z
  .object({
    modelId: z.enum(['qwen3.5-9b', 'qwen3.5-4b']),
    source: z.literal('model'),
    attempts: z.union([z.literal(1), z.literal(2)]),
    loadingHealthObserved: z.literal(true),
    responseValidated: z.literal(true),
    restartCount: z.literal(2),
    circuitOpened: z.literal(true),
    fallbackAfterCircuit: z.literal(true),
    restartAfterStopRejected: z.literal(true),
    stoppedCleanly: z.literal(true),
  })
  .strict();

const executable = findPackagedExecutable(join(process.cwd(), 'out'));
const child = spawn(executable, [], {
  detached: false,
  env: { ...process.env, SI_WORLD_MODEL_SMOKE: '1' },
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
const timeout = setTimeout(() => child.kill('SIGKILL'), 180_000);
child.once('error', (error) => {
  clearTimeout(timeout);
  throw error;
});
child.once('close', (code) => {
  clearTimeout(timeout);
  if (code !== 0) {
    throw new Error(`Packaged model smoke exited with ${String(code)}. ${stderr.slice(-4_000)}`);
  }
  const prefix = 'SI_WORLD_MODEL_SMOKE_RESULT ';
  const resultLine = stdout.split(/\r?\n/u).find((line) => line.startsWith(prefix));
  if (!resultLine) {
    throw new Error('Packaged app did not emit a model smoke result.');
  }
  const report = ReportSchema.parse(JSON.parse(resultLine.slice(prefix.length)) as unknown);
  const applicationRoot = process.platform === 'darwin'
    ? join(dirname(executable), '..', 'Resources', 'model-runtime')
    : join(dirname(executable), 'resources', 'model-runtime');
  const processListing = execFileSync('ps', ['-axo', 'command='], { encoding: 'utf8' });
  if (processListing.split(/\r?\n/u).some((line) => line.includes(applicationRoot))) {
    throw new Error('A packaged llama-server process remained after application exit.');
  }
  process.stdout.write(`Packaged model smoke: ${JSON.stringify(report)}\n`);
});
