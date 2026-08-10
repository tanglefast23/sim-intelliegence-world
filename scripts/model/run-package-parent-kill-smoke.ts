import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';

import { findPackagedExecutable } from '../electron/package-smoke-utils';

const execFileAsync = promisify(execFile);

async function modelProcessIds(modelExecutable: string): Promise<number[]> {
  const { stdout } = await execFileAsync('ps', ['-axo', 'pid=,command='], { maxBuffer: 1_000_000 });
  return stdout
    .split(/\r?\n/u)
    .map((line) => /^(\d+)\s+(.+)$/u.exec(line.trim()))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .filter((match) => match[2] === modelExecutable || match[2]?.startsWith(`${modelExecutable} `))
    .map((match) => Number(match[1]));
}

async function waitForModel(modelExecutable: string): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if ((await modelProcessIds(modelExecutable)).length === 1) {
      return;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
  }
  throw new Error('Packaged llama-server did not start for the parent-death probe.');
}

async function waitForChildExit(child: ReturnType<typeof spawn>): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  await Promise.race([
    new Promise<void>((resolveClose) => child.once('close', () => resolveClose())),
    new Promise<never>((_resolve, reject) =>
      setTimeout(() => reject(new Error('Packaged Electron process did not exit in time.')), 5_000),
    ),
  ]);
}

async function killProcesses(processIds: readonly number[]): Promise<void> {
  for (const processId of processIds) {
    try {
      process.kill(processId, 'SIGKILL');
    } catch {
      // A process can exit between the listing and the signal.
    }
  }
}

async function main(): Promise<void> {
  const outputRoot = process.env.SI_WORLD_PACKAGE_OUTPUT_ROOT
    ? resolve(process.cwd(), process.env.SI_WORLD_PACKAGE_OUTPUT_ROOT)
    : join(process.cwd(), 'out');
  const applicationExecutable = findPackagedExecutable(outputRoot);
  const modelExecutable = process.platform === 'darwin'
    ? join(dirname(applicationExecutable), '..', 'Resources', 'model-runtime', 'llama-server')
    : join(dirname(applicationExecutable), 'resources', 'model-runtime', 'llama-server.exe');
  const child = spawn(applicationExecutable, [], {
    detached: false,
    env: { ...process.env, SI_WORLD_MODEL_SMOKE: '1' },
    shell: false,
    stdio: 'ignore',
    windowsHide: true,
  });
  try {
    if (!child.pid) {
      throw new Error('Packaged Electron process did not expose a PID.');
    }
    await waitForModel(modelExecutable);
    process.kill(child.pid, 'SIGKILL');
    await waitForChildExit(child);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000));
    const leakedPids = await modelProcessIds(modelExecutable);
    await killProcesses(leakedPids);
    if (leakedPids.length !== 0) {
      throw new Error(`Forced Electron death leaked ${leakedPids.length} llama-server process.`);
    }
    process.stdout.write('Packaged parent-death smoke: no leaked llama-server process.\n');
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
      await waitForChildExit(child).catch(() => undefined);
    }
    await killProcesses(await modelProcessIds(modelExecutable).catch(() => []));
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
