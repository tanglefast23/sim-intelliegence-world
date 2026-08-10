import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { buildContentCatalog, type ContentBundleInput } from '../../src/content/registries/catalog';
import { FileCharacterWritingStore } from '../../src/ai/registry/file-writing-store';
import { REGISTRY_NAMES, type RegistryName } from '../../src/content/schemas/registry';
import { SocialContentSchema } from '../../src/content/schemas/social';
import { EconomyPolicySchema } from '../../src/domain/economy/economy';
import { PROTOTYPE_ECONOMY_POLICY } from '../../src/domain/economy/economy';
import { createInitialState } from '../../src/domain/state/initial-state';
import { ScheduleStateSchema } from '../../src/domain/state/models';
import { SOCIAL_PURCHASES } from '../../src/domain/quests/purchases';
import { LINDA_QUEST, LindaQuestDefinitionSchema } from '../../src/domain/quests/quest-machine';
import { ATLAS_INDEX } from '../../src/render/atlas';
import { buildWorldMapCatalog, MAP_IDS, type MapId } from '../../src/world/maps/catalog';
import { z } from 'zod';

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function buildLocationNeighborhoodIndex(
  locations: readonly Readonly<{ id: string; neighborhoodId: string }>[],
): ReadonlyMap<string, string> {
  const result = new Map<string, string>();
  const mapIds = new Set<string>(MAP_IDS);
  for (const location of [...locations].sort((left, right) => compareAscii(left.id, right.id))) {
    if (result.has(location.id)) throw new Error(`Duplicate world location ID: ${location.id}`);
    if (!mapIds.has(location.neighborhoodId)) {
      throw new Error(`Location ${location.id} references unknown neighborhood ${location.neighborhoodId}.`);
    }
    result.set(location.id, location.neighborhoodId);
  }
  for (const mapId of MAP_IDS) {
    if (result.get(mapId) !== mapId) throw new Error(`Neighborhood ${mapId} must be a self-bound world location.`);
  }
  return result;
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
  buildLocationNeighborhoodIndex(catalog.locations);
  const writingStore = new FileCharacterWritingStore(resolve(rootPath, 'content'));
  await Promise.all(catalog.rules.map(({ npcId }) => writingStore.get(npcId)));
  const mapFiles: Readonly<Record<MapId, string>> = {
    northwest_residential: 'northwest.json',
    northeast_downtown: 'northeast.json',
    southwest_commercial: 'southwest.json',
    southeast_docks: 'southeast.json',
  };
  const mapEntries = await Promise.all(MAP_IDS.map(async (mapId) => [
    mapId,
    await readJson(resolve(rootPath, 'content', 'maps', mapFiles[mapId])),
  ] as const));
  const maps = buildWorldMapCatalog(Object.fromEntries(mapEntries) as Record<MapId, unknown>, new Set(ATLAS_INDEX.tiles));
  const economy = EconomyPolicySchema.parse(await readJson(resolve(rootPath, 'content', 'economy', 'prototype.json')));
  const schedules = z.array(ScheduleStateSchema).parse(
    await readJson(resolve(rootPath, 'content', 'schedules', 'prototype.json')),
  );
  const social = SocialContentSchema.parse(await readJson(resolve(rootPath, 'content', 'social', 'prototype.json')));
  const lindaQuest = LindaQuestDefinitionSchema.parse(
    await readJson(resolve(rootPath, 'content', 'quests', 'linda-boyfriend.json')),
  );
  const factionIds = new Set(catalog.factions.map(({ id }) => id));
  const questIds = new Set(catalog.registries.quests.items.map(({ id }) => id));
  const characterIds = new Set(catalog.characters.map(({ id }) => id));
  for (const gate of social.factionAccessGates) {
    if (!factionIds.has(gate.factionId)) throw new Error(`Unknown social faction gate faction: ${gate.factionId}`);
  }
  for (const purchase of social.purchases) {
    if (!questIds.has(purchase.questId)) throw new Error(`Unknown social purchase quest: ${purchase.questId}`);
  }
  if (JSON.stringify(social.purchases) !== JSON.stringify(Object.values(SOCIAL_PURCHASES))) {
    throw new Error('Social purchase content does not match the authoritative deterministic offers.');
  }
  if (!questIds.has(lindaQuest.id)) throw new Error(`Unknown Linda quest ID: ${lindaQuest.id}`);
  if (!characterIds.has(lindaQuest.requestNpcId) || !characterIds.has(lindaQuest.targetNpcId)) {
    throw new Error('Linda quest character references must exist in the world catalog.');
  }
  if (!factionIds.has('velvet_tide')) throw new Error('Linda quest requires the Velvet Tide faction.');
  if (JSON.stringify(lindaQuest) !== JSON.stringify(LINDA_QUEST)) {
    throw new Error('Linda quest content does not match the authoritative deterministic definition.');
  }
  if (JSON.stringify(economy) !== JSON.stringify(PROTOTYPE_ECONOMY_POLICY)) {
    throw new Error('The prototype economy fixture does not match the authoritative economy policy.');
  }
  const initialSchedules = Object.values(createInitialState().schedules);
  if (JSON.stringify(schedules) !== JSON.stringify(initialSchedules)) {
    throw new Error('The prototype schedule fixture does not match the authoritative initial schedules.');
  }
  process.stdout.write(
    `Validated ${catalog.characters.length} characters, ${catalog.locations.length} locations, ${catalog.factions.length} factions, ${catalog.rules.length} rule files, ${Object.keys(maps).length} maps, ${schedules.length} schedules, ${social.factionAccessGates.length} faction gates, ${social.purchases.length} social purchase, and 1 Linda quest.\n`,
  );
}

if (require.main === module) {
  validateContent().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Content validation failed: ${message}\n`);
    process.exitCode = 1;
  });
}
