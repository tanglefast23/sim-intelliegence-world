import { authoredBeginFallback, conversationGenerationNote, conversationIdentity, portraitExpressionForEmotion } from '../conversation-feedback';

describe('conversation feedback', () => {
  test('provides authored dialogue when a conversation cannot start', () => {
    expect(authoredBeginFallback('linda')).toEqual({
      displayName: 'Linda',
      dialogue: "The island's systems are acting up. We can keep this simple.",
    });
  });

  test('keeps ready and fallback-used evidence disjoint', () => {
    expect(conversationGenerationNote('model')).toBe('LOCAL MODEL REPLIED');
    expect(conversationGenerationNote('authored-fallback')).toContain('FALLBACK USED');
    expect(conversationGenerationNote('model')).not.toContain('FALLBACK');
  });

  test('maps conversation emotion to an authored portrait reaction', () => {
    expect(portraitExpressionForEmotion('warm')).toBe('joy');
    expect(portraitExpressionForEmotion('neutral')).toBe('rest');
    expect(portraitExpressionForEmotion('wary')).toBe('upset');
  });

  test('shows a named resident job and one known workplace fact', () => {
    expect(conversationIdentity('mina_park', 'Sunward Villas')).toEqual({
      fact: 'WORKS AT SHOREGLASS SPA',
      role: 'SPA MANAGER',
    });
  });
});
