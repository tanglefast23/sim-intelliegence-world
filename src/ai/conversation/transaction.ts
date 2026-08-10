import { reduceCommand } from '../../domain/commands/reducer';
import { DomainCommandSchema } from '../../domain/commands/types';
import type { KnowledgeRecordSchema } from '../../domain/state/models';
import { parseWorldState, type WorldState } from '../../domain/state/schema';
import type { z } from 'zod';
import type { ApprovedTurn } from '../validation/validate-turn';

type KnowledgeRecord = z.infer<typeof KnowledgeRecordSchema>;
type MemoryDraft = Readonly<{ subjectId: string; summary: string; importancePermille: number }>;

export type ConversationStagedState = Readonly<{
  knowledge: readonly KnowledgeRecord[];
  unlockedInterestIds: readonly string[];
  unlockedIds: readonly string[];
  memories: readonly MemoryDraft[];
}>;

function encodedIdPart(source: string): string {
  if (source.length === 0 || source.length > 64) throw new Error('Conversation ID length is invalid.');
  return [...new TextEncoder().encode(source)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function conversationPauseToken(conversationId: string): string {
  return `pause:conversation:${encodedIdPart(conversationId)}`;
}

export function conversationCommitEventId(conversationId: string, revision: number): string {
  if (!Number.isInteger(revision) || revision < 0) throw new Error('Conversation revision is invalid.');
  return `event-conversation-r${revision}-${encodedIdPart(conversationId)}`;
}

export class ConversationTransaction {
  readonly #baseState: WorldState;
  readonly #conversationId: string;
  readonly #npcId: string;
  readonly #pausedState: WorldState;
  readonly #knowledge: KnowledgeRecord[] = [];
  readonly #unlockedInterestIds = new Set<string>();
  readonly #unlockedIds = new Set<string>();
  readonly #memories: MemoryDraft[] = [];
  #closed = false;

  constructor(baseState: WorldState, conversationId: string, npcId: string) {
    this.#baseState = parseWorldState(baseState);
    if (this.#baseState.clock.pauseTokens.length > 0) {
      throw new Error('A conversation requires a stable world without another pause token.');
    }
    const npc = this.#baseState.npcs[npcId];
    if (!npc) throw new Error('Conversation NPC does not exist.');
    if (npc.tier !== 'full_ai') throw new Error('Conversation persistence requires a full-AI NPC.');
    this.#conversationId = conversationId;
    this.#npcId = npcId;
    const part = encodedIdPart(conversationId);
    this.#pausedState = reduceCommand(this.#baseState, DomainCommandSchema.parse({
      type: 'add-pause-token',
      commandId: `command-pause-${part}`,
      eventId: `event-pause-${part}`,
      scheduledMinute: this.#baseState.clock.absoluteMinute,
      priority: 100,
      token: conversationPauseToken(conversationId),
    })).state;
  }

  get pausedState(): WorldState {
    this.#assertOpen();
    return this.#pausedState;
  }

  get baseState(): WorldState {
    return this.#baseState;
  }

  staged(): ConversationStagedState {
    return Object.freeze({
      knowledge: [...this.#knowledge],
      unlockedInterestIds: [...this.#unlockedInterestIds].sort(),
      unlockedIds: [...this.#unlockedIds].sort(),
      memories: [...this.#memories],
    });
  }

  stage(turn: ApprovedTurn): void {
    this.#assertOpen();
    this.#knowledge.push(...turn.knowledge);
    turn.unlockedInterestIds.forEach((id) => this.#unlockedInterestIds.add(id));
    turn.unlockedIds.forEach((id) => this.#unlockedIds.add(id));
    this.#memories.push(...turn.memories);
  }

  commit(): WorldState {
    this.#assertOpen();
    const part = encodedIdPart(this.#conversationId);
    const result = reduceCommand(this.#baseState, DomainCommandSchema.parse({
      type: 'commit-conversation',
      commandId: `command-conversation-r${this.#baseState.revision}-${part}`,
      eventId: conversationCommitEventId(this.#conversationId, this.#baseState.revision),
      scheduledMinute: this.#baseState.clock.absoluteMinute,
      priority: 100,
      conversationId: this.#conversationId,
      npcId: this.#npcId,
      ...this.stagedUnsafe(),
    }));
    if (result.duplicate) throw new Error('Conversation commit event ID collided with an existing receipt.');
    this.#closed = true;
    return result.state;
  }

  discard(): WorldState {
    this.#assertOpen();
    this.#closed = true;
    return this.#baseState;
  }

  private stagedUnsafe(): ConversationStagedState {
    return {
      knowledge: [...this.#knowledge],
      unlockedInterestIds: [...this.#unlockedInterestIds].sort(),
      unlockedIds: [...this.#unlockedIds].sort(),
      memories: [...this.#memories],
    };
  }

  #assertOpen(): void {
    if (this.#closed) throw new Error('Conversation transaction is already closed.');
  }
}
