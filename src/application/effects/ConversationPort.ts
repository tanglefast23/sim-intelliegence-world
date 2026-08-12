import { z } from 'zod';

import { StableIdSchema } from '../../domain/state/ids';
import { WorldStateSchema } from '../../domain/state/schema';
import { RelationshipStageSchema } from '../../domain/relationships/relationship';

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

export const StructuredConversationActionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('home_invitation'),
    proposedMinute: z.number().int().nonnegative(),
  }).strict(),
  z.object({
    kind: z.literal('relationship_stage'),
    targetStage: RelationshipStageSchema.exclude(['stranger']),
    actionId: z.enum(['greet', 'ask_date', 'aggressive_flirt']),
  }).strict(),
]);

export const ConversationTurnRequestSchema = z.object({
  conversationId: ConversationIdSchema,
  turnId: StableIdSchema.refine((id) => id.length <= 64, 'Turn ID is too long.'),
  message: z.string().trim().min(1).max(500),
}).strict();

export const ConversationSocialOutcomeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('home_invitation'),
    status: z.enum(['accepted', 'rejected', 'countered', 'replan_required', 'completed', 'cancelled']),
    reasonId: StableIdSchema,
    scheduledMinute: z.number().int().nonnegative().optional(),
    counterProposedMinute: z.number().int().nonnegative().optional(),
  }).strict(),
  z.object({
    kind: z.literal('relationship_stage'),
    accepted: z.boolean(),
    targetStage: RelationshipStageSchema.exclude(['stranger']),
    reasonId: StableIdSchema,
  }).strict(),
]);

export const ConversationPromptSuggestionSchema = z.object({
  id: z.enum(['ask_out', 'invite_home']),
  label: z.string().min(1).max(40),
  suggestedText: z.string().min(1).max(500),
}).strict();

export const ConversationTurnResultSchema = z.object({
  conversationId: ConversationIdSchema,
  dialogue: z.string().min(1).max(420),
  emotion: z.enum(['neutral', 'warm', 'wary', 'angry', 'afraid', 'sad', 'amused']),
  intent: z.enum(['continue_conversation', 'ask_question', 'inform', 'unknown_topic', 'refuse', 'end_conversation']),
  source: z.enum(['model', 'corrected-model', 'authored-fallback', 'policy-refusal', 'authored-structured']),
  stagedChangeCount: z.number().int().min(0).max(32),
  promptSuggestions: z.array(ConversationPromptSuggestionSchema).max(2),
  socialOutcome: ConversationSocialOutcomeSchema.optional(),
}).strict();

export const CloseConversationRequestSchema = z.object({ conversationId: ConversationIdSchema }).strict();
export const CloseConversationResultSchema = z.object({ state: WorldStateSchema }).strict();

export type BeginConversationRequest = z.infer<typeof BeginConversationRequestSchema>;
export type BeginConversationResult = z.infer<typeof BeginConversationResultSchema>;
export type ConversationTurnRequest = z.infer<typeof ConversationTurnRequestSchema>;
export type ConversationTurnResult = z.infer<typeof ConversationTurnResultSchema>;
export type ConversationPromptSuggestion = z.infer<typeof ConversationPromptSuggestionSchema>;
export type StructuredConversationAction = z.infer<typeof StructuredConversationActionSchema>;
export type ConversationSocialOutcome = z.infer<typeof ConversationSocialOutcomeSchema>;
export type CloseConversationRequest = z.infer<typeof CloseConversationRequestSchema>;
export type CloseConversationResult = z.infer<typeof CloseConversationResultSchema>;

export type ConversationPort = Readonly<{
  beginConversation: (request: BeginConversationRequest) => Promise<BeginConversationResult>;
  sendConversationTurn: (request: ConversationTurnRequest) => Promise<ConversationTurnResult>;
  endConversation: (request: CloseConversationRequest) => Promise<CloseConversationResult>;
  abortConversation: (request: CloseConversationRequest) => Promise<CloseConversationResult>;
}>;
