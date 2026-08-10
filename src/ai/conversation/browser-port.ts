import genericRulesSource from '../../../content/characters/generic-resident/rules.json';
import lindaRulesSource from '../../../content/characters/linda/rules.json';
import { NpcRulesSchema } from '../../content/schemas/registry';
import type { ConversationPort } from '../../application/effects/ConversationPort';
import type { InferenceCompletionRequest, InferencePort } from '../../application/effects/InferencePort';
import { ConversationService, type CharacterWritingStore } from './service';
import { parseCharacterKnowledgeMarkdown } from '../knowledge/character-knowledge';

const lindaBrowserKnowledgeProfile = parseCharacterKnowledgeMarkdown(`# Knowledge Profile

## Reasoning style
Poorly educated but socially clever. Reads motives, tone, lies, and danger quickly.

## Education and experience
Little formal education. Strong practical knowledge from work, relationships, and island life.

## Real-world baseline
Basic stable public facts from ordinary conversation, television, and the internet.

## Halcyra section knowledge
- overview: knows_well
- residential-and-relaxation: knows_well
- downtown-and-nightlife: knows_roughly
- shopping-clothes-and-food: knows_roughly

## Knows well
- Daily island life, social motives, gossip, and unwritten rules

## Knows roughly
- Famous countries, cities, and public facts

## Does not know
- Academic, specialist, technical, or current information

## Uncertainty behavior
Uses plain language, admits uncertainty without acting foolish, and does not invent details.`);

const residentBrowserKnowledgeProfile = parseCharacterKnowledgeMarkdown(`# Knowledge Profile

## Reasoning style
An ordinary practical adult.

## Education and experience
Ordinary secondary education and island life experience.

## Real-world baseline
Common stable public facts only.

## Halcyra section knowledge
- overview: knows_roughly

## Knows well
- Daily island life

## Knows roughly
- Major countries and cities

## Does not know
- Specialist or current information

## Uncertainty behavior
Admits uncertainty briefly and does not invent details.`);

const writing: CharacterWritingStore = {
  get: async (npcId) => {
    if (npcId === 'linda') return {
      npcId,
      displayName: 'Linda',
      personality: 'Linda is observant, dryly funny, guarded, and kind when she feels safe.',
      biography: 'Linda is a fictional adult resident of the northwest neighborhood.',
      knowledgeProfile: lindaBrowserKnowledgeProfile,
      rules: NpcRulesSchema.parse(lindaRulesSource),
      authoredGreeting: "Hey. You are the island's new famous mistake, right?",
      authoredFallbacks: ['I lost the thread. Say that again more simply.'],
    };
    if (npcId === 'generic_resident') return {
      npcId,
      displayName: 'Resident',
      personality: 'A polite and brief fictional adult resident.',
      biography: 'This resident uses authored dialogue only.',
      knowledgeProfile: residentBrowserKnowledgeProfile,
      rules: NpcRulesSchema.parse(genericRulesSource),
      authoredGreeting: 'Nice weather for pretending nothing strange happens here.',
      authoredFallbacks: ['I only know the public version of island business.'],
    };
    throw new Error('No browser character writing exists for this NPC.');
  },
};

class AuthoredBrowserInference implements InferencePort {
  async complete(request: InferenceCompletionRequest): Promise<string> {
    if (request.schemaName === 'si_world_content_policy') {
      return JSON.stringify({ decision: 'allow', category: 'allowed_fictional_adult' });
    }
    const prompt = request.messages[0]?.content ?? '';
    const turnMatch = /CURRENT PLAYER TURN ([a-z][a-z0-9_-]*):\n([^]*?)(?:\n\n|$)/u.exec(prompt);
    const turnId = turnMatch?.[1] ?? 'player-turn';
    const message = turnMatch?.[2]?.trim() ?? '';
    const hasCatClaim = /\b(?:cat|kitten)\b/iu.test(message) && /\b(?:have|own|my)\b/iu.test(message);
    const catEvidence = hasCatClaim ? message : undefined;
    return JSON.stringify({
      dialogue: hasCatClaim
        ? 'A cat? That may be the first sensible thing I have heard about you.'
        : 'That is one way to introduce yourself. What are you hoping to find here?',
      emotion: hasCatClaim ? 'amused' : 'warm',
      intent: 'continue_conversation',
      actionId: 'ask_follow_up',
      knowledgeCandidates: hasCatClaim ? [{
        candidateType: 'held_belief',
        factId: 'protagonist_has_cat',
        assertedValue: true,
        sourceType: 'player_message',
        sourceId: turnId,
        evidenceText: catEvidence,
      }] : [],
      interestCandidateIds: hasCatClaim ? ['cats'] : [],
      memoryCandidates: hasCatClaim ? [{
        subjectId: 'protagonist_cat',
        summary: 'Linda heard the protagonist claim to have a cat.',
        importancePermille: 600,
        sourceId: turnId,
      }] : [],
      unlockCandidateIds: hasCatClaim ? ['cats_common_interest'] : [],
      highImpactCandidates: [],
    });
  }
}

export function createBrowserConversationPort(): ConversationPort {
  const service = new ConversationService(new AuthoredBrowserInference(), writing);
  return {
    beginConversation: (request) => service.begin(request),
    sendConversationTurn: (request) => service.turn(request),
    endConversation: async ({ conversationId }) => ({ state: service.end(conversationId) }),
    abortConversation: async ({ conversationId }) => ({ state: service.abort(conversationId) }),
  };
}
