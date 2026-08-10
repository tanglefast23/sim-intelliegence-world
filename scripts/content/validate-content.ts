import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { buildContentCatalog, type ContentBundleInput } from '../../src/content/registries/catalog';
import { REGISTRY_NAMES, type RegistryName } from '../../src/content/schemas/registry';
import { ATLAS_INDEX } from '../../src/render/atlas';
import { compileWorldMap } from '../../src/world/maps/schema';

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

async function readJsonDirectory(path: string): Promise<unknown[]> {
  const names = (await readdir(path)).filter((name) => name.endsWith('.json')).sort(compareAscii);
  if (names.length === 0) throw new Error(`No JSON fixtures found in ${path}`);
  const files = await Promise.all(names.map((name) => readJson(resolve(path, name))));
  return files.flatMap((candidate) => Array.isArray(candidate) ? candidate : [candidate]);
}

async function readCharacterRulesDirectory(path: string): Promise<unknown[]> {
  const entries = (await readdir(path, { withFileTypes: true }))
    .sort((left, right) => compareAscii(left.name, right.name));
  const invalidEntries = entries.filter((entry) => !entry.isDirectory());
  if (invalidEntries.length > 0) {
    throw new Error(`Character content must use */rules.json directories: ${invalidEntries.map(({ name }) => name).join(', ')}`);
  }
  if (entries.length === 0) throw new Error(`No character directories found in ${path}`);
  return Promise.all(entries.map((entry) => readJson(resolve(path, entry.name, 'rules.json'))));
}

export async function loadContentBundle(rootPath: string): Promise<ContentBundleInput> {
  const contentPath = resolve(rootPath, 'content');
  const registryEntries = await Promise.all(
    REGISTRY_NAMES.map(async (name) => [name, await readJson(resolve(contentPath, 'registries', `${name}.json`))] as const),
  );
  const registries = Object.fromEntries(registryEntries) as Record<RegistryName, unknown>;
  return {
    registries,
    rules: await readCharacterRulesDirectory(resolve(contentPath, 'characters')),
    world: {
      locations: await readJsonDirectory(resolve(contentPath, 'world', 'locations')),
      factions: await readJsonDirectory(resolve(contentPath, 'world', 'factions')),
      characters: await readJsonDirectory(resolve(contentPath, 'world', 'characters')),
    },
    narrative: {
      setting: await readFile(resolve(contentPath, 'world', 'setting.md'), 'utf8'),
      history: await readFile(resolve(contentPath, 'world', 'history.md'), 'utf8'),
      socialRules: await readFile(resolve(contentPath, 'world', 'social-rules.md'), 'utf8'),
    },
  };
}

export async function validateContent(rootPath = process.cwd()): Promise<void> {
  const bundle = await loadContentBundle(rootPath);
  const catalog = buildContentCatalog(bundle);
  const northwestMap = compileWorldMap(
    await readJson(resolve(rootPath, 'content', 'maps', 'northwest.json')),
    new Set(ATLAS_INDEX.tiles),
  );
  process.stdout.write(
    `Validated ${catalog.characters.length} characters, ${catalog.locations.length} locations, ${catalog.factions.length} factions, ${catalog.rules.length} rule files, and ${northwestMap.source.width}x${northwestMap.source.height} ${northwestMap.source.id}.\n`,
  );
}

if (require.main === module) {
  validateContent().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Content validation failed: ${message}\n`);
    process.exitCode = 1;
  });
}
