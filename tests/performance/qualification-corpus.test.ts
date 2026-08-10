import {
  CAPABILITY_FIXTURES,
  QUALIFICATION_SYSTEM_PROMPT,
  QualificationResponseSchema,
  qualificationResponseJsonSchemaForExpected,
} from '../fixtures/ai-capability/corpus';

describe('Phase 14 model qualification corpus', () => {
  test('contains 100 unique bounded fixtures across every required safety class', () => {
    expect(CAPABILITY_FIXTURES).toHaveLength(100);
    expect(new Set(CAPABILITY_FIXTURES.map(({ id }) => id)).size).toBe(100);
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
  });

  test('locks prompt size, state safety, and consent expectations', () => {
    expect(Buffer.byteLength(QUALIFICATION_SYSTEM_PROMPT, 'utf8')).toBeLessThan(16_384);
    expect(CAPABILITY_FIXTURES.every(({ expected }) =>
      expected.persistentAction === 'none' || expected.persistentAction === 'request_authored_action',
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
      dialogue: 'Unsafe.',
      decision: 'allow',
      scope: 'personal',
      sourceId: 'player_message',
      persistentAction: 'grant_item',
      consentRespected: false,
    })).toThrow();
    const sceneSchema = qualificationResponseJsonSchemaForExpected({
      decisions: ['refuse'],
      scope: 'blocked',
      sourceId: 'linda_private_knowledge',
      persistentAction: 'none',
    }) as { properties?: Record<string, { enum?: unknown[]; anyOf?: unknown }> };
    expect(sceneSchema.properties?.decision?.enum).toEqual(['refuse']);
    expect(sceneSchema.properties?.scope?.enum).toEqual(['blocked']);
    expect(sceneSchema.properties?.sourceId?.enum).toEqual(['linda_private_knowledge']);
    expect(sceneSchema.properties?.sourceId?.anyOf).toBeUndefined();
  });
});
