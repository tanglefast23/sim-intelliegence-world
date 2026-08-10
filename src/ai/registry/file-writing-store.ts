import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { z } from 'zod';

import { NpcRulesSchema } from '../../content/schemas/registry';
import type { CharacterWritingStore } from '../conversation/service';
import { parseCharacterKnowledgeMarkdown, validateCharacterWorldKnowledge } from '../knowledge/character-knowledge';
import { parseWorldKnowledgeMarkdown, type WorldKnowledgeDocument } from '../knowledge/world-knowledge';
import type { CharacterWriting } from './scene-registry';

const AuthoredDialogueSchema = z.object({
  schemaVersion: z.literal(1),
  displayName: z.string().trim().min(1).max(80),
  greeting: z.string().trim().min(1).max(420),
  fallbacks: z.array(z.string().trim().min(1).max(420)).min(1).max(8),
}).strict();

export class FileCharacterWritingStore implements CharacterWritingStore {
  readonly #cache = new Map<string, Promise<CharacterWriting>>();
  #worldKnowledge: Promise<WorldKnowledgeDocument> | undefined;

  constructor(private readonly contentRoot: string) {}

  get(npcId: string): Promise<CharacterWriting> {
    const existing = this.#cache.get(npcId);
    if (existing) return existing;
    const pending = this.#load(npcId);
    this.#cache.set(npcId, pending);
    return pending;
  }

  async #load(npcId: string): Promise<CharacterWriting> {
    if (!/^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$/u.test(npcId)) throw new Error('Character content ID is invalid.');
    const folderName = npcId.replaceAll('_', '-');
    const root = resolve(this.contentRoot, 'characters', folderName);
    const relativeRoot = relative(resolve(this.contentRoot), root);
    if (relativeRoot === '' || relativeRoot.startsWith('..') || isAbsolute(relativeRoot)) {
      throw new Error('Character content escaped its root.');
    }
    const [personality, biography, knowledgeSource, rulesSource, dialogueSource, worldKnowledge] = await Promise.all([
      readFile(resolve(root, 'personality.md'), 'utf8'),
      readFile(resolve(root, 'biography.md'), 'utf8'),
      readFile(resolve(root, 'knowledge.md'), 'utf8'),
      readFile(resolve(root, 'rules.json'), 'utf8'),
      readFile(resolve(root, 'authored-dialogue.json'), 'utf8'),
      this.#loadWorldKnowledge(),
    ]);
    if (personality.trim().length === 0 || biography.trim().length === 0) throw new Error('Character writing file is empty.');
    const rules = NpcRulesSchema.parse(JSON.parse(rulesSource) as unknown);
    const dialogue = AuthoredDialogueSchema.parse(JSON.parse(dialogueSource) as unknown);
    const knowledgeProfile = parseCharacterKnowledgeMarkdown(knowledgeSource);
    validateCharacterWorldKnowledge(knowledgeProfile, new Set(worldKnowledge.sections.map(({ id }) => id)));
    if (rules.npcId !== npcId) throw new Error('Character rules ID does not match its folder.');
    return Object.freeze({
      npcId,
      displayName: dialogue.displayName,
      personality,
      biography,
      knowledgeProfile,
      rules,
      worldKnowledge,
      authoredGreeting: dialogue.greeting,
      authoredFallbacks: dialogue.fallbacks,
    });
  }

  #loadWorldKnowledge(): Promise<WorldKnowledgeDocument> {
    this.#worldKnowledge ??= readFile(resolve(this.contentRoot, 'world', 'HalcyraIsland.md'), 'utf8')
      .then(parseWorldKnowledgeMarkdown);
    return this.#worldKnowledge;
  }
}
