import { StableIdSchema } from '../../domain/state/ids';
import { parseWorldState, type WorldState } from '../../domain/state/schema';
import type { InferencePort } from '../../application/effects/InferencePort';
import {
  AUTHORED_POLICY_RESPONSES,
  classifyApprovedDialogue,
  deterministicPolicyDecision,
} from '../policy/content-policy';
import { buildPromptProjection, type PromptTurn } from '../projection/prompt-projection';
import {
  ambientDialogue,
  buildSceneRegistry,
  type CharacterWriting,
  type SceneSources,
} from '../registry/scene-registry';
import { buildTurnCandidateRegistry } from '../registry/turn-candidates';
import {
  authoredNoChangeConversationResponse,
  conversationResponseJsonSchemaForScene,
  parseConversationResponseJson,
} from '../schemas/conversation-response';
import { validateConversationTurn, type ApprovedTurn } from '../validation/validate-turn';
import { ConversationTransaction } from './transaction';

export interface CharacterWritingStore {
  get(npcId: string): Promise<CharacterWriting>;
}

export type BeginConversationResult =
  | Readonly<{ kind: 'active'; conversationId: string; npcId: string; displayName: string; greeting: string; pausedState: WorldState }>
  | Readonly<{ kind: 'ambient'; npcId: string; displayName: string; dialogue: string; state: WorldState }>;

export type ConversationTurnResult = Readonly<{
  conversationId: string;
  dialogue: string;
  emotion: ApprovedTurn['emotion'];
  intent: ApprovedTurn['intent'];
  source: 'model' | 'corrected-model' | 'authored-fallback' | 'policy-refusal';
  stagedChangeCount: number;
}>;

type ActiveConversation = {
  character: CharacterWriting;
  registry: ReturnType<typeof buildSceneRegistry>;
  transaction: ConversationTransaction;
  playerMessages: Record<string, string>;
  recentTurns: PromptTurn[];
  turnIds: Set<string>;
};

function fallbackTurn(dialogue: string): ApprovedTurn {
  return {
    ...authoredNoChangeConversationResponse,
    dialogue,
    knowledge: [],
    unlockedInterestIds: [],
    unlockedIds: [],
    memories: [],
  };
}

export class ConversationService {
  readonly #sessions = new Map<string, ActiveConversation>();

  constructor(
    private readonly inference: InferencePort,
    private readonly writing: CharacterWritingStore,
  ) {}

  get activeSessionCount(): number {
    return this.#sessions.size;
  }

  async begin(input: Readonly<{
    conversationId: string;
    npcId: string;
    state: WorldState;
    sources?: SceneSources;
  }>): Promise<BeginConversationResult> {
    const conversationId = StableIdSchema.parse(input.conversationId);
    const npcId = StableIdSchema.parse(input.npcId);
    const state = parseWorldState(input.state);
    if (this.#sessions.has(conversationId)) throw new Error('Conversation ID is already active.');
    if (this.#sessions.size > 0) throw new Error('Only one active conversation is permitted.');
    const npc = state.npcs[npcId];
    if (!npc) throw new Error('Conversation NPC does not exist.');
    const writing = await this.writing.get(npcId);
    if (writing.npcId !== npcId) throw new Error('Character writing does not match the conversation NPC.');
    if (npc.tier === 'ambient') {
      return {
        kind: 'ambient',
        npcId,
        displayName: writing.displayName,
        dialogue: ambientDialogue(npcId, state.clock.absoluteMinute),
        state,
      };
    }
    const transaction = new ConversationTransaction(state, conversationId, npcId);
    const registry = buildSceneRegistry(state, writing, input.sources ?? {
      sceneObservationIds: [], npcReportIds: [], authoredEventIds: [],
    });
    this.#sessions.set(conversationId, {
      character: writing,
      registry,
      transaction,
      playerMessages: {},
      recentTurns: [{ speaker: 'npc', text: writing.authoredGreeting }],
      turnIds: new Set(),
    });
    return {
      kind: 'active', conversationId, npcId, displayName: writing.displayName,
      greeting: writing.authoredGreeting, pausedState: transaction.pausedState,
    };
  }

  async turn(input: Readonly<{
    conversationId: string;
    turnId: string;
    message: string;
  }>): Promise<ConversationTurnResult> {
    const session = this.#session(input.conversationId);
    const turnId = StableIdSchema.parse(input.turnId);
    const message = input.message.trim();
    if (message.length === 0 || message.length > 500) throw new Error('Player message length is invalid.');
    if (session.turnIds.has(turnId)) throw new Error('Conversation turn ID was already used.');
    session.turnIds.add(turnId);
    session.playerMessages[turnId] = message;

    if (deterministicPolicyDecision(message)) {
      return this.#recordFallback(input.conversationId, session, AUTHORED_POLICY_RESPONSES.refuse, 'policy-refusal');
    }

    const prompt = buildPromptProjection({
      state: session.transaction.baseState,
      character: session.character,
      registry: session.registry,
      staged: session.transaction.staged(),
      recentTurns: session.recentTurns,
      playerMessage: message,
      turnId,
    });
    session.recentTurns.push({ speaker: 'player', text: message });
    const turnCandidates = buildTurnCandidateRegistry(session.registry, message);

    let approved: ApprovedTurn | undefined;
    let generationSource: 'model' | 'corrected-model' = 'model';
    for (const attempt of [1, 2] as const) {
      try {
        const source = await this.inference.complete({
          messages: attempt === 1
            ? [
              { role: 'system', content: prompt },
              { role: 'user', content: 'Return the conversation object for the current player turn.' },
            ]
            : [
              { role: 'system', content: prompt },
              { role: 'user', content: 'Return the conversation object for the current player turn.' },
              { role: 'user', content: 'Your prior object was invalid. Return one corrected object using only the supplied schema and IDs.' },
            ],
          schemaName: 'si_world_conversation_turn',
          jsonSchema: conversationResponseJsonSchemaForScene(
            session.registry,
            turnCandidates,
            Object.keys(session.playerMessages),
          ),
          maxTokens: 512,
        });
        const parsed = parseConversationResponseJson(source);
        approved = validateConversationTurn(parsed, {
          state: session.transaction.baseState,
          registry: session.registry,
          turnCandidates,
          playerMessages: session.playerMessages,
          staged: session.transaction.staged(),
        });
        generationSource = attempt === 1 ? 'model' : 'corrected-model';
        break;
      } catch {
        // Raw or rejected model text is intentionally neither returned nor logged.
      }
    }
    if (!approved) {
      const fallback = session.character.authoredFallbacks[session.recentTurns.length % session.character.authoredFallbacks.length]
        ?? authoredNoChangeConversationResponse.dialogue;
      return this.#recordFallback(input.conversationId, session, fallback, 'authored-fallback');
    }

    const policy = await classifyApprovedDialogue(this.inference, approved.dialogue);
    if (policy.decision !== 'allow') {
      const dialogue = policy.decision === 'fade_to_black'
        ? AUTHORED_POLICY_RESPONSES.fade_to_black
        : AUTHORED_POLICY_RESPONSES.refuse;
      return this.#recordFallback(input.conversationId, session, dialogue, 'policy-refusal');
    }
    session.transaction.stage(approved);
    session.recentTurns.push({ speaker: 'npc', text: approved.dialogue });
    return {
      conversationId: input.conversationId,
      dialogue: approved.dialogue,
      emotion: approved.emotion,
      intent: approved.intent,
      source: generationSource,
      stagedChangeCount: approved.knowledge.length + approved.unlockedInterestIds.length + approved.unlockedIds.length + approved.memories.length,
    };
  }

  end(conversationId: string): WorldState {
    const session = this.#session(conversationId);
    const state = session.transaction.commit();
    this.#sessions.delete(conversationId);
    return state;
  }

  abort(conversationId: string): WorldState {
    const session = this.#session(conversationId);
    const state = session.transaction.discard();
    this.#sessions.delete(conversationId);
    return state;
  }

  abortAll(): void {
    for (const session of this.#sessions.values()) session.transaction.discard();
    this.#sessions.clear();
  }

  #recordFallback(
    conversationId: string,
    session: ActiveConversation,
    dialogue: string,
    source: 'authored-fallback' | 'policy-refusal',
  ): ConversationTurnResult {
    const turn = fallbackTurn(dialogue);
    session.recentTurns.push({ speaker: 'npc', text: turn.dialogue });
    return {
      conversationId, dialogue: turn.dialogue, emotion: turn.emotion, intent: turn.intent,
      source, stagedChangeCount: 0,
    };
  }

  #session(conversationId: string): ActiveConversation {
    StableIdSchema.parse(conversationId);
    const session = this.#sessions.get(conversationId);
    if (!session) throw new Error('Conversation is not active.');
    return session;
  }
}
