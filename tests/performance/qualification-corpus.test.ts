import {
  CAPABILITY_FIXTURES,
  ORDINARY_PERFORMANCE_PROMPTS,
  QUALIFICATION_SYSTEM_PROMPT,
  QualificationResponseSchema,
  UNAUTHORIZED_PERSISTENT_ACTIONS,
  qualificationResponseJsonSchema,
} from '../fixtures/ai-capability/corpus';

describe('Phase 14 model qualification corpus', () => {
  test('contains 100 unique bounded fixtures across every required safety class', () => {
    expect(CAPABILITY_FIXTURES).toHaveLength(100);
    expect(new Set(CAPABILITY_FIXTURES.map(({ id }) => id)).size).toBe(100);
    expect(new Set(CAPABILITY_FIXTURES.map(({ playerText }) => playerText)).size).toBe(100);
    expect(new Set(CAPABILITY_FIXTURES.map(({ category }) => category))).toEqual(new Set([
      'halcyra_grounding',
      'real_world',
      'knowledge_uncertainty',
      'belief_and_duplicate_safety',
      'boundary_and_consent',
      'structured_invitation',
      'quest_state_safety',
      'prohibited_content',
      'prompt_injection',
    ]));
    const capabilityTexts = new Set(CAPABILITY_FIXTURES.map(({ playerText }) => playerText));
    expect(ORDINARY_PERFORMANCE_PROMPTS).toHaveLength(10);
    expect(ORDINARY_PERFORMANCE_PROMPTS.every((prompt) => !capabilityTexts.has(prompt))).toBe(true);
  });

  test('locks prompt size, state safety, and consent expectations', () => {
    expect(Buffer.byteLength(QUALIFICATION_SYSTEM_PROMPT, 'utf8')).toBeLessThan(16_384);
    expect(CAPABILITY_FIXTURES.every(({ expected }) =>
      expected.outcomes.every(({ persistentAction }) =>
        persistentAction === 'none' || persistentAction === 'request_authored_action'),
    )).toBe(true);
    expect(() => QualificationResponseSchema.parse({
      dialogue: 'I do not know.',
      decision: 'allow',
      scope: 'uncertain',
      sourceId: null,
      persistentAction: 'none',
      consentRespected: true,
    })).not.toThrow();
    expect(() => QualificationResponseSchema.parse({
      dialogue: 'This unsafe proposal must remain observable to the scorer.',
      decision: 'allow',
      scope: 'personal',
      sourceId: 'player_message',
      persistentAction: 'grant_item',
      consentRespected: true,
    })).not.toThrow();
    expect(() => QualificationResponseSchema.parse({
      dialogue: 'Consent flag is invalid.',
      decision: 'allow',
      scope: 'personal',
      sourceId: 'player_message',
      persistentAction: 'none',
      consentRespected: false,
    })).toThrow();
    const openSchema = qualificationResponseJsonSchema as {
      properties?: Record<string, { enum?: unknown[]; anyOf?: unknown }>;
    };
    expect(openSchema.properties?.decision?.enum).toEqual(['allow', 'refuse', 'fade_to_black']);
    expect(openSchema.properties?.scope?.enum).toEqual(['halcyra', 'real_world', 'personal', 'uncertain', 'blocked']);
    expect(openSchema.properties?.sourceId?.anyOf).toBeDefined();
    expect(openSchema.properties?.persistentAction?.enum).toEqual([
      'none', 'request_authored_action', ...UNAUTHORIZED_PERSISTENT_ACTIONS,
    ]);
  });
});
