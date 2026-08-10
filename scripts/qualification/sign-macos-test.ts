import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { access, mkdir, readdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

async function filesUnder(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  }));
  return nested.flat();
}

async function directoriesUnder(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
    const path = join(root, entry.name);
    return [path, ...(await directoriesUnder(path))];
  }));
  return nested.flat();
}

async function sha256(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

async function main(): Promise<void> {
  if (process.platform !== 'darwin') throw new Error('macOS test signing requires macOS.');
  const outputRoot = resolve(process.cwd(), process.argv[2] ?? 'out');
  const reportPath = resolve(
    process.cwd(),
    process.argv[3] ?? 'artifacts/phase-14/signing/macos-test-signature.json',
  );
  const applicationCandidates = (await directoriesUnder(outputRoot)).filter((path) => path.endsWith('.app'));
  const applications = (await Promise.all(applicationCandidates.map(async (path) =>
    access(join(path, 'Contents', 'MacOS', 'si-world')).then(() => path, () => undefined),
  ))).filter((path): path is string => Boolean(path));
  if (applications.length !== 1 || !applications[0]) {
    throw new Error(`Expected one macOS application bundle, found ${applications.length}.`);
  }
  const application = applications[0];
  await execFileAsync('codesign', ['--force', '--deep', '--sign', '-', '--timestamp=none', application]);
  await execFileAsync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', application]);
  const details = await execFileAsync('codesign', ['--display', '--verbose=4', application]);
  const source = `${details.stdout}\n${details.stderr}`;
  const signature = /^Signature=(.+)$/mu.exec(source)?.[1]?.trim();
  const cdHash = /^CDHash=([A-Fa-f0-9]+)$/mu.exec(source)?.[1]?.toLowerCase();
  if (signature !== 'adhoc' || !cdHash) {
    throw new Error('The macOS bundle does not have the expected ad-hoc signature.');
  }
  const executables = await filesUnder(join(application, 'Contents', 'MacOS'));
  const mainExecutable = executables.find((path) => basename(path) === 'si-world');
  if (!mainExecutable) throw new Error('The signed main executable is missing.');
  await mkdir(resolve(reportPath, '..'), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    testedCommit: process.env.GITHUB_SHA ?? null,
    artifact: basename(application),
    signatureType: 'ad-hoc',
    releaseTrusted: false,
    notarized: false,
    cdHash,
    mainExecutableSha256: await sha256(mainExecutable),
    verification: 'codesign --verify --deep --strict',
  }, null, 2)}\n`, { encoding: 'utf8', flush: true });
  process.stdout.write(`macOS ad-hoc signature verified: ${basename(application)}\n`);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
