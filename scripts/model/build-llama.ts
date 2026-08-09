import { access, copyFile, mkdir } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

import { LLAMA_CPP } from './model-pins';
import { capture, run } from './process';

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

async function main(): Promise<void> {
  const root = requireModelRoot();
  const sourceRoot = join(root, 'sources', 'llama.cpp');
  const buildRoot = join(root, 'build', 'llama.cpp-static-no-ui');
  const runtimeRoot = join(root, 'runtime', `${process.platform}-${process.arch}`);
  const projectRoot = join(import.meta.dirname, '..', '..');
  await mkdir(join(root, 'sources'), { recursive: true });
  await mkdir(join(root, 'build'), { recursive: true });
  await mkdir(runtimeRoot, { recursive: true });

  if (!(await pathExists(join(sourceRoot, '.git')))) {
    await run('git', ['clone', '--filter=blob:none', LLAMA_CPP.repository, sourceRoot], root);
  }
  await run('git', ['-C', sourceRoot, 'fetch', 'origin', LLAMA_CPP.revision], root);
  await run('git', ['-C', sourceRoot, 'checkout', '--detach', LLAMA_CPP.revision], root);
  const checkedOutRevision = await capture('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], root);
  const sourceChanges = await capture('git', ['-C', sourceRoot, 'status', '--porcelain'], root);
  if (checkedOutRevision !== LLAMA_CPP.revision || sourceChanges !== '') {
    throw new Error('llama.cpp source is not the clean pinned revision.');
  }

  const platformFlags = process.platform === 'darwin' ? ['-DGGML_METAL=ON'] : [];
  await run(
    'cmake',
    ['-S', sourceRoot, '-B', buildRoot, ...LLAMA_CPP.buildFlags, ...platformFlags],
    root,
  );
  await run(
    'cmake',
    ['--build', buildRoot, '--config', 'Release', '--target', 'llama-server', 'llama-quantize', '-j', '8'],
    root,
  );

  const executableSuffix = process.platform === 'win32' ? '.exe' : '';
  await copyFile(join(buildRoot, 'bin', `llama-server${executableSuffix}`), join(runtimeRoot, `llama-server${executableSuffix}`));
  await copyFile(join(buildRoot, 'bin', `llama-quantize${executableSuffix}`), join(runtimeRoot, `llama-quantize${executableSuffix}`));
  await copyFile(join(sourceRoot, 'LICENSE'), join(runtimeRoot, 'LLAMA-LICENSE'));
  if (process.platform !== 'win32') {
    await run(
      '/usr/bin/cc',
      [
        '-O2',
        '-Wall',
        '-Wextra',
        '-o',
        join(runtimeRoot, 'llama-parent-guard'),
        join(projectRoot, 'scripts', 'model', 'parent-guard.c'),
      ],
      projectRoot,
    );
  }
  process.stdout.write(`${runtimeRoot}\n`);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
