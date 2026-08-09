import { access, copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

import { LLAMA_CPP, MODEL_PINS } from './model-pins';
import { run } from './process';

function requireModelRoot(): string {
  const root = process.env.SI_WORLD_MODEL_ROOT;
  if (!root || !isAbsolute(root)) {
    throw new Error('SI_WORLD_MODEL_ROOT must be an absolute external directory.');
  }
  return root;
}

async function pathExists(candidate: string): Promise<boolean> {
  return access(candidate).then(() => true, () => false);
}

async function ensureConversionEnvironment(root: string, llamaSourceRoot: string): Promise<void> {
  const python = join(root, 'venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const hf = join(root, 'venv', process.platform === 'win32' ? 'Scripts/hf.exe' : 'bin/hf');
  if (await pathExists(python) && await pathExists(hf)) {
    return;
  }
  const hostPython = process.platform === 'win32' ? 'python' : 'python3';
  await run(hostPython, ['-m', 'venv', join(root, 'venv')], root);
  await run(
    python,
    [
      '-m',
      'pip',
      'install',
      '-r',
      join(llamaSourceRoot, 'requirements', 'requirements-convert_hf_to_gguf.txt'),
      'huggingface_hub==0.36.2',
    ],
    root,
  );
}

async function prepare(size: '4b' | '9b', root: string): Promise<void> {
  const pin = MODEL_PINS[size];
  const sourceRoot = join(root, 'models', 'source', pin.repository.split('/')[1] as string);
  const ggufRoot = join(root, 'models', 'gguf');
  const intermediatePath = join(ggufRoot, `${pin.id}-f16.gguf`);
  const outputPath = join(ggufRoot, pin.outputFileName);
  const partialOutputPath = `${outputPath}.partial`;
  const llamaSourceRoot = join(root, 'sources', 'llama.cpp');
  const runtimeRoot = join(root, 'runtime', `${process.platform}-${process.arch}`);
  const executableSuffix = process.platform === 'win32' ? '.exe' : '';
  const python = join(root, 'venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const hf = join(root, 'venv', process.platform === 'win32' ? 'Scripts/hf.exe' : 'bin/hf');

  await ensureConversionEnvironment(root, llamaSourceRoot);
  await mkdir(sourceRoot, { recursive: true });
  await mkdir(ggufRoot, { recursive: true });
  const revisionMarkerPath = join(sourceRoot, '.si-world-revision');
  const completedRevision = await readFile(revisionMarkerPath, 'utf8').catch(() => '');
  if (completedRevision.trim() !== pin.revision) {
    await run(hf, ['download', pin.repository, '--revision', pin.revision, '--local-dir', sourceRoot], root);
    await writeFile(revisionMarkerPath, `${pin.revision}\n`, { encoding: 'utf8', flush: true });
  }
  if (!(await pathExists(outputPath))) {
    await run(
      python,
      [join(llamaSourceRoot, 'convert_hf_to_gguf.py'), sourceRoot, '--outfile', intermediatePath, '--outtype', 'f16'],
      root,
    );
    await rm(partialOutputPath, { force: true });
    await run(
      join(runtimeRoot, `llama-quantize${executableSuffix}`),
      [intermediatePath, partialOutputPath, 'Q4_K_M'],
      root,
    );
    await rename(partialOutputPath, outputPath);
    await rm(intermediatePath, { force: true });
  }
  await copyFile(join(sourceRoot, 'LICENSE'), join(ggufRoot, `${pin.id}-LICENSE`));
  process.stdout.write(`${outputPath}\n`);
}

async function main(): Promise<void> {
  const root = requireModelRoot();
  const requested = process.argv[2] ?? 'all';
  if (!['4b', '9b', 'all'].includes(requested)) {
    throw new Error('Usage: prepare-model.ts [4b|9b|all]');
  }
  if (requested === '4b' || requested === 'all') {
    await prepare('4b', root);
  }
  if (requested === '9b' || requested === 'all') {
    await prepare('9b', root);
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
