import { spawn } from 'node:child_process';

export async function run(command: string, args: readonly string[], cwd: string): Promise<void> {
  await new Promise<void>((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      shell: false,
      stdio: 'inherit',
      windowsHide: true,
    });
    child.once('error', rejectRun);
    child.once('close', (code, signal) => {
      if (code === 0) {
        resolveRun();
      } else {
        rejectRun(new Error(`${command} failed with code ${String(code)} and signal ${String(signal)}.`));
      }
    });
  });
}

export async function capture(command: string, args: readonly string[], cwd: string): Promise<string> {
  return new Promise<string>((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout = `${stdout}${chunk.toString('utf8')}`.slice(-1_000_000);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString('utf8')}`.slice(-1_000_000);
    });
    child.once('error', rejectRun);
    child.once('close', (code) => {
      if (code === 0) {
        resolveRun(stdout.trim());
      } else {
        rejectRun(new Error(`${command} failed with code ${String(code)}: ${stderr.slice(-2_000)}`));
      }
    });
  });
}
