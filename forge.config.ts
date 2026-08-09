import { readFile, writeFile } from 'node:fs/promises';
import { basename, isAbsolute, join } from 'node:path';

import { MakerZIP } from '@electron-forge/maker-zip';
import type { ForgeConfig } from '@electron-forge/shared-types';

const packagedApplicationName = process.platform === 'linux' ? 'si-world' : 'SI World';
const modelResourceRoot = process.env.SI_WORLD_MODEL_RESOURCE_DIR;
if (
  modelResourceRoot &&
  (!isAbsolute(modelResourceRoot) || basename(modelResourceRoot) !== 'model-runtime')
) {
  throw new Error('SI_WORLD_MODEL_RESOURCE_DIR must be an absolute model-runtime directory.');
}

const config: ForgeConfig = {
  packagerConfig: {
    appBundleId: 'com.tanglefast.si-world',
    asar: true,
    executableName: 'si-world',
    extraResource: modelResourceRoot ? [modelResourceRoot] : [],
    name: packagedApplicationName,
    overwrite: true,
    ignore: [
      /^\/(?!build(?:\/|$)|dist(?:\/|$)|node_modules(?:\/|$)|package\.json$).+/u,
      /^\/node_modules\/(?!zod(?:\/|$)).+/u,
    ],
  },
  makers: [new MakerZIP({}, ['darwin', 'win32'])],
  hooks: {
    packageAfterCopy: async (_forgeConfig, buildPath) => {
      const packagePath = join(buildPath, 'package.json');
      const packageJson = JSON.parse(await readFile(packagePath, 'utf8')) as Record<string, unknown>;
      const dependencies = packageJson.dependencies as Record<string, string> | undefined;
      packageJson.main = 'build/electron/main/index.js';
      packageJson.dependencies = { zod: dependencies?.zod };
      packageJson.devDependencies = {};
      packageJson.scripts = {};
      delete packageJson.overrides;
      await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
    },
  },
};

export default config;
