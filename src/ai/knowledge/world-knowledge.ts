import type { CharacterKnowledgeProfile, KnowledgeLevel } from './character-knowledge';

export type WorldKnowledgeSection = Readonly<{
  id: string;
  title: string;
  keywords: readonly string[];
  body: string;
}>;

export type WorldKnowledgeDocument = Readonly<{
  title: string;
  sections: readonly WorldKnowledgeSection[];
}>;

const MAX_WORLD_KNOWLEDGE_BYTES = 32_000;
const MAX_SELECTED_SECTIONS = 4;

export type QuestionScope = 'local_halcyra' | 'real_world' | 'personal_npc' | 'concealed_or_unknown';

const LOCAL_REFERENCE = /\b(?:halcyra|on\s+the\s+island|this\s+island|the\s+island|around\s+here|nearby|in\s+town|this\s+city|the\s+city|local(?:ly)?)\b/iu;
const CONTEXTUAL_REFERENCE = /\b(?:there|that|those|them|they|it|the\s+place|what\s+about|how\s+about)\b/iu;
const LOCAL_ACTIVITY = /\b(?:fun|party|nightlife|club|bar|drink|dance|music|eat|food|restaurant|hungry|lunch|dinner|meal|shop|shopping|buy|clothes|clothing|outfit|shoes|relax|relaxation|spa|massage|beach|ferry|police|permit)\b/iu;
const LOCAL_REQUEST = /\b(?:where|which\s+way|how\s+do\s+i\s+get|recommend|suggest|looking\s+for|find|somewhere|something\s+to\s+do)\b/iu;
const GENERIC_LOCAL_DESTINATION = /\bwhere\s+(?:should|can|could)\s+(?:i|we)\s+go\b/iu;
const PERSONAL_QUESTION = /\b(?:about\s+you|yourself|your\s+(?:life|past|family|job|work|education|school|home|opinion)|where\s+did\s+you|when\s+did\s+you|have\s+you\s+ever|what\s+do\s+you\s+(?:like|want|remember))\b/iu;
const CONCEALED_QUESTION = /\b(?:velvet\s+tide|secret\s+faction|concealed\s+(?:group|crime|operation)|island(?:'s)?\s+underworld|local\s+drug\s+trade|who\s+runs\s+the\s+underworld)\b/iu;
const PLACE_QUALIFIER = /\b(?:in|near|from)\s+(?:(?:the|a|an)\s+)?([\p{L}][\p{L}'-]{2,})\b/giu;
const NON_EXTERNAL_QUALIFIERS = new Set([
  'administration', 'afternoon', 'bar', 'beach', 'bed', 'city', 'club', 'commercial', 'council',
  'daytime', 'district', 'docks', 'downtown', 'entertainment', 'evening', 'ferry', 'front',
  'government', 'halcyra', 'here', 'home', 'island', 'mall', 'market', 'massage', 'morning',
  'neighborhood', 'night', 'nightlife', 'northeast', 'northwest', 'offices', 'peace', 'police',
  'private', 'public', 'relaxation', 'residential', 'restaurant', 'school', 'shop', 'southeast',
  'southwest', 'spa', 'station', 'store', 'today', 'tomorrow', 'town', 'villa', 'work',
]);

const MAP_SECTION_IDS: Readonly<Record<string, string>> = Object.freeze({
  northwest_residential: 'residential-and-relaxation',
  northeast_downtown: 'downtown-and-nightlife',
  southwest_commercial: 'shopping-clothes-and-food',
  southeast_docks: 'docks-and-civic-offices',
});

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replaceAll(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function hasExternalPlaceQualifier(message: string): boolean {
  return [...message.matchAll(PLACE_QUALIFIER)].some((match) => {
    const qualifier = normalize(match[1] ?? '');
    return qualifier.length > 0 && !NON_EXTERNAL_QUALIFIERS.has(qualifier);
  });
}

function sectionId(title: string): string {
  const id = normalize(title).replaceAll(' ', '-');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(id)) throw new Error('World knowledge section title cannot produce a stable ID.');
  return id;
}

export function parseWorldKnowledgeMarkdown(source: string): WorldKnowledgeDocument {
  if (new TextEncoder().encode(source).byteLength > MAX_WORLD_KNOWLEDGE_BYTES) {
    throw new Error('World knowledge document exceeds its byte limit.');
  }
  const lines = source.replaceAll('\r\n', '\n').split('\n');
  const titleLine = lines.find((line) => line.trim().length > 0);
  if (!titleLine?.startsWith('# ') || titleLine.startsWith('## ')) {
    throw new Error('World knowledge document requires one level-one title.');
  }
  const title = titleLine.slice(2).trim();
  if (title !== 'Halcyra Island') throw new Error('World knowledge title must be Halcyra Island.');

  const sections: WorldKnowledgeSection[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (!line.startsWith('## ')) continue;
    const heading = line.slice(3).trim();
    const end = lines.findIndex((candidate, candidateIndex) => candidateIndex > index && candidate.startsWith('## '));
    const sectionLines = lines.slice(index + 1, end === -1 ? lines.length : end);
    const keywordIndex = sectionLines.findIndex((candidate) => candidate.trim().length > 0);
    const keywordLine = keywordIndex === -1 ? '' : sectionLines[keywordIndex]?.trim() ?? '';
    if (!keywordLine.startsWith('Keywords: ')) throw new Error(`World knowledge section ${heading} requires a Keywords line.`);
    const keywords = keywordLine.slice('Keywords: '.length).split(',').map(normalize).filter(Boolean);
    if (keywords.length === 0 || new Set(keywords).size !== keywords.length) {
      throw new Error(`World knowledge section ${heading} has invalid keywords.`);
    }
    const body = sectionLines.slice(keywordIndex + 1).join('\n').trim();
    if (body.length === 0) throw new Error(`World knowledge section ${heading} is empty.`);
    sections.push(Object.freeze({ id: sectionId(heading), title: heading, keywords: Object.freeze(keywords), body }));
    if (end !== -1) index = end - 1;
  }
  if (sections.length < 2 || sections[0]?.id !== 'world-frame' || sections[1]?.id !== 'overview') {
    throw new Error('World knowledge document requires World frame and Overview as its first sections.');
  }
  const ids = sections.map(({ id }) => id);
  if (new Set(ids).size !== ids.length) throw new Error('World knowledge section IDs must be unique.');
  return Object.freeze({ title, sections: Object.freeze(sections) });
}

export function classifyQuestionScope(
  currentMessage: string,
  recentTurns: readonly Readonly<{ speaker: 'player' | 'npc'; text: string }>[],
): QuestionScope {
  const recentPlayerContext = recentTurns.filter(({ speaker }) => speaker === 'player').slice(-2).map(({ text }) => text).join(' ');
  if (CONCEALED_QUESTION.test(currentMessage)) return 'concealed_or_unknown';
  if (hasExternalPlaceQualifier(currentMessage)) return 'real_world';
  if (LOCAL_REFERENCE.test(currentMessage)) return 'local_halcyra';
  if (CONTEXTUAL_REFERENCE.test(currentMessage) && LOCAL_REFERENCE.test(recentPlayerContext)) return 'local_halcyra';
  if (LOCAL_REQUEST.test(currentMessage) && LOCAL_ACTIVITY.test(currentMessage)) return 'local_halcyra';
  if (GENERIC_LOCAL_DESTINATION.test(currentMessage)) return 'local_halcyra';
  if (PERSONAL_QUESTION.test(currentMessage)) return 'personal_npc';
  return 'real_world';
}

const HALCYRA_RELATIVE_GEOGRAPHY = /\b(?:(?:north|south|east|west)(?:ern)?\s+of|near|close\s+to|far\s+from)\s+(?:here|halcyra|the\s+island)\b|\b(?:here|halcyra|the\s+island)\s+is\s+(?:(?:north|south|east|west)(?:ern)?\s+of|near|close\s+to|far\s+from)\b|\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:minutes?|hours?|days?|miles?|kilomet(?:er|re)s?)\s+(?:from|away\s+from)\s+(?:here|halcyra|the\s+island)\b/iu;

export function inventsHalcyraRelativeGeography(dialogue: string): boolean {
  return HALCYRA_RELATIVE_GEOGRAPHY.test(dialogue);
}

function sectionLevel(profile: CharacterKnowledgeProfile, sectionId: string): KnowledgeLevel | undefined {
  return profile.worldSectionLevels[sectionId];
}

function sectionIsAvailable(profile: CharacterKnowledgeProfile, sectionId: string): boolean {
  const level = sectionLevel(profile, sectionId);
  return level !== undefined && level !== 'does_not_know';
}

export function selectWorldKnowledge(
  document: WorldKnowledgeDocument,
  currentMessage: string,
  recentTurns: readonly Readonly<{ speaker: 'player' | 'npc'; text: string }>[],
  currentMapId: string,
  profile: CharacterKnowledgeProfile,
  scope = classifyQuestionScope(currentMessage, recentTurns),
): readonly WorldKnowledgeSection[] {
  const query = normalize([
    ...recentTurns.filter(({ speaker }) => speaker === 'player').slice(-2).map(({ text }) => text),
    currentMessage,
  ].join(' '));
  const boundedQuery = ` ${query} `;
  const worldFrame = document.sections.find(({ id }) => id === 'world-frame');
  const overview = document.sections.find(({ id }) => id === 'overview');
  if (!worldFrame || !overview) return [];
  if (scope !== 'local_halcyra') return Object.freeze([worldFrame]);
  const scored = document.sections.filter(({ id }) => !['world-frame', 'overview'].includes(id)).map((section, index) => ({
    section,
    index,
    score: section.keywords.reduce((total, keyword) => (
      total + (boundedQuery.includes(` ${keyword} `) ? keyword.length : 0)
    ), 0),
  })).filter(({ score, section }) => score > 0 && sectionIsAvailable(profile, section.id))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, MAX_SELECTED_SECTIONS - 2)
    .map(({ section }) => section);
  const currentSection = document.sections.find(({ id }) => id === MAP_SECTION_IDS[currentMapId]);
  if (
    scored.length === 0 && currentSection && sectionIsAvailable(profile, currentSection.id) &&
    /\b(?:here|nearby|around|somewhere|go)\b/iu.test(currentMessage)
  ) {
    scored.push(currentSection);
  }
  return Object.freeze([worldFrame, overview, ...scored]);
}

export function formatWorldKnowledge(
  document: WorldKnowledgeDocument,
  sections: readonly WorldKnowledgeSection[],
  profile: CharacterKnowledgeProfile,
  scope: QuestionScope,
): string {
  const routingInstruction = scope === 'local_halcyra'
    ? 'The question is local to Halcyra. Use the selected island facts and the NPC familiarity labels.'
    : scope === 'real_world'
      ? 'The question is about the wider real world. Do not redirect it to Halcyra. Answer only at the NPC knowledge level. Never state a real place as north, south, east, west, near, far, a distance, or a travel time from Halcyra.'
      : scope === 'personal_npc'
        ? 'The question is personal. Use only this NPC biography, profile, validated memories, and state.'
        : 'The question asks for concealed or unsupported information. Use only validated NPC knowledge and admit what is unknown.';
  return [
    `WORLD FRAME: ${document.title}`,
    `QUESTION SCOPE: ${scope}`,
    routingInstruction,
    'Do not invent a business name, exact geography, current fact, or concealed detail.',
    ...sections.map((section) => {
      const level = profile.worldSectionLevels[section.id];
      const familiarity = level ? `\nNPC FAMILIARITY: ${level}` : '';
      return `### ${section.title}${familiarity}\n${section.body}`;
    }),
  ].join('\n\n');
}
