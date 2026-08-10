import type { NpcRules, RegistryFile, RegistryName } from '../schemas/registry';
import { NpcRulesSchema, REGISTRY_NAMES, RegistryFileSchema } from '../schemas/registry';
import {
  WorldCharacterSchema,
  WorldFactionSchema,
  WorldLocationSchema,
  type WorldCharacter,
  type WorldFaction,
  type WorldLocation,
} from '../schemas/world';
import { ENGINE_STAGE_FLOORS } from '../../domain/relationships/relationship';

export type ContentBundleInput = Readonly<{
  registries: Readonly<Record<RegistryName, unknown>>;
  rules: readonly unknown[];
  world: Readonly<{
    locations: readonly unknown[];
    factions: readonly unknown[];
    characters: readonly unknown[];
  }>;
  narrative: Readonly<{
    setting: string;
    history: string;
    socialRules: string;
  }>;
}>;

export type ContentCatalog = Readonly<{
  registries: Readonly<Record<RegistryName, RegistryFile>>;
  rules: readonly NpcRules[];
  locations: readonly WorldLocation[];
  factions: readonly WorldFaction[];
  characters: readonly WorldCharacter[];
}>;

function assertUniqueIds(label: string, ids: readonly string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) throw new Error(`Duplicate ${label} ID: ${id}`);
    seen.add(id);
  }
}

function assertReferences(label: string, ids: readonly string[], allowed: ReadonlySet<string>): void {
  for (const id of ids) {
    if (!allowed.has(id)) throw new Error(`Unknown ${label} reference: ${id}`);
  }
}

function parseRegistries(input: ContentBundleInput['registries']): Record<RegistryName, RegistryFile> {
  const parsed = {} as Record<RegistryName, RegistryFile>;
  for (const name of REGISTRY_NAMES) {
    const registry = RegistryFileSchema.parse(input[name]);
    assertUniqueIds(`${name} registry`, registry.items.map(({ id }) => id));
    parsed[name] = registry;
  }
  return parsed;
}

export function buildContentCatalog(input: ContentBundleInput): ContentCatalog {
  for (const [name, markdown] of Object.entries(input.narrative)) {
    if (markdown.trim().length === 0) throw new Error(`Narrative file is empty: ${name}`);
  }

  const registries = parseRegistries(input.registries);
  const rules = input.rules.map((candidate) => NpcRulesSchema.parse(candidate));
  const locations = input.world.locations.map((candidate) => WorldLocationSchema.parse(candidate));
  const factions = input.world.factions.map((candidate) => WorldFactionSchema.parse(candidate));
  const characters = input.world.characters.map((candidate) => WorldCharacterSchema.parse(candidate));

  assertUniqueIds('NPC rules', rules.map(({ npcId }) => npcId));
  assertUniqueIds('world location', locations.map(({ id }) => id));
  assertUniqueIds('world faction', factions.map(({ id }) => id));
  assertUniqueIds('world character', characters.map(({ id }) => id));

  const registryIds = Object.fromEntries(
    REGISTRY_NAMES.map((name) => [name, new Set(registries[name].items.map(({ id }) => id))]),
  ) as Record<RegistryName, Set<string>>;
  const locationIds = new Set(locations.map(({ id }) => id));
  const factionIds = new Set(factions.map(({ id }) => id));
  const characterIds = new Set(characters.map(({ id }) => id));
  const requiredRuleNpcIds = characters
    .filter(({ tier }) => tier === 'full_ai')
    .map(({ id }) => id);
  const ruleNpcIds = new Set(rules.map(({ npcId }) => npcId));

  assertReferences('required NPC rules', requiredRuleNpcIds, ruleNpcIds);

  assertReferences('location registry', locations.map(({ id }) => id), registryIds.locations);
  assertReferences('faction registry', factions.map(({ id }) => id), registryIds.factions);

  for (const location of locations) {
    assertUniqueIds(`${location.id} adjacent location`, location.adjacentLocationIds);
    assertReferences(`${location.id} adjacent location`, location.adjacentLocationIds, locationIds);
  }
  for (const character of characters) {
    assertUniqueIds(`${character.id} faction`, character.factionIds);
    assertReferences(`${character.id} home location`, [character.homeLocationId], locationIds);
    assertReferences(`${character.id} faction`, character.factionIds, factionIds);
  }
  for (const rule of rules) {
    assertUniqueIds(`${rule.npcId} fact`, rule.factIds);
    assertUniqueIds(`${rule.npcId} interest`, rule.interestIds);
    assertUniqueIds(`${rule.npcId} action`, rule.actionIds);
    assertUniqueIds(`${rule.npcId} memory subject`, rule.memorySubjectIds);
    assertUniqueIds(`${rule.npcId} unlock`, rule.unlockIds);
    assertUniqueIds(`${rule.npcId} quest`, rule.questIds);
    assertUniqueIds(`${rule.npcId} location`, rule.locationIds);
    assertUniqueIds(`${rule.npcId} faction`, rule.factionIds);
    assertUniqueIds(`${rule.npcId} hard boundary`, rule.hardBoundaries.map(({ id }) => id));
    assertUniqueIds(`${rule.npcId} stage rule`, rule.stageRules.map(({ stage }) => stage));
    assertUniqueIds(`${rule.npcId} rejection reason`, rule.rejections.map(({ reasonId }) => reasonId));
    assertReferences('NPC rules character', [rule.npcId], characterIds);
    assertReferences(`${rule.npcId} fact`, rule.factIds, registryIds.facts);
    assertReferences(`${rule.npcId} interest`, rule.interestIds, registryIds.interests);
    assertReferences(`${rule.npcId} action`, rule.actionIds, registryIds.actions);
    assertReferences(`${rule.npcId} memory subject`, rule.memorySubjectIds, registryIds['memory-subjects']);
    assertReferences(`${rule.npcId} unlock`, rule.unlockIds, registryIds.unlocks);
    assertReferences(`${rule.npcId} quest`, rule.questIds, registryIds.quests);
    assertReferences(`${rule.npcId} location`, rule.locationIds, locationIds);
    assertReferences(`${rule.npcId} faction`, rule.factionIds, factionIds);
    for (const boundary of rule.hardBoundaries) {
      assertUniqueIds(`${rule.npcId} ${boundary.id} blocked action`, boundary.blockedActionIds);
      assertReferences(`${rule.npcId} ${boundary.id} blocked action`, boundary.blockedActionIds, registryIds.actions);
    }
    for (const stageRule of rule.stageRules) {
      assertUniqueIds(`${rule.npcId} ${stageRule.stage} required flag`, stageRule.requiredFlagIds);
      assertReferences(`${rule.npcId} ${stageRule.stage} required flag`, stageRule.requiredFlagIds, registryIds.unlocks);
      if (stageRule.floor) {
        const engineFloor = ENGINE_STAGE_FLOORS[stageRule.stage];
        if (
          stageRule.floor.familiarity < engineFloor.familiarity ||
          stageRule.floor.trust < engineFloor.trust ||
          stageRule.floor.attraction < engineFloor.attraction
        ) {
          throw new Error(`${rule.npcId} ${stageRule.stage} floor weakens the engine floor.`);
        }
      }
    }
    for (const rejection of rule.rejections) {
      assertReferences(`${rule.npcId} rejection source action`, [rejection.sourceActionId], registryIds.actions);
      if (rejection.circumstanceFlagId) {
        assertReferences(`${rule.npcId} rejection circumstance`, [rejection.circumstanceFlagId], registryIds.unlocks);
      }
    }
    if (rule.startingRelationship.stage !== 'stranger') {
      const floor = ENGINE_STAGE_FLOORS[rule.startingRelationship.stage];
      const values = rule.startingRelationship.values;
      if (
        values.familiarity < floor.familiarity ||
        values.trust < floor.trust ||
        values.attraction < floor.attraction
      ) {
        throw new Error(`${rule.npcId} starting relationship is below its engine stage floor.`);
      }
    }
    if (rule.compatibility.romanticEligibleAtStart && !rule.compatibility.romantic) {
      throw new Error(`${rule.npcId} cannot start romantically eligible when romantic compatibility is false.`);
    }
    if (rule.startingRelationship.stage !== 'stranger' && !rule.compatibility.social) {
      throw new Error(`${rule.npcId} cannot start above Stranger when social compatibility is false.`);
    }
    if (
      ['dating', 'partner', 'engaged', 'married'].includes(rule.startingRelationship.stage) &&
      (!rule.compatibility.romantic || !rule.compatibility.romanticEligibleAtStart)
    ) {
      throw new Error(`${rule.npcId} cannot start at a romantic stage without starting eligibility.`);
    }
    if (rule.stageRules.some(({ stage, unavailable }) => unavailable && stage === rule.startingRelationship.stage)) {
      throw new Error(`${rule.npcId} cannot start at a stage marked unavailable.`);
    }
  }

  return { registries, rules, locations, factions, characters };
}
