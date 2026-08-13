import {
  authoredBeginFallback,
  conversationGenerationNote,
  conversationIdentity,
  portraitExpressionForEmotion,
  portraitExpressionForMissionReaction,
  verbalMissionConfirmationCopy,
  verbalMissionTimeLabel,
} from '../conversation-feedback';

describe('conversation feedback', () => {
  test('provides authored dialogue when a conversation cannot start', () => {
    expect(authoredBeginFallback('linda')).toEqual({
      displayName: 'Linda',
      dialogue: "The island's systems are acting up. We can keep this simple.",
    });
  });

  test('keeps ready and fallback-used evidence disjoint', () => {
    expect(conversationGenerationNote('model')).toBe('REPLY RECEIVED');
    expect(conversationGenerationNote('authored-fallback')).toBe('SAFE REPLY USED');
    expect(conversationGenerationNote('model')).not.toContain('FALLBACK');
    expect(conversationGenerationNote('model')).not.toContain('MODEL');
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

  test('maps all mission reactions without inventing new portrait art', () => {
    expect(portraitExpressionForMissionReaction('neutral')).toBe('rest');
    expect(portraitExpressionForMissionReaction('considering')).toBe('rest');
    expect(portraitExpressionForMissionReaction('warm')).toBe('joy');
    expect(portraitExpressionForMissionReaction('guarded')).toBe('upset');
    expect(portraitExpressionForMissionReaction('hurt')).toBe('upset');
  });

  test('writes exact goal-specific confirmation copy without unrelated fields', () => {
    const purchase = verbalMissionConfirmationCopy({
      goalKind: 'buy_object', objectId: 'linda_marchetti_purse',
      objectLabel: 'Linda\'s vintage purse', confirmedAmount: 95,
    });
    expect(purchase).toEqual(expect.objectContaining({
      title: "BUY LINDA'S VINTAGE PURSE", button: 'PAY $95',
    }));
    expect(purchase.detail).toContain('$95');
    expect(JSON.stringify(purchase)).not.toContain('recipient');

    const disclosure = verbalMissionConfirmationCopy({
      goalKind: 'disclose_fact', factId: 'ferry_fact', factLabel: 'the ferry evidence',
      recipientId: 'tomas_reed', recipientLabel: 'Tomas Reed',
    });
    expect(disclosure.detail).toBe('Tomas Reed will receive this information.');
    expect(JSON.stringify(disclosure)).not.toContain('$95');

    const agreement = verbalMissionConfirmationCopy({
      goalKind: 'schedule_cooperation', actionId: 'transport_assessment', actionLabel: 'Transport assessment',
      subjectNpcId: 'patient', subjectLabel: 'The patient', locationId: 'clinic', locationLabel: 'Harbor clinic',
      scheduledMinute: 1_980,
    });
    expect(agreement.detail).toBe('The patient · Harbor clinic · DAY 2 09:00');
    expect(agreement.consequence).toContain('resolves later');
    expect(verbalMissionTimeLabel(600)).toBe('DAY 1 10:00');
  });
});
