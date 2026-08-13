import { z } from 'zod';

import { StableIdSchema } from '../../domain/state/ids';
import { WorldStateSchema } from '../../domain/state/schema';
import { RelationshipStageSchema } from '../../domain/relationships/relationship';
import { VERBAL_MISSION_OUTCOMES } from '../../domain/verbal-missions/contracts';

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
    verbalMission: z.object({
      missionId: StableIdSchema,
      goalKind: z.enum(['disclose_fact', 'buy_object', 'schedule_cooperation']),
      status: z.enum(['available', 'active']),
      roomState: z.enum(['open', 'cooling', 'guarded', 'done']),
    }).strict().optional(),
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

export const ReadVerbalMissionTurnRequestSchema = ConversationTurnRequestSchema;

const VerbalMissionConfirmationSchema = z.discriminatedUnion('goalKind', [
  z.object({ goalKind: z.literal('disclose_fact'), factId: StableIdSchema }).strict(),
  z.object({
    goalKind: z.literal('buy_object'), objectId: StableIdSchema,
    confirmedAmount: z.number().int().nonnegative(),
  }).strict(),
  z.object({
    goalKind: z.literal('schedule_cooperation'), actionId: StableIdSchema,
    subjectNpcId: StableIdSchema, locationId: StableIdSchema,
    scheduledMinute: z.number().int().nonnegative(),
  }).strict(),
]);

export const ReadVerbalMissionTurnResultSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('clarify'),
    conversationId: ConversationIdSchema,
    turnId: StableIdSchema,
    dialogue: z.string().min(1).max(420),
    source: z.literal('authored-clarification'),
  }).strict(),
  z.object({
    kind: z.literal('decided'),
    conversationId: ConversationIdSchema,
    turnId: StableIdSchema,
    missionId: StableIdSchema,
    outcomeId: StableIdSchema,
    outcome: z.enum(VERBAL_MISSION_OUTCOMES),
    reactionId: StableIdSchema,
    readTheRoom: z.string().min(1).max(240),
    portraitId: z.enum(['neutral', 'warm', 'considering', 'guarded', 'hurt']),
    cueId: z.enum(['greeting', 'laugh', 'sigh', 'consequence']).nullable(),
    concernTransitions: z.array(z.object({
      concernId: StableIdSchema,
      from: z.enum(['hidden', 'open', 'eased', 'resolved', 'hardened']),
      to: z.enum(['hidden', 'open', 'eased', 'resolved', 'hardened']),
      reasonId: StableIdSchema,
    }).strict()).max(8),
    roomState: z.enum(['open', 'cooling', 'guarded', 'done']),
    stagedChangeCount: z.number().int().nonnegative().max(16),
    confirmation: VerbalMissionConfirmationSchema.nullable(),
  }).strict(),
]);

export const CompleteVerbalMissionTurnRequestSchema = z.object({
  conversationId: ConversationIdSchema,
  turnId: StableIdSchema.refine((id) => id.length <= 64, 'Turn ID is too long.'),
}).strict();

export const CompleteVerbalMissionTurnResultSchema = z.object({
  conversationId: ConversationIdSchema,
  turnId: StableIdSchema,
  dialogue: z.string().min(1).max(420),
  emotion: z.enum(['neutral', 'warm', 'wary', 'angry', 'afraid', 'sad', 'amused']),
  source: z.enum(['model', 'corrected-model', 'authored-fallback']),
}).strict();

export const ConfirmVerbalMissionGoalRequestSchema = z.discriminatedUnion('goalKind', [
  z.object({ conversationId: ConversationIdSchema, goalKind: z.literal('disclose_fact') }).strict(),
  z.object({
    conversationId: ConversationIdSchema, goalKind: z.literal('buy_object'),
    confirmedAmount: z.number().int().nonnegative(),
  }).strict(),
  z.object({
    conversationId: ConversationIdSchema, goalKind: z.literal('schedule_cooperation'),
    scheduledMinute: z.number().int().nonnegative(),
  }).strict(),
]);

export const ConfirmVerbalMissionGoalResultSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('confirmed'), missionId: StableIdSchema, resultId: StableIdSchema,
    journalReceiptId: StableIdSchema, state: WorldStateSchema,
  }).strict(),
  z.object({
    kind: z.literal('rejected'), missionId: StableIdSchema,
    reasonId: z.literal('goal_confirmation_invalid'), state: WorldStateSchema,
  }).strict(),
]);

export type BeginConversationRequest = z.infer<typeof BeginConversationRequestSchema>;
export type BeginConversationResult = z.infer<typeof BeginConversationResultSchema>;
export type ConversationTurnRequest = z.infer<typeof ConversationTurnRequestSchema>;
export type ConversationTurnResult = z.infer<typeof ConversationTurnResultSchema>;
export type ConversationPromptSuggestion = z.infer<typeof ConversationPromptSuggestionSchema>;
export type StructuredConversationAction = z.infer<typeof StructuredConversationActionSchema>;
export type ConversationSocialOutcome = z.infer<typeof ConversationSocialOutcomeSchema>;
export type CloseConversationRequest = z.infer<typeof CloseConversationRequestSchema>;
export type CloseConversationResult = z.infer<typeof CloseConversationResultSchema>;
export type ReadVerbalMissionTurnRequest = z.infer<typeof ReadVerbalMissionTurnRequestSchema>;
export type ReadVerbalMissionTurnResult = z.infer<typeof ReadVerbalMissionTurnResultSchema>;
export type CompleteVerbalMissionTurnRequest = z.infer<typeof CompleteVerbalMissionTurnRequestSchema>;
export type CompleteVerbalMissionTurnResult = z.infer<typeof CompleteVerbalMissionTurnResultSchema>;
export type ConfirmVerbalMissionGoalRequest = z.infer<typeof ConfirmVerbalMissionGoalRequestSchema>;
export type ConfirmVerbalMissionGoalResult = z.infer<typeof ConfirmVerbalMissionGoalResultSchema>;

export type ConversationPort = Readonly<{
  beginConversation: (request: BeginConversationRequest) => Promise<BeginConversationResult>;
  sendConversationTurn: (request: ConversationTurnRequest) => Promise<ConversationTurnResult>;
  readVerbalMissionTurn: (request: ReadVerbalMissionTurnRequest) => Promise<ReadVerbalMissionTurnResult>;
  completeVerbalMissionTurn: (request: CompleteVerbalMissionTurnRequest) => Promise<CompleteVerbalMissionTurnResult>;
  confirmVerbalMissionGoal: (request: ConfirmVerbalMissionGoalRequest) => Promise<ConfirmVerbalMissionGoalResult>;
  endConversation: (request: CloseConversationRequest) => Promise<CloseConversationResult>;
  abortConversation: (request: CloseConversationRequest) => Promise<CloseConversationResult>;
}>;
