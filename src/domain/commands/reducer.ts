import { advanceClock } from '../clock/clock';
import { addPauseToken, removePauseToken } from '../clock/pause';
import { sleepEnergyRestore, sleepTargetMinute } from '../clock/sleep';
import { applyFactionDelta } from '../economy/faction';
import { PROTOTYPE_ECONOMY_POLICY, validateQuestReward } from '../economy/economy';
import type { DomainEvent } from '../events/types';
import { applyRelationshipDelta } from '../relationships/relationship';
import { parseWorldState, type WorldState } from '../state/schema';
import { DomainCommandSchema, type DomainCommand } from './types';
import { simulateWorldInterval } from '../../world/schedules/simulation';

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
    case 'move-protagonist': {
      const from = state.protagonist.worldPosition;
      if (
        command.mapId !== from.mapId ||
        Math.abs(command.tileX - from.tileX) + Math.abs(command.tileY - from.tileY) !== 1
      ) {
        throw new Error('Local protagonist movement must be one cardinal tile on the current map.');
      }
      const event: DomainEvent = {
        ...eventBase(state, command, state.clock.absoluteMinute),
        type: 'protagonist-moved',
        mapId: command.mapId,
        locationId: command.locationId,
        fromTileX: from.tileX,
        fromTileY: from.tileY,
        toTileX: command.tileX,
        toTileY: command.tileY,
      };
      return commitEvent(state, event, {
        protagonist: {
          ...state.protagonist,
          locationId: command.locationId,
          worldPosition: { mapId: command.mapId, tileX: command.tileX, tileY: command.tileY },
        },
      });
    }
    case 'set-simulation-speed': {
      const event: DomainEvent = {
        ...eventBase(state, command, state.clock.absoluteMinute),
        type: 'simulation-speed-changed',
        fromSpeed: state.clock.selectedSpeed,
        toSpeed: command.speed,
      };
      return commitEvent(state, event, { clock: { ...state.clock, selectedSpeed: command.speed } });
    }
    case 'advance-simulation': {
      const advanced = advanceClock(state.clock, command.realMilliseconds);
      const simulation = simulateWorldInterval({
        state,
        toAbsoluteMinute: advanced.clock.absoluteMinute,
        toSubMinuteMilliseconds: advanced.clock.subMinuteMilliseconds,
        awake: true,
        frameMovement: advanced.advancedMinutes <= 2,
      });
      const event: DomainEvent = {
        ...eventBase(state, command, simulation.state.clock.absoluteMinute),
        type: 'simulation-advanced',
        fromMinute: state.clock.absoluteMinute,
        toMinute: simulation.state.clock.absoluteMinute,
        consumedRealMilliseconds: command.realMilliseconds,
        milestoneIds: [...simulation.milestoneIds],
        energyDelta: simulation.energyDelta,
        moneyDelta: simulation.moneyDelta,
      };
      return commitEvent(state, event, simulation.state);
    }
    case 'sleep-protagonist': {
      if (state.clock.pauseTokens.length > 0) throw new Error('Sleep requires a stable unpaused world.');
      const toMinute = sleepTargetMinute(state.clock.absoluteMinute, command.mode);
      const simulation = simulateWorldInterval({
        state,
        toAbsoluteMinute: toMinute,
        toSubMinuteMilliseconds: 0,
        awake: false,
        frameMovement: false,
      });
      const restore = sleepEnergyRestore(command.mode);
      const nextEnergy = Math.min(100, simulation.state.protagonist.energy + restore);
      const energyDelta = nextEnergy - state.protagonist.energy;
      const event: DomainEvent = {
        ...eventBase(state, command, toMinute),
        type: 'sleep-completed',
        mode: command.mode,
        fromMinute: state.clock.absoluteMinute,
        toMinute,
        energyDelta,
        milestoneIds: [...simulation.milestoneIds],
      };
      return commitEvent(state, event, {
        ...simulation.state,
        protagonist: { ...simulation.state.protagonist, energy: nextEnergy },
      });
    }
    case 'apply-quest-reward': {
      const amount = validateQuestReward(command.rewardKind, command.amount);
      const money = state.inventory.money + amount;
      if (!Number.isSafeInteger(money)) throw new RangeError('Quest reward exceeds the safe money range.');
      const event: DomainEvent = {
        ...eventBase(state, command, state.clock.absoluteMinute),
        type: 'quest-reward-applied',
        rewardKind: command.rewardKind,
        amount,
        questId: command.questId,
      };
      return commitEvent(state, event, { inventory: { ...state.inventory, money } });
    }
    case 'move-npc': {
      const npc = state.npcs[command.npcId];
      if (!npc || npc.presence.kind !== 'active_local' || npc.presence.mapId !== command.mapId) {
        throw new Error('Only an active local NPC can move on its owned map.');
      }
      if (Math.abs(command.tileX - npc.presence.tileX) + Math.abs(command.tileY - npc.presence.tileY) !== 1) {
        throw new Error('Local NPC movement must be one cardinal tile.');
      }
      const event: DomainEvent = {
        ...eventBase(state, command, state.clock.absoluteMinute),
        type: 'npc-moved',
        npcId: npc.id,
        mapId: command.mapId,
        fromTileX: npc.presence.tileX,
        fromTileY: npc.presence.tileY,
        toTileX: command.tileX,
        toTileY: command.tileY,
      };
      return commitEvent(state, event, {
        npcs: {
          ...state.npcs,
          [npc.id]: { ...npc, presence: { ...npc.presence, tileX: command.tileX, tileY: command.tileY } },
        },
      });
    }
    case 'complete-npc-goal': {
      const npc = state.npcs[command.npcId];
      const goal = npc?.scheduleGoal;
      if (
        !npc || !goal || npc.presence.kind !== 'active_local' ||
        npc.presence.mapId !== goal.mapId || npc.presence.tileX !== goal.tileX || npc.presence.tileY !== goal.tileY
      ) {
        throw new Error('NPC goal completion requires the NPC at the exact goal tile.');
      }
      const event: DomainEvent = {
        ...eventBase(state, command, state.clock.absoluteMinute),
        type: 'npc-goal-completed',
        npcId: npc.id,
        activityId: goal.activityId,
        locationId: goal.locationId,
      };
      const nextNpc = { ...npc, presence: { ...npc.presence, locationId: goal.locationId } };
      delete nextNpc.scheduleGoal;
      const transfers = Object.fromEntries(Object.entries(state.transfers).filter(([, transfer]) => (
        transfer.npcId !== npc.id || transfer.status !== 'approaching_exit'
      )));
      return commitEvent(state, event, { npcs: { ...state.npcs, [npc.id]: nextNpc }, transfers });
    }
    case 'depart-npc-transfer': {
      const npc = state.npcs[command.npcId];
      const transfer = state.transfers[command.transferId];
      if (
        !npc || !transfer || transfer.npcId !== npc.id || transfer.status !== 'approaching_exit' ||
        npc.presence.kind !== 'active_local' || !npc.scheduleGoal ||
        npc.presence.tileX !== npc.scheduleGoal.tileX || npc.presence.tileY !== npc.scheduleGoal.tileY
      ) {
        throw new Error('NPC transfer departure requires its approaching NPC at the exit.');
      }
      const departureMinute = state.clock.absoluteMinute;
      const arrivalMinute = departureMinute + PROTOTYPE_ECONOMY_POLICY.npcTravelMinutes;
      const event: DomainEvent = {
        ...eventBase(state, command, departureMinute),
        type: 'npc-transfer-departed',
        npcId: npc.id,
        transferId: transfer.id,
        originMapId: transfer.originMapId,
        destinationMapId: transfer.destinationMapId,
        arrivalMinute,
      };
      return commitEvent(state, event, {
        npcs: { ...state.npcs, [npc.id]: { ...npc, presence: { kind: 'in_transit', transferId: transfer.id } } },
        transfers: {
          ...state.transfers,
          [transfer.id]: { ...transfer, status: 'in_transit', departureMinute, arrivalMinute },
        },
      });
    }
    case 'transition-protagonist': {
      const position = state.protagonist.worldPosition;
      if (
        position.mapId !== command.originMapId ||
        !state.maps[command.destinationMapId] ||
        !state.maps[command.originMapId]?.active
      ) {
        throw new Error('Protagonist transition does not match the active source map.');
      }
      const npcs = structuredClone(state.npcs);
      const transfers = structuredClone(state.transfers);
      for (const transfer of Object.values(transfers)) {
        if (transfer.status === 'approaching_exit' && transfer.originMapId === command.originMapId) {
          const npc = npcs[transfer.npcId];
          if (!npc) throw new Error(`Transition lost approaching NPC ${transfer.npcId}.`);
          transfer.status = 'in_transit';
          transfer.departureMinute = state.clock.absoluteMinute;
          transfer.arrivalMinute = state.clock.absoluteMinute + PROTOTYPE_ECONOMY_POLICY.npcTravelMinutes;
          npc.presence = { kind: 'in_transit', transferId: transfer.id };
        }
      }
      for (const npc of Object.values(npcs)) {
        if (npc.presence.kind === 'active_local' && npc.presence.mapId === command.originMapId) {
          npc.presence = { ...npc.presence, kind: 'inactive' };
        } else if (npc.presence.kind === 'inactive' && npc.presence.mapId === command.destinationMapId) {
          npc.presence = { ...npc.presence, kind: 'active_local' };
        }
      }
      const maps = Object.fromEntries(Object.entries(state.maps).map(([id, map]) => [id, {
        ...map,
        active: id === command.destinationMapId,
        discoveredEntranceIds: id === command.destinationMapId
          ? [...new Set([...map.discoveredEntranceIds, command.destinationEntranceId])]
          : map.discoveredEntranceIds,
      }]));
      const event: DomainEvent = {
        ...eventBase(state, command, state.clock.absoluteMinute),
        type: 'protagonist-transitioned',
        originMapId: command.originMapId,
        destinationMapId: command.destinationMapId,
        sourcePortalId: command.sourcePortalId,
        destinationEntranceId: command.destinationEntranceId,
        tileX: command.tileX,
        tileY: command.tileY,
      };
      return commitEvent(state, event, {
        protagonist: {
          ...state.protagonist,
          locationId: command.destinationMapId,
          worldPosition: { mapId: command.destinationMapId, tileX: command.tileX, tileY: command.tileY },
        },
        maps,
        npcs,
        transfers,
      });
    }
  }
}
