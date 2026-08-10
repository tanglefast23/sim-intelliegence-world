import type { NpcRules } from '../../content/schemas/registry';
import type { WorldState } from '../../domain/state/schema';
import type { CharacterKnowledgeProfile } from '../knowledge/character-knowledge';
import type { WorldKnowledgeDocument } from '../knowledge/world-knowledge';

export type CharacterWriting = Readonly<{
  npcId: string;
  displayName: string;
  personality: string;
  biography: string;
  knowledgeProfile: CharacterKnowledgeProfile;
  rules: NpcRules;
  worldKnowledge?: WorldKnowledgeDocument;
  authoredGreeting: string;
  authoredFallbacks: readonly string[];
}>;

export type SceneSources = Readonly<{
  sceneObservationIds: readonly string[];
  npcReportIds: readonly string[];
  authoredEventIds: readonly string[];
}>;

export type SceneRegistry = Readonly<{
  npcId: string;
  factIds: readonly string[];
  interestIds: readonly string[];
  actionIds: readonly string[];
  memorySubjectIds: readonly string[];
  unlockIds: readonly string[];
  questIds: readonly string[];
  locationIds: readonly string[];
  factionIds: readonly string[];
  blockedActionIds: readonly string[];
  sources: SceneSources;
}>;

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, 'en'));
}

export function buildSceneRegistry(
  state: WorldState,
  character: CharacterWriting,
  sources: SceneSources,
): SceneRegistry {
  const npc = state.npcs[character.npcId];
  if (!npc) throw new Error(`Unknown scene NPC: ${character.npcId}`);
  if (npc.tier !== 'full_ai') throw new Error('Ambient NPCs do not receive a model scene registry.');
  return Object.freeze({
    npcId: npc.id,
    factIds: uniqueSorted(character.rules.factIds),
    interestIds: uniqueSorted(character.rules.interestIds),
    actionIds: uniqueSorted(character.rules.actionIds),
    memorySubjectIds: uniqueSorted(character.rules.memorySubjectIds),
    unlockIds: uniqueSorted(character.rules.unlockIds),
    questIds: uniqueSorted(character.rules.questIds),
    locationIds: uniqueSorted(character.rules.locationIds),
    factionIds: uniqueSorted(character.rules.factionIds),
    blockedActionIds: uniqueSorted(character.rules.hardBoundaries.flatMap(({ blockedActionIds }) => blockedActionIds)),
    sources: {
      sceneObservationIds: uniqueSorted(sources.sceneObservationIds),
      npcReportIds: uniqueSorted(sources.npcReportIds),
      authoredEventIds: uniqueSorted(sources.authoredEventIds),
    },
  });
}

export const AMBIENT_DIALOGUE = Object.freeze({
  generic_resident: [
    'Nice weather for pretending nothing strange happens here.',
    'The beach is quiet. Downtown is louder after dark.',
    'I only know the public version of island business.',
  ],
});

export function ambientDialogue(npcId: string, absoluteMinute: number): string {
  const lines = AMBIENT_DIALOGUE[npcId as keyof typeof AMBIENT_DIALOGUE];
  if (!lines) throw new Error(`No authored ambient dialogue for ${npcId}.`);
  const line = lines[Math.floor(absoluteMinute / 60) % lines.length];
  if (!line) throw new Error(`Authored ambient dialogue is empty for ${npcId}.`);
  return line;
}
