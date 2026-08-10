import { z } from 'zod';

import { StableIdSchema } from '../../domain/state/ids';
import { WorldStateSchema } from '../../domain/state/schema';

const ConversationIdSchema = StableIdSchema.refine((id) => id.length <= 64, 'Conversation ID is too long.');

export const BeginConversationRequestSchema = z.object({
  conversationId: ConversationIdSchema,
  npcId: StableIdSchema,
  state: WorldStateSchema,
}).strict();

export const BeginConversationResultSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('active'),
    conversationId: ConversationIdSchema,
    npcId: StableIdSchema,
    displayName: z.string().min(1).max(80),
    greeting: z.string().min(1).max(420),
    pausedState: WorldStateSchema,
  }).strict(),
  z.object({
    kind: z.literal('ambient'),
    npcId: StableIdSchema,
    displayName: z.string().min(1).max(80),
    dialogue: z.string().min(1).max(420),
    state: WorldStateSchema,
  }).strict(),
]);

export const ConversationTurnRequestSchema = z.object({
  conversationId: ConversationIdSchema,
  turnId: StableIdSchema.refine((id) => id.length <= 64, 'Turn ID is too long.'),
  message: z.string().trim().min(1).max(500),
}).strict();

export const ConversationTurnResultSchema = z.object({
  conversationId: ConversationIdSchema,
  dialogue: z.string().min(1).max(420),
  emotion: z.enum(['neutral', 'warm', 'wary', 'angry', 'afraid', 'sad', 'amused']),
  intent: z.enum(['continue_conversation', 'ask_question', 'inform', 'refuse', 'end_conversation']),
  source: z.enum(['model', 'corrected-model', 'authored-fallback', 'policy-refusal']),
  stagedChangeCount: z.number().int().min(0).max(32),
}).strict();

export const CloseConversationRequestSchema = z.object({ conversationId: ConversationIdSchema }).strict();
export const CloseConversationResultSchema = z.object({ state: WorldStateSchema }).strict();

export type BeginConversationRequest = z.infer<typeof BeginConversationRequestSchema>;
export type BeginConversationResult = z.infer<typeof BeginConversationResultSchema>;
export type ConversationTurnRequest = z.infer<typeof ConversationTurnRequestSchema>;
export type ConversationTurnResult = z.infer<typeof ConversationTurnResultSchema>;
export type CloseConversationRequest = z.infer<typeof CloseConversationRequestSchema>;
export type CloseConversationResult = z.infer<typeof CloseConversationResultSchema>;

export type ConversationPort = Readonly<{
  beginConversation: (request: BeginConversationRequest) => Promise<BeginConversationResult>;
  sendConversationTurn: (request: ConversationTurnRequest) => Promise<ConversationTurnResult>;
  endConversation: (request: CloseConversationRequest) => Promise<CloseConversationResult>;
  abortConversation: (request: CloseConversationRequest) => Promise<CloseConversationResult>;
}>;
