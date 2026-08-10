import { authoredBeginFallback, conversationGenerationNote } from '../conversation-feedback';

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
});
