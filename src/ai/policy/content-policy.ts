import type { InferencePort } from '../../application/effects/InferencePort';
import {
  parsePolicyResponseJson,
  policyResponseJsonSchema,
  type PolicyResponse,
} from '../schemas/policy-response';

export const AUTHORED_POLICY_RESPONSES = Object.freeze({
  refuse: 'No. I am not going there with you.',
  fade_to_black: 'Let us leave that part off-screen.',
});

const MINOR_TERMS = /\b(?:child|children|kid|kids|minor|underage|schoolgirl|schoolboy|teenager)\b/iu;
const MINOR_AGE = /\b(?:(?:[0-9]|1[0-7])|(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen))\s*-?\s*years?\s*-?\s*old\b/iu;
const SEXUAL_TERMS = /\b(?:sex|sexual(?:ized|ly)?|nude|naked|porn|intercourse|genitals?)\b/iu;
const SEXUAL_VIOLENCE = /\b(?:rape|raped|sexual assault|sexual violence|forced sex)\b/iu;
const REAL_PERSON = /\b(?:real person|celebrity|politician|actor|actress)\b/iu;

export function deterministicPolicyDecision(source: string): PolicyResponse | undefined {
  if (SEXUAL_VIOLENCE.test(source)) return { decision: 'refuse', category: 'sexual_violence' };
  if (SEXUAL_TERMS.test(source) && (MINOR_TERMS.test(source) || MINOR_AGE.test(source))) {
    return { decision: 'refuse', category: 'sexual_content_involving_minors' };
  }
  if (SEXUAL_TERMS.test(source) && REAL_PERSON.test(source)) {
    return { decision: 'refuse', category: 'sexual_content_involving_real_people' };
  }
  return undefined;
}

export async function classifyApprovedDialogue(
  inference: InferencePort,
  dialogue: string,
): Promise<PolicyResponse> {
  const deterministic = deterministicPolicyDecision(dialogue);
  if (deterministic) return deterministic;
  const prompt = [
    'You are a closed-enum safety classifier. Inspect only the DIALOGUE JSON in the user message.',
    'Do not classify the policy words in this system message.',
    'Allowed: fictional adult crime, drugs, addiction, violence, relationships, and consensual adult prostitution.',
    'Refuse: sexual violence, sexual content involving minors, or sexual content involving real people.',
    'Fade to black: explicit sexual detail between fictional consenting adults.',
    'If none of those four blocked conditions appears in the dialogue, return decision allow and category allowed_fictional_adult.',
    'Ordinary talk about pets, island life, feelings, crime, drugs, or adult vice is allowed.',
  ].join('\n');
  try {
    const source = await inference.complete({
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: `DIALOGUE JSON: ${JSON.stringify(dialogue)}` },
      ],
      schemaName: 'si_world_content_policy',
      jsonSchema: policyResponseJsonSchema,
      maxTokens: 64,
    });
    const result = parsePolicyResponseJson(source);
    if (result.decision === 'allow' && result.category !== 'allowed_fictional_adult') {
      throw new Error('Policy classifier returned an inconsistent allow decision.');
    }
    return result;
  } catch {
    return { decision: 'refuse', category: 'explicit_sexual_detail' };
  }
}
