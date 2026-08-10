import type { ConversationTurnResult } from '../application/effects/ConversationPort';

export type VocalCueId = 'greeting' | 'laugh' | 'sigh' | 'consequence';

export const VOCAL_CUE_CAPTIONS: Readonly<Record<VocalCueId, string>> = {
  greeting: '[GREETING CHIRP]',
  laugh: '[SHORT LAUGH]',
  sigh: '[SOFT SIGH]',
  consequence: '[CONSEQUENCE TONE]',
};

export function cueForConversationTurn(
  turn: Pick<ConversationTurnResult, 'emotion' | 'source'>,
): VocalCueId | undefined {
  if (turn.source === 'authored-fallback' || turn.source === 'policy-refusal') return 'sigh';
  if (turn.emotion === 'amused') return 'laugh';
  if (turn.emotion === 'sad' || turn.emotion === 'afraid') return 'sigh';
  return undefined;
}
