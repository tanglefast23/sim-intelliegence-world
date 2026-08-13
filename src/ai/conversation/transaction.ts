import { reduceCommand } from '../../domain/commands/reducer';
import { DomainCommandSchema, type DomainCommand } from '../../domain/commands/types';
import type { DomainEvent } from '../../domain/events/types';
import type { KnowledgeRecordSchema } from '../../domain/state/models';
import { parseWorldState, type WorldState } from '../../domain/state/schema';
import type { StructuredConversationAction } from '../../application/effects/ConversationPort';
import { ENGINE_STAGE_FLOORS, nextRelationshipStage } from '../../domain/relationships/relationship';
import type { z } from 'zod';
import type { ApprovedTurn } from '../validation/validate-turn';

type KnowledgeRecord = z.infer<typeof KnowledgeRecordSchema>;
type MemoryDraft = Readonly<{ subjectId: string; summary: string; importancePermille: number }>;
type ConversationPersistenceDraft = Readonly<{
  knowledge: readonly KnowledgeRecord[];
  unlockedInterestIds: readonly string[];
  unlockedIds: readonly string[];
  memories: readonly MemoryDraft[];
}>;

export type ConversationStagedState = ConversationPersistenceDraft & Readonly<{
  socialChangeCount: number;
}>;

export function encodedIdPart(source: string): string {
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
  readonly #socialCommands: DomainCommand[] = [];
  #previewState: WorldState;
  #mutualInteractionStaged = false;
  #structuredActionStaged = false;
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
    this.#previewState = this.#baseState;
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

  get previewState(): WorldState {
    this.#assertOpen();
    return this.#previewState;
  }

  staged(): ConversationStagedState {
    return Object.freeze({
      knowledge: [...this.#knowledge],
      unlockedInterestIds: [...this.#unlockedInterestIds].sort(),
      unlockedIds: [...this.#unlockedIds].sort(),
      memories: [...this.#memories],
      socialChangeCount: this.#socialCommands.length,
    });
  }

  stage(turn: ApprovedTurn): void {
    this.#assertOpen();
    if (this.#structuredActionStaged) throw new Error('End the conversation after a structured social action.');
    this.#knowledge.push(...turn.knowledge);
    turn.unlockedInterestIds.forEach((id) => this.#unlockedInterestIds.add(id));
    turn.unlockedIds.forEach((id) => this.#unlockedIds.add(id));
    this.#memories.push(...turn.memories);
    this.#rebuildPreviewState();
  }

  stageMutualInteraction(options: Readonly<{ advanceRelationshipStage?: boolean }> = {}): boolean {
    this.#assertOpen();
    if (this.#mutualInteractionStaged) return false;
    const index = this.#socialCommands.length;
    const relationshipBefore = this.#previewState.relationships[this.#npcId];
    if (!relationshipBefore) throw new Error('Conversation relationship is missing.');
    this.#stageCommand(DomainCommandSchema.parse({
      type: 'apply-relationship-delta',
      ...this.#socialEventIdentity(index),
      scheduledMinute: this.#baseState.clock.absoluteMinute,
      priority: 100 - index,
      npcId: this.#npcId,
      delta: {
        familiarity: 1,
        trust: 1,
        attraction: relationshipBefore.compatibility.romantic ? 1 : 0,
      },
      source: 'conversation',
      reason: 'Validated mutual conversation',
    }));
    const relationship = this.#previewState.relationships[this.#npcId];
    const nextStage = relationship ? nextRelationshipStage(relationship.stage) : undefined;
    if (options.advanceRelationshipStage !== false && relationship && (nextStage === 'acquaintance' || nextStage === 'friend')) {
      const floor = ENGINE_STAGE_FLOORS[nextStage];
      if (
        relationship.values.familiarity >= floor.familiarity &&
        relationship.values.trust >= floor.trust &&
        relationship.values.attraction >= floor.attraction
      ) {
        const stageIndex = this.#socialCommands.length;
        this.#stageCommand(DomainCommandSchema.parse({
          type: 'request-relationship-stage',
          ...this.#socialEventIdentity(stageIndex),
          scheduledMinute: this.#baseState.clock.absoluteMinute,
          priority: 100 - stageIndex,
          npcId: this.#npcId,
          targetStage: nextStage,
          actionId: nextStage === 'acquaintance' ? 'greet' : 'ask_follow_up',
          authoredEvent: false,
        }));
      }
    }
    this.#mutualInteractionStaged = true;
    return true;
  }

  stageStructuredAction(action: StructuredConversationAction): DomainEvent {
    this.#assertOpen();
    if (this.#structuredActionStaged) throw new Error('Only one structured social action is allowed per conversation.');
    const index = this.#socialCommands.length;
    const identity = this.#socialEventIdentity(index);
    const command = action.kind === 'home_invitation'
      ? DomainCommandSchema.parse({
        type: 'respond-home-invitation',
        ...identity,
        scheduledMinute: this.#baseState.clock.absoluteMinute,
        priority: 100 - index,
        request: {
          invitationId: `invitation_${encodedIdPart(this.#conversationId)}_${index}`,
          npcId: this.#npcId,
          sourceConversationId: this.#conversationId,
          proposedMinute: action.proposedMinute,
          durationMinutes: 120,
        },
      })
      : DomainCommandSchema.parse({
        type: 'request-relationship-stage',
        ...identity,
        scheduledMinute: this.#baseState.clock.absoluteMinute,
        priority: 100 - index,
        npcId: this.#npcId,
        targetStage: action.targetStage,
        actionId: action.actionId,
        authoredEvent: false,
      });
    const event = this.#stageCommand(command);
    this.#structuredActionStaged = true;
    return event;
  }

  stageVerbalMissionCommands(commands: readonly DomainCommand[]): readonly DomainEvent[] {
    this.#assertOpen();
    const parsed = commands.map((command) => DomainCommandSchema.parse(command));
    if (parsed.some(({ type }) => type !== 'apply-verbal-mission-outcome' && type !== 'record-player-knowledge')) {
      throw new Error('Conversation transaction rejected a non-mission staged command.');
    }
    let preview = this.#previewState;
    const events = parsed.map((command) => {
      const result = reduceCommand(preview, command);
      if (result.duplicate || !result.event) throw new Error('Conversation mission action was not staged uniquely.');
      preview = result.state;
      return result.event;
    });
    this.#previewState = preview;
    this.#socialCommands.push(...parsed);
    return events;
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
    let committedState = result.state;
    for (const command of this.#socialCommands) {
      const socialResult = reduceCommand(committedState, command);
      if (socialResult.duplicate) throw new Error('Conversation social event ID collided with an existing receipt.');
      committedState = socialResult.state;
    }
    this.#closed = true;
    return committedState;
  }

  discard(): WorldState {
    this.#assertOpen();
    this.#closed = true;
    return this.#baseState;
  }

  private stagedUnsafe(): ConversationPersistenceDraft {
    return {
      knowledge: [...this.#knowledge],
      unlockedInterestIds: [...this.#unlockedInterestIds].sort(),
      unlockedIds: [...this.#unlockedIds].sort(),
      memories: [...this.#memories],
    };
  }

  #socialEventIdentity(index: number): Readonly<{ commandId: string; eventId: string }> {
    const part = encodedIdPart(this.#conversationId);
    return {
      commandId: `command-conversation-social-r${this.#baseState.revision}-${part}-${index}`,
      eventId: `event-conversation-social-r${this.#baseState.revision}-${part}-${index}`,
    };
  }

  #stageCommand(command: DomainCommand): DomainEvent {
    const result = reduceCommand(this.#previewState, command);
    if (result.duplicate || !result.event) throw new Error('Conversation social action was not staged uniquely.');
    this.#previewState = result.state;
    this.#socialCommands.push(command);
    return result.event;
  }

  #rebuildPreviewState(): void {
    const part = encodedIdPart(this.#conversationId);
    let preview = reduceCommand(this.#baseState, DomainCommandSchema.parse({
      type: 'commit-conversation',
      commandId: `command-conversation-r${this.#baseState.revision}-${part}`,
      eventId: conversationCommitEventId(this.#conversationId, this.#baseState.revision),
      scheduledMinute: this.#baseState.clock.absoluteMinute,
      priority: 100,
      conversationId: this.#conversationId,
      npcId: this.#npcId,
      ...this.stagedUnsafe(),
    })).state;
    for (const command of this.#socialCommands) preview = reduceCommand(preview, command).state;
    this.#previewState = preview;
  }

  #assertOpen(): void {
    if (this.#closed) throw new Error('Conversation transaction is already closed.');
  }
}
