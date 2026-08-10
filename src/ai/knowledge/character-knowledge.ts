export type KnowledgeLevel = 'knows_well' | 'knows_roughly' | 'heard_of' | 'does_not_know';

export type CharacterKnowledgeProfile = Readonly<{
  source: string;
  worldSectionLevels: Readonly<Record<string, KnowledgeLevel>>;
}>;

const MAX_CHARACTER_KNOWLEDGE_BYTES = 16_000;
const REQUIRED_HEADINGS = [
  'Reasoning style',
  'Education and experience',
  'Real-world baseline',
  'Halcyra section knowledge',
  'Knows well',
  'Knows roughly',
  'Does not know',
  'Uncertainty behavior',
] as const;

function sectionBlocks(source: string): ReadonlyMap<string, string> {
  const lines = source.replaceAll('\r\n', '\n').split('\n');
  const blocks = new Map<string, string>();
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (!line.startsWith('## ')) continue;
    const heading = line.slice(3).trim();
    const end = lines.findIndex((candidate, candidateIndex) => candidateIndex > index && candidate.startsWith('## '));
    if (blocks.has(heading)) throw new Error(`Character knowledge heading ${heading} is duplicated.`);
    const body = lines.slice(index + 1, end === -1 ? lines.length : end).join('\n').trim();
    if (body.length === 0) throw new Error(`Character knowledge heading ${heading} is empty.`);
    blocks.set(heading, body);
    if (end !== -1) index = end - 1;
  }
  return blocks;
}

export function parseCharacterKnowledgeMarkdown(source: string): CharacterKnowledgeProfile {
  if (new TextEncoder().encode(source).byteLength > MAX_CHARACTER_KNOWLEDGE_BYTES) {
    throw new Error('Character knowledge document exceeds its byte limit.');
  }
  const titleLine = source.replaceAll('\r\n', '\n').split('\n').find((line) => line.trim().length > 0);
  if (titleLine?.trim() !== '# Knowledge Profile') {
    throw new Error('Character knowledge document requires the title Knowledge Profile.');
  }
  const blocks = sectionBlocks(source);
  for (const heading of REQUIRED_HEADINGS) {
    if (!blocks.has(heading)) throw new Error(`Character knowledge document requires ${heading}.`);
  }
  const allowedHeadings = new Set<string>(REQUIRED_HEADINGS);
  for (const heading of blocks.keys()) {
    if (!allowedHeadings.has(heading)) throw new Error(`Unknown character knowledge heading: ${heading}.`);
  }

  const worldSectionLevels: Record<string, KnowledgeLevel> = {};
  for (const line of blocks.get('Halcyra section knowledge')!.split('\n')) {
    const match = /^- ([a-z0-9]+(?:-[a-z0-9]+)*): (knows_well|knows_roughly|heard_of|does_not_know)$/u.exec(line.trim());
    if (!match) throw new Error('Halcyra section knowledge entries must use "- section-id: level".');
    const sectionId = match[1]!;
    if (worldSectionLevels[sectionId]) throw new Error(`Halcyra section knowledge duplicates ${sectionId}.`);
    worldSectionLevels[sectionId] = match[2] as KnowledgeLevel;
  }
  if (!worldSectionLevels.overview) throw new Error('Character knowledge must define Halcyra overview familiarity.');

  return Object.freeze({
    source: source.trim(),
    worldSectionLevels: Object.freeze(worldSectionLevels),
  });
}

export function validateCharacterWorldKnowledge(
  profile: CharacterKnowledgeProfile,
  worldSectionIds: ReadonlySet<string>,
): void {
  for (const sectionId of Object.keys(profile.worldSectionLevels)) {
    if (!worldSectionIds.has(sectionId)) throw new Error(`Character knowledge references unknown world section ${sectionId}.`);
  }
}
