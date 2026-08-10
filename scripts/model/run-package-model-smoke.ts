import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { z } from 'zod';

import { findPackagedExecutable } from '../electron/package-smoke-utils';
import { resolveEvidenceSource } from '../qualification/evidence-source';
import { resolveTestedCommit } from '../qualification/tested-commit';

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

const outputRoot = process.env.SI_WORLD_PACKAGE_OUTPUT_ROOT
  ? resolve(process.cwd(), process.env.SI_WORLD_PACKAGE_OUTPUT_ROOT)
  : join(process.cwd(), 'out');
const executable = findPackagedExecutable(outputRoot);
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
  const reportPath = process.env.SI_WORLD_MODEL_SMOKE_REPORT;
  if (reportPath) {
    const absoluteReportPath = resolve(process.cwd(), reportPath);
    const evidenceSource = resolveEvidenceSource([
      'electron/model/conversation-inference.ts',
      'electron/model/model-smoke.ts',
      'electron/model/model-supervisor.ts',
      'scripts/model/run-package-model-smoke.ts',
    ]);
    mkdirSync(dirname(absoluteReportPath), { recursive: true });
    writeFileSync(absoluteReportPath, `${JSON.stringify({
      schemaVersion: 1,
      evidenceSource,
      testedCommit: resolveTestedCommit(),
      ...report,
      leakedProcess: false,
    }, null, 2)}\n`, { encoding: 'utf8', flush: true });
  }
  process.stdout.write(`Packaged model smoke: ${JSON.stringify(report)}\n`);
});
