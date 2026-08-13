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
import {
  NpcDispositionSchema,
  VerbalMissionDefinitionSchema,
  VERBAL_MISSION_OUTCOMES,
  type NpcDisposition,
  type VerbalMissionDefinition,
} from '../schemas/verbal-mission';
import { validateVerbalMove } from '../../ai/schemas/verbal-move';
import {
  createOpeningMission,
  goalReadiness,
  isLegalConcernTransition,
  runOutcomeEngine,
} from '../../domain/verbal-missions/outcome-engine';

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

export type VerbalMissionReferences = Readonly<{
  npcIds: ReadonlySet<string>;
  factIds: ReadonlySet<string>;
  reachableFactIds: ReadonlySet<string>;
  actionIds: ReadonlySet<string>;
  locationIds: ReadonlySet<string>;
  objectIds: ReadonlySet<string>;
  referentIds: ReadonlySet<string>;
}>;

export type VerbalMissionCatalog = Readonly<{
  dispositions: readonly NpcDisposition[];
  missions: readonly VerbalMissionDefinition[];
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

function validateVerbalMission(
  mission: VerbalMissionDefinition,
  disposition: NpcDisposition,
  references: VerbalMissionReferences,
): void {
  const validateTrigger = (label: string, trigger: VerbalMissionDefinition['levers'][number]['trigger']) => {
    if (trigger.referentId) assertReferences(`${label} referent`, [trigger.referentId], references.referentIds);
    if (trigger.claimFactIds) assertReferences(`${label} claim fact`, trigger.claimFactIds, references.factIds);
  };
  if (
    mission.goalContract.missionId !== mission.missionId ||
    mission.goalContract.npcId !== mission.npcId ||
    disposition.dispositionId !== mission.dispositionId ||
    disposition.npcId !== mission.npcId
  ) throw new Error(`${mission.missionId} contract, mission, and disposition IDs must agree.`);

  assertReferences(`${mission.missionId} disposition NPC`, [disposition.npcId], references.npcIds);
  assertUniqueIds(`${mission.missionId} hard boundary`, disposition.hardBoundaries.map(({ boundaryId }) => boundaryId));
  for (const boundary of disposition.hardBoundaries) {
    validateTrigger(`${mission.missionId} boundary ${boundary.boundaryId}`, boundary.trigger);
  }

  const concernIds = mission.concerns.map(({ concernId }) => concernId);
  const leverIds = mission.levers.map(({ leverId }) => leverId);
  const allergyIds = mission.allergies.map(({ allergyId }) => allergyId);
  const recoveryIds = mission.recoveries.map(({ recoveryId }) => recoveryId);
  const reactionIds = mission.reactions.map(({ reactionId }) => reactionId);
  assertUniqueIds(`${mission.missionId} concern`, concernIds);
  assertUniqueIds(`${mission.missionId} lever`, leverIds);
  assertUniqueIds(`${mission.missionId} allergy`, allergyIds);
  assertUniqueIds(`${mission.missionId} recovery`, recoveryIds);
  assertUniqueIds(`${mission.missionId} reaction`, reactionIds);
  assertUniqueIds(`${mission.missionId} route proof`, [
    mission.honestRoute.proofId,
    ...mission.recoveryProofs.map(({ proofId }) => proofId),
  ]);
  assertReferences(`${mission.missionId} NPC`, [mission.npcId], references.npcIds);
  assertReferences(`${mission.missionId} required concern`, mission.goalContract.requiredConcernIds, new Set(concernIds));

  const requiredIds = new Set(mission.goalContract.requiredConcernIds);
  if (mission.concerns.some(({ concernId, required }) => required !== requiredIds.has(concernId))) {
    throw new Error(`${mission.missionId} required concern flags must match its goal contract.`);
  }
  for (const concernId of requiredIds) {
    const distinctLevers = mission.levers.filter((lever) => lever.concernId === concernId && lever.credits);
    if (new Set(distinctLevers.map(({ leverId }) => leverId)).size < 2) {
      throw new Error(`${mission.missionId} required concern ${concernId} needs two credited levers.`);
    }
  }

  const factReferences = new Set<string>();
  for (const lever of mission.levers) {
    assertReferences(`${mission.missionId} lever concern`, [lever.concernId], new Set(concernIds));
    for (const from of lever.fromStates) {
      if (!isLegalConcernTransition(from, lever.toState)) {
        throw new Error(`${mission.missionId} lever ${lever.leverId} has illegal ${from} -> ${lever.toState}.`);
      }
    }
    if (lever.fromStates.includes('hidden') && lever.credits) {
      throw new Error(`${mission.missionId} hidden concern reveal cannot grant lever credit.`);
    }
    if (lever.exactTerm?.kind === 'offer' && mission.goalContract.kind !== 'buy_object') {
      throw new Error(`${mission.missionId} non-commerce mission cannot use offer terms.`);
    }
    if (lever.exactTerm?.kind === 'schedule' && mission.goalContract.kind !== 'schedule_cooperation') {
      throw new Error(`${mission.missionId} non-schedule mission cannot use schedule terms.`);
    }
    assertReferences(`${mission.missionId} lever reaction`, [lever.reactionId], new Set(reactionIds));
    if (mission.reactions.find(({ reactionId }) => reactionId === lever.reactionId)?.outcome !== 'progress') {
      throw new Error(`${mission.missionId} lever ${lever.leverId} needs a progress reaction.`);
    }
    [...lever.requiredPlayerFactIds, ...lever.requiredNpcFactIds, ...lever.newlySpeakableFactIds,
      ...(lever.trigger.claimFactIds ?? [])].forEach((factId) => factReferences.add(factId));
    validateTrigger(`${mission.missionId} lever`, lever.trigger);
  }
  assertReferences(`${mission.missionId} fact`, [...factReferences], references.factIds);
  for (const lever of mission.levers.filter(({ honest }) => honest)) {
    assertReferences(`${mission.missionId} honest route fact`, lever.requiredPlayerFactIds, references.reachableFactIds);
  }

  for (const recovery of mission.recoveries) {
    assertReferences(`${mission.missionId} recovery concern`, [recovery.concernId], new Set(concernIds));
    assertReferences(`${mission.missionId} recovery reaction`, [recovery.reactionId], new Set(reactionIds));
    assertReferences(`${mission.missionId} recovery fact`, recovery.requiredPlayerFactIds, references.factIds);
    validateTrigger(`${mission.missionId} recovery`, recovery.trigger);
    if (mission.reactions.find(({ reactionId }) => reactionId === recovery.reactionId)?.outcome !== 'progress') {
      throw new Error(`${mission.missionId} recovery ${recovery.recoveryId} needs a progress reaction.`);
    }
  }
  for (const allergy of mission.allergies) {
    if (allergy.concernId) assertReferences(`${mission.missionId} allergy concern`, [allergy.concernId], new Set(concernIds));
    assertReferences(`${mission.missionId} allergy recovery`, allergy.recoveryIds, new Set(recoveryIds));
    assertReferences(`${mission.missionId} allergy reaction`, [allergy.reactionId], new Set(reactionIds));
    validateTrigger(`${mission.missionId} allergy`, allergy.trigger);
    const expectedOutcome = allergy.severity === 'severe' ? 'walkout' : 'backfire';
    if (mission.reactions.find(({ reactionId }) => reactionId === allergy.reactionId)?.outcome !== expectedOutcome) {
      throw new Error(`${mission.missionId} allergy ${allergy.allergyId} needs a ${expectedOutcome} reaction.`);
    }
    if (
      allergy.severity === 'mild' && allergy.trigger.registerIds && !allergy.trigger.actIds &&
      allergy.recoveryIds.some((recoveryId) => !mission.recoveries.find((candidate) => candidate.recoveryId === recoveryId)?.sameConversation)
    ) throw new Error(`${mission.missionId} register-only allergy needs same-conversation recovery.`);
  }

  for (const outcome of VERBAL_MISSION_OUTCOMES) {
    const reactionId = mission.defaultReactionIds[outcome];
    const reaction = mission.reactions.find((candidate) => candidate.reactionId === reactionId);
    if (!reaction || reaction.outcome !== outcome) {
      throw new Error(`${mission.missionId} lacks a valid default ${outcome} reaction.`);
    }
  }

  const contract = mission.goalContract;
  if (contract.kind === 'disclose_fact') {
    assertReferences(`${mission.missionId} disclosed fact`, [contract.factId], references.factIds);
    if (contract.recipientId !== 'protagonist') assertReferences(`${mission.missionId} fact recipient`, [contract.recipientId], references.npcIds);
  } else if (contract.kind === 'buy_object') {
    assertReferences(`${mission.missionId} object`, [contract.objectId], references.objectIds);
  } else {
    assertReferences(`${mission.missionId} action`, [contract.actionId, contract.closerActionId], references.actionIds);
    assertReferences(`${mission.missionId} subject`, [contract.subjectNpcId], references.npcIds);
    assertReferences(`${mission.missionId} location`, [contract.locationId], references.locationIds);
  }
  assertReferences(`${mission.missionId} closer`, [contract.closerActionId], references.actionIds);

  const opening = createOpeningMission(mission, disposition);
  if (goalReadiness(opening, contract, mission.honestRoute.context).canConfirm) {
    throw new Error(`${mission.missionId} can confirm in its opening state.`);
  }
  const targetReferentId = contract.kind === 'buy_object'
    ? contract.objectId
    : contract.kind === 'schedule_cooperation' ? contract.subjectNpcId : contract.factId;
  const nakedMove = {
    acts: [{ act: 'ask' as const, referentId: targetReferentId, evidenceText: 'please' }],
    register: 'plain' as const,
    claims: [],
    referenceConfidence: 'clear' as const,
  };
  const naked = runOutcomeEngine({
    mission: opening,
    definition: mission,
    disposition,
    move: nakedMove,
    context: { ...mission.honestRoute.context, exactOfferAmount: null, exactProposedMinute: null },
  });
  if (naked.canConfirm) throw new Error(`${mission.missionId} naked request can confirm.`);

  let routeMission = opening;
  let routeContext = mission.honestRoute.context;
  for (const step of mission.honestRoute.steps) {
    validateVerbalMove(step.move, step.playerMessage, {
      referentIds: [...references.referentIds],
      factIds: [...references.factIds],
    });
    assertReferences(`${mission.missionId} route granted fact`, step.grantPlayerFactIds, references.reachableFactIds);
    routeContext = {
      ...routeContext,
      playerFactIds: [...new Set([...routeContext.playerFactIds, ...step.grantPlayerFactIds])],
    };
    const result = runOutcomeEngine({
      mission: routeMission,
      definition: mission,
      disposition,
      move: step.move,
      context: {
        ...routeContext,
        exactOfferAmount: step.exactOfferAmount,
        exactProposedMinute: step.exactProposedMinute,
      },
    });
    const creditedLeverIds = new Set(result.creditedMoves.map(({ leverId }) => leverId));
    if (mission.levers.some(({ leverId, honest }) => creditedLeverIds.has(leverId) && !honest)) {
      throw new Error(`${mission.missionId} honest route uses a dishonest lever.`);
    }
    routeMission = result.mission;
  }
  const finalReadiness = goalReadiness(routeMission, contract, routeContext);
  if (!finalReadiness.canConfirm || !finalReadiness.wouldSucceed) {
    throw new Error(`${mission.missionId} honest route does not reach successful confirmation.`);
  }

  for (const allergy of mission.allergies.filter(({ severity }) => severity === 'mild')) {
    for (const recoveryId of allergy.recoveryIds) {
      const proof = mission.recoveryProofs.find((candidate) => (
        candidate.allergyId === allergy.allergyId && candidate.recoveryId === recoveryId
      ));
      if (!proof) throw new Error(`${mission.missionId} lacks recovery proof for ${allergy.allergyId}/${recoveryId}.`);
      for (const step of [proof.allergyStep, proof.recoveryStep]) {
        validateVerbalMove(step.move, step.playerMessage, {
          referentIds: [...references.referentIds],
          factIds: [...references.factIds],
        });
        assertReferences(`${mission.missionId} recovery route granted fact`, step.grantPlayerFactIds, references.reachableFactIds);
      }
      const allergyResult = runOutcomeEngine({
        mission: opening,
        definition: mission,
        disposition,
        move: proof.allergyStep.move,
        context: {
          ...proof.context,
          playerFactIds: [...new Set([...proof.context.playerFactIds, ...proof.allergyStep.grantPlayerFactIds])],
          exactOfferAmount: proof.allergyStep.exactOfferAmount,
          exactProposedMinute: proof.allergyStep.exactProposedMinute,
        },
      });
      if (!allergyResult.mission.firedAllergyIds.includes(allergy.allergyId)) {
        throw new Error(`${mission.missionId} recovery proof did not fire ${allergy.allergyId}.`);
      }
      const recoveryResult = runOutcomeEngine({
        mission: allergyResult.mission,
        definition: mission,
        disposition,
        move: proof.recoveryStep.move,
        context: {
          ...proof.context,
          playerFactIds: [...new Set([...proof.context.playerFactIds, ...proof.recoveryStep.grantPlayerFactIds])],
          exactOfferAmount: proof.recoveryStep.exactOfferAmount,
          exactProposedMinute: proof.recoveryStep.exactProposedMinute,
        },
      });
      const recovered = recoveryResult.concernTransitions.some(({ reasonId }) => reasonId === recoveryId);
      if (!recovered) throw new Error(`${mission.missionId} recovery proof did not recover with ${recoveryId}.`);
    }
  }
}

export function buildVerbalMissionCatalog(
  dispositionCandidates: readonly unknown[],
  missionCandidates: readonly unknown[],
  references: VerbalMissionReferences,
): VerbalMissionCatalog {
  const dispositions = dispositionCandidates.map((candidate) => NpcDispositionSchema.parse(candidate));
  const missions = missionCandidates.map((candidate) => VerbalMissionDefinitionSchema.parse(candidate));
  assertUniqueIds('Verbal Mission disposition', dispositions.map(({ dispositionId }) => dispositionId));
  assertUniqueIds('Verbal Mission disposition NPC', dispositions.map(({ npcId }) => npcId));
  assertUniqueIds('Verbal Mission', missions.map(({ missionId }) => missionId));
  for (const mission of missions) {
    const disposition = dispositions.find(({ dispositionId }) => dispositionId === mission.dispositionId);
    if (!disposition) throw new Error(`${mission.missionId} references unknown disposition ${mission.dispositionId}.`);
    validateVerbalMission(mission, disposition, references);
  }
  return { dispositions, missions };
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
