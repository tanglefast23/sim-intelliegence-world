import { z } from 'zod';

import { parseBoundedJson } from './safe-json';

export const SpikeResponseSchema = z
  .object({
    dialogue: z.string().min(1).max(280),
    emotion: z.enum(['neutral', 'warm', 'wary', 'angry', 'afraid', 'sad']),
    intent: z.enum(['greet', 'inform', 'ask', 'refuse', 'leave']),
    action: z.object({ type: z.literal('none') }).strict(),
    persistentCandidates: z.array(z.never()).max(0),
  })
  .strict();

export type SpikeResponse = z.infer<typeof SpikeResponseSchema>;

export const spikeResponseJsonSchema = z.toJSONSchema(SpikeResponseSchema, {
  target: 'draft-7',
});

export function parseSpikeResponseJson(source: string): SpikeResponse {
  return SpikeResponseSchema.parse(parseBoundedJson(source));
}

export const authoredNoChangeResponse: SpikeResponse = {
  dialogue: 'I lost my train of thought. Ask me again in a moment.',
  emotion: 'neutral',
  intent: 'leave',
  action: { type: 'none' },
  persistentCandidates: [],
};
