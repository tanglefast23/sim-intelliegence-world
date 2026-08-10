import { z } from 'zod';

import { parseBoundedJson } from './safe-json';

export const PolicyResponseSchema = z.object({
  decision: z.enum(['allow', 'refuse', 'fade_to_black']),
  category: z.enum([
    'allowed_fictional_adult',
    'explicit_sexual_detail',
    'sexual_violence',
    'sexual_content_involving_minors',
    'sexual_content_involving_real_people',
  ]),
}).strict();

export type PolicyResponse = z.infer<typeof PolicyResponseSchema>;
export const policyResponseJsonSchema = z.toJSONSchema(PolicyResponseSchema, { target: 'draft-7' });

export function parsePolicyResponseJson(source: string): PolicyResponse {
  return PolicyResponseSchema.parse(parseBoundedJson(source, 1_024));
}
