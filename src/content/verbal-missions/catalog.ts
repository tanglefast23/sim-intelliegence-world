import { z } from 'zod';

import type { VerbalMissionContentStore, VerbalMissionSessionContent } from '../../ai/conversation/verbal-mission-session';
import { StableIdSchema } from '../../domain/state/ids';
import { NpcDispositionSchema, VerbalMissionDefinitionSchema } from '../schemas/verbal-mission';

const PromptReferentSchema = z.object({
  id: StableIdSchema,
  label: z.string().trim().min(1).max(100),
  aliases: z.array(z.string().trim().min(1).max(60)).max(8).optional(),
}).strict();

const PromptFactSchema = z.object({
  id: StableIdSchema,
  description: z.string().trim().min(1).max(120),
  aliases: z.array(z.string().trim().min(1).max(60)).max(8).optional(),
}).strict();

export const VerbalMissionContentFileSchema = z.object({
  disposition: NpcDispositionSchema,
  definition: VerbalMissionDefinitionSchema,
  referents: z.array(PromptReferentSchema).min(1).max(32),
  facts: z.array(PromptFactSchema).max(32),
  readTheRoomLines: z.record(StableIdSchema, z.string().trim().min(1).max(240)),
  speakableFactTexts: z.record(StableIdSchema, z.string().trim().min(1).max(240)),
}).strict().superRefine((content, context) => {
  for (const reaction of content.definition.reactions) {
    if (!content.readTheRoomLines[reaction.readTheRoomId]) {
      context.addIssue({ code: 'custom', path: ['readTheRoomLines'], message: `Missing ${reaction.readTheRoomId}.` });
    }
  }
  const factIds = new Set(content.facts.map(({ id }) => id));
  for (const lever of content.definition.levers) {
    for (const factId of lever.newlySpeakableFactIds) {
      if (!factIds.has(factId) || !content.speakableFactTexts[factId]) {
        context.addIssue({ code: 'custom', path: ['speakableFactTexts'], message: `Missing speakable copy for ${factId}.` });
      }
    }
  }
});

export type VerbalMissionContentFile = z.infer<typeof VerbalMissionContentFileSchema>;

export function parseVerbalMissionContentFile(candidate: unknown): VerbalMissionContentFile {
  return VerbalMissionContentFileSchema.parse(candidate);
}

export function createVerbalMissionContentStore(candidates: readonly unknown[]): VerbalMissionContentStore {
  const content = new Map(candidates.map((candidate) => {
    const parsed = parseVerbalMissionContentFile(candidate);
    return [parsed.definition.missionId, parsed] as const;
  }));
  if (content.size !== candidates.length) throw new Error('Duplicate production Verbal Mission content ID.');
  return {
    get: async (missionId: string): Promise<VerbalMissionSessionContent> => {
      const result = content.get(missionId);
      if (!result) throw new Error(`Unknown production Verbal Mission: ${missionId}`);
      return result;
    },
  };
}
