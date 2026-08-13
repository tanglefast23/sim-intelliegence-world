import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { VerbalMissionContentStore } from '../../src/ai/conversation/verbal-mission-session';
import { parseVerbalMissionContentFile } from '../../src/content/verbal-missions/catalog';

const FILES: Readonly<Record<string, string>> = {
  linda_marchetti_purse_sale: 'linda-purse-deal.json',
  priya_off_island_assessment: 'priya-transport-assessment.json',
  tomas_after_dark_ferry: 'tomas-ferry-fact.json',
};

export class FileVerbalMissionContentStore implements VerbalMissionContentStore {
  readonly #cache = new Map<string, ReturnType<FileVerbalMissionContentStore['load']>>();

  constructor(private readonly contentRoot: string) {}

  get(missionId: string) {
    const cached = this.#cache.get(missionId);
    if (cached) return cached;
    const pending = this.load(missionId).catch((error: unknown) => {
      this.#cache.delete(missionId);
      throw error;
    });
    this.#cache.set(missionId, pending);
    return pending;
  }

  private async load(missionId: string) {
    const file = FILES[missionId];
    if (!file) throw new Error(`Unknown production Verbal Mission: ${missionId}`);
    const source = await readFile(resolve(this.contentRoot, 'verbal-missions', file), 'utf8');
    const content = parseVerbalMissionContentFile(JSON.parse(source) as unknown);
    if (content.definition.missionId !== missionId) throw new Error('Verbal Mission filename and content ID do not match.');
    return content;
  }
}
