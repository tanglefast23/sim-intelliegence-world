import { advanceClock } from '../clock/clock';
import { addPauseToken, removePauseToken } from '../clock/pause';
import { applyFactionDelta } from '../economy/faction';
import type { DomainEvent } from '../events/types';
import { applyRelationshipDelta } from '../relationships/relationship';
import { parseWorldState, type WorldState } from '../state/schema';
import { DomainCommandSchema, type DomainCommand } from './types';

export type CommandResult = Readonly<{
  state: WorldState;
  event?: DomainEvent;
  duplicate: boolean;
}>;

function commitEvent(state: WorldState, event: DomainEvent, patch: Partial<WorldState>): CommandResult {
  const nextState = parseWorldState({
    ...state,
    ...patch,
    revision: state.revision + 1,
    eventReceipts: [...state.eventReceipts, event.eventId],
    eventLedger: [...state.eventLedger, event],
  });
  return { state: nextState, event, duplicate: false };
}

function eventBase(state: WorldState, command: DomainCommand, absoluteMinute: number) {
  return {
    eventId: command.eventId,
    commandId: command.commandId,
    sequence: state.eventLedger.length,
    absoluteMinute,
  } as const;
}

export function reduceCommand(state: WorldState, candidate: DomainCommand): CommandResult {
  const command = DomainCommandSchema.parse(candidate);
  if (state.eventReceipts.includes(command.eventId)) {
    return { state, duplicate: true };
  }

  switch (command.type) {
    case 'advance-clock': {
      const result = advanceClock(state.clock, command.realMilliseconds);
      const event: DomainEvent = {
        ...eventBase(state, command, result.clock.absoluteMinute),
        type: 'clock-advanced',
        fromMinute: state.clock.absoluteMinute,
        toMinute: result.clock.absoluteMinute,
        consumedRealMilliseconds: command.realMilliseconds,
      };
      return commitEvent(state, event, { clock: result.clock });
    }
    case 'add-pause-token': {
      const result = addPauseToken(state.clock, command.token);
      const event: DomainEvent = {
        ...eventBase(state, command, state.clock.absoluteMinute),
        type: 'pause-token-added',
        token: command.token,
        changed: result.changed,
      };
      return commitEvent(state, event, { clock: result.clock });
    }
    case 'remove-pause-token': {
      const result = removePauseToken(state.clock, command.token);
      const event: DomainEvent = {
        ...eventBase(state, command, state.clock.absoluteMinute),
        type: 'pause-token-removed',
        token: command.token,
        changed: result.changed,
      };
      return commitEvent(state, event, { clock: result.clock });
    }
    case 'apply-relationship-delta': {
      const relationship = state.relationships[command.npcId];
      if (!relationship) throw new Error(`Unknown relationship NPC: ${command.npcId}`);
      const result = applyRelationshipDelta(relationship.values, command.delta, command.source);
      const event: DomainEvent = {
        ...eventBase(state, command, state.clock.absoluteMinute),
        type: 'relationship-changed',
        npcId: command.npcId,
        familiarityDelta: result.appliedDelta.familiarity,
        trustDelta: result.appliedDelta.trust,
        attractionDelta: result.appliedDelta.attraction,
        reason: command.reason,
      };
      return commitEvent(state, event, {
        relationships: {
          ...state.relationships,
          [command.npcId]: { ...relationship, values: result.values },
        },
      });
    }
    case 'apply-faction-delta': {
      const faction = state.factions[command.factionId];
      if (!faction) throw new Error(`Unknown faction: ${command.factionId}`);
      const result = applyFactionDelta(faction.standing, command.delta, command.scale);
      const event: DomainEvent = {
        ...eventBase(state, command, state.clock.absoluteMinute),
        type: 'faction-standing-changed',
        factionId: command.factionId,
        delta: result.appliedDelta,
        reason: command.reason,
      };
      return commitEvent(state, event, {
        factions: {
          ...state.factions,
          [command.factionId]: { ...faction, standing: result.standing },
        },
      });
    }
  }
}
