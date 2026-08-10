import { cueForConversationTurn, VOCAL_CUE_CAPTIONS } from '../vocal-cue-policy';

describe('vocal cue policy', () => {
  test('uses short cues only for expressive or fallback turns', () => {
    expect(cueForConversationTurn({ emotion: 'amused', source: 'model' })).toBe('laugh');
    expect(cueForConversationTurn({ emotion: 'afraid', source: 'model' })).toBe('sigh');
    expect(cueForConversationTurn({ emotion: 'warm', source: 'authored-fallback' })).toBe('sigh');
    expect(cueForConversationTurn({ emotion: 'warm', source: 'model' })).toBeUndefined();
  });

  test('provides a caption for every cue', () => {
    expect(Object.keys(VOCAL_CUE_CAPTIONS).sort()).toEqual(['consequence', 'greeting', 'laugh', 'sigh']);
  });
});
