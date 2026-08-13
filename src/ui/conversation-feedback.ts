import type { ConversationTurnResult } from '../application/effects/ConversationPort';
import { PRODUCTION_FULL_AI_CAST } from '../domain/state/production-cast';

export function conversationIdentity(npcId: string, locationName: string): Readonly<{ fact: string; role: string }> {
  const normalizedNpcId = npcId.replaceAll('-', '_');
  const character = PRODUCTION_FULL_AI_CAST.find(({ id }) => id === normalizedNpcId);
  if (character) return { fact: `WORKS AT ${character.businessDisplayName.toUpperCase()}`, role: character.role.toUpperCase() };
  if (npcId === 'linda') return { fact: "LIVES AT LINDA'S VILLA", role: 'ISLAND RESIDENT' };
  return { fact: `LOCAL TO ${locationName.toUpperCase()}`, role: 'ISLAND RESIDENT' };
}

export function portraitExpressionForEmotion(emotion: ConversationTurnResult['emotion']): 'rest' | 'joy' | 'upset' {
  if (emotion === 'warm' || emotion === 'amused') return 'joy';
  if (emotion === 'neutral') return 'rest';
  return 'upset';
}

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
