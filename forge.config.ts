import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, isAbsolute, join } from 'node:path';
import { promisify } from 'node:util';

import { MakerZIP } from '@electron-forge/maker-zip';
import type { ForgeConfig } from '@electron-forge/shared-types';

const execFileAsync = promisify(execFile);

const packagedApplicationName = 'SI World';
const modelResourceRoot = process.env.SI_WORLD_MODEL_RESOURCE_DIR;
const packageOutputRoot = process.env.SI_WORLD_PACKAGE_OUTPUT_ROOT;
if (
  modelResourceRoot &&
  (!isAbsolute(modelResourceRoot) || basename(modelResourceRoot) !== 'model-runtime')
) {
  throw new Error('SI_WORLD_MODEL_RESOURCE_DIR must be an absolute model-runtime directory.');
}
if (packageOutputRoot && !isAbsolute(packageOutputRoot)) {
  throw new Error('SI_WORLD_PACKAGE_OUTPUT_ROOT must be an absolute directory while packaging.');
}

const config: ForgeConfig = {
  ...(packageOutputRoot ? { outDir: packageOutputRoot } : {}),
  packagerConfig: {
    appBundleId: 'com.tanglefast.si-world',
    asar: true,
    executableName: 'si-world',
    extraResource: ['content', ...(modelResourceRoot ? [modelResourceRoot] : [])],
    name: packagedApplicationName,
    overwrite: true,
    // `ignore` below already hand-filters node_modules down to three and zod. Packager's default
    // prune walks the dependency tree with galactus, which cannot resolve a hand-filtered tree and
    // removed node_modules wholesale — the packaged main process then died on `Cannot find module
    // 'zod'` before opening a window. Filtering and pruning are alternatives, not a pair.
    prune: false,
    ignore: [
      /^\/(?!build(?:\/|$)|dist(?:\/|$)|node_modules(?:\/|$)|package\.json$).+/u,
      /^\/node_modules\/(?!(?:three|zod)(?:\/|$)).+/u,
    ],
  },
  makers: [new MakerZIP({}, ['darwin', 'win32'])],
  hooks: {
    packageAfterCopy: async (_forgeConfig, buildPath) => {
      const packagePath = join(buildPath, 'package.json');
      const packageJson = JSON.parse(await readFile(packagePath, 'utf8')) as Record<string, unknown>;
      const dependencies = packageJson.dependencies as Record<string, string> | undefined;
      packageJson.main = 'build/electron/main/index.js';
      packageJson.dependencies = { three: dependencies?.three, zod: dependencies?.zod };
      packageJson.devDependencies = {};
      packageJson.scripts = {};
      delete packageJson.overrides;
      await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
    },
    /**
     * Re-sign the macOS bundle ad-hoc.
     *
     * Packager leaves the binary linker-signed with `Identifier=Electron` and the Info.plist
     * unbound, while the plist declares `com.tanglefast.si-world`. macOS derives the Mach
     * rendezvous service name from the bundle id, so the mismatch made `bootstrap_look_up
     * com.tanglefast.si-world.MachPortRendezvousServer.1` fail with `Permission denied (1100)`.
     * The GPU and network processes then died before any window opened, and every packaged smoke
     * hung with no output. Signing here binds the plist and gives each helper an identity derived
     * from its own bundle id.
     */
    postPackage: async (_forgeConfig, packageResult) => {
      if (packageResult.platform !== 'darwin') return;
      for (const outputPath of packageResult.outputPaths) {
        await execFileAsync('codesign', [
          '--force',
          '--deep',
          '--sign',
          '-',
          join(outputPath, `${packagedApplicationName}.app`),
        ]);
      }
    },
  },
};

export default config;
