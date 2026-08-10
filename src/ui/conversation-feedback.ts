import type { ConversationTurnResult } from '../application/effects/ConversationPort';

export function authoredBeginFallback(npcId: string): Readonly<{ displayName: string; dialogue: string }> {
  return npcId === 'linda'
    ? { displayName: 'Linda', dialogue: "The island's systems are acting up. We can keep this simple." }
    : { displayName: 'Resident', dialogue: 'The network is down. Nice weather, though.' };
}

export function conversationGenerationNote(source: ConversationTurnResult['source']): string {
  if (source === 'authored-fallback') return 'LOCAL MODEL MISSED · AUTHORED FALLBACK USED';
  if (source === 'model' || source === 'corrected-model') return 'LOCAL MODEL REPLIED';
  return 'AUTHORED RESPONSE USED';
}
