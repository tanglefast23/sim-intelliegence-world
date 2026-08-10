import { PROTOTYPE_ECONOMY_POLICY } from '../../domain/economy/economy';
import {
  completeInvitationForTransfer,
  completeLocalInvitation,
  prepareInvitationAfterTransferArrival,
  replanInvitation,
  replanInvitationForTransfer,
} from '../../domain/invitations/planner';
import type { WorldState } from '../../domain/state/schema';
import { WorldStateSchema } from '../../domain/state/schema';
import { routeBetween } from '../transfers/routes';
import { scheduleMilestonesBetween, type ScheduleMilestone } from './schedule';

type Milestone = Readonly<{
  id: string;
  minute: number;
  priority: number;
  kind: 'energy' | 'basic-cost' | 'allowance' | 'schedule' | 'invitation-departure' | 'invitation-start' | 'transfer-departure' | 'transfer-arrival';
  schedule?: ScheduleMilestone;
  transferId?: string;
  invitationId?: string;
}>;

export type SimulationIntervalResult = Readonly<{
  state: WorldState;
  milestoneIds: readonly string[];
  energyDelta: number;
  moneyDelta: number;
}>;

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareMilestone(left: Milestone, right: Milestone): number {
  return left.minute - right.minute || left.priority - right.priority || compareAscii(left.id, right.id);
}

function nextPeriodBoundary(fromMinute: number, period: number): number {
  return (Math.floor(fromMinute / period) + 1) * period;
}

function addPeriodic(
  output: Milestone[],
  fromMinute: number,
  toMinute: number,
  firstMinute: number,
  period: number,
  make: (minute: number) => Milestone,
): void {
  for (let minute = Math.max(firstMinute, nextPeriodBoundary(fromMinute, period)); minute <= toMinute; minute += period) {
    output.push(make(minute));
  }
}

function activeMapId(state: WorldState): string {
  const active = Object.values(state.maps).find(({ active }) => active);
  if (!active) throw new Error('Simulation requires one active map.');
  return active.id;
}

function invitationOwnsNpcActivity(
  invitations: WorldState['invitations'],
  transfers: WorldState['transfers'],
  npc: WorldState['npcs'][string],
  minute: number,
): boolean {
  return Object.values(invitations).some((invitation) => (
    invitation.npcId === npc.id && invitation.status === 'accepted' && (
      npc.scheduleGoal?.sourceInvitationId === invitation.id ||
      (invitation.transferId !== undefined && transfers[invitation.transferId]?.npcId === npc.id) ||
      (
        invitation.scheduledMinute !== undefined &&
        minute + PROTOTYPE_ECONOMY_POLICY.npcTravelMinutes >
          Math.max(0, invitation.scheduledMinute - PROTOTYPE_ECONOMY_POLICY.npcTravelMinutes) &&
        minute < invitation.scheduledMinute + invitation.durationMinutes
      )
    )
  ));
}

export function simulateWorldInterval(input: Readonly<{
  state: WorldState;
  toAbsoluteMinute: number;
  toSubMinuteMilliseconds: number;
  awake: boolean;
  frameMovement: boolean;
}>): SimulationIntervalResult {
  const source = WorldStateSchema.parse(input.state);
  const fromMinute = source.clock.absoluteMinute;
  if (!Number.isSafeInteger(input.toAbsoluteMinute) || input.toAbsoluteMinute < fromMinute) {
    throw new RangeError('Simulation target minute must be a safe minute at or after the current clock.');
  }
  const queue: Milestone[] = [];
  if (input.awake) {
    addPeriodic(
      queue,
      fromMinute,
      input.toAbsoluteMinute,
      PROTOTYPE_ECONOMY_POLICY.energyDrainMinutesPerPoint,
      PROTOTYPE_ECONOMY_POLICY.energyDrainMinutesPerPoint,
      (minute) => ({ id: `energy-protagonist-${minute}`, minute, priority: 10, kind: 'energy' }),
    );
  }
  for (
    let minute = source.economy.nextBasicCostMinute;
    minute <= input.toAbsoluteMinute;
    minute += 1_440
  ) {
    if (minute > fromMinute) queue.push({ id: `economy-basic-cost-${minute}`, minute, priority: 20, kind: 'basic-cost' });
  }
  for (
    let minute = source.economy.nextAllowanceMinute;
    minute <= input.toAbsoluteMinute;
    minute += 7 * 1_440
  ) {
    if (minute > fromMinute) queue.push({ id: `economy-allowance-${minute}`, minute, priority: 30, kind: 'allowance' });
  }
  queue.push(...scheduleMilestonesBetween(source.schedules, fromMinute, input.toAbsoluteMinute).map((schedule) => ({
    id: schedule.id,
    minute: schedule.minute,
    priority: 40,
    kind: 'schedule' as const,
    schedule,
  })));

  let npcs = structuredClone(source.npcs);
  let transfers = structuredClone(source.transfers);
  let invitations = structuredClone(source.invitations);
  let money = source.inventory.money;
  let energy = source.protagonist.energy;
  let nextBasicCostMinute = source.economy.nextBasicCostMinute;
  let nextAllowanceMinute = source.economy.nextAllowanceMinute;
  const activeMap = activeMapId(source);
  const milestoneIds: string[] = [];

  for (const invitation of Object.values(invitations)) {
    if (invitation.status !== 'accepted' || invitation.scheduledMinute === undefined || invitation.transferId) continue;
    if (invitation.preparedAtMinute !== undefined) {
      if (invitation.scheduledMinute <= input.toAbsoluteMinute) {
        queue.push({
          id: `invitation-start-${invitation.id}-${invitation.scheduledMinute}`,
          minute: Math.max(fromMinute, invitation.scheduledMinute),
          priority: 36,
          kind: 'invitation-start',
          invitationId: invitation.id,
        });
      }
      continue;
    }
    const departureMinute = Math.max(0, invitation.scheduledMinute - PROTOTYPE_ECONOMY_POLICY.npcTravelMinutes);
    if (departureMinute <= input.toAbsoluteMinute) {
      queue.push({
        id: `invitation-departure-${invitation.id}-${departureMinute}`,
        minute: Math.max(fromMinute, departureMinute),
        priority: 36,
        kind: 'invitation-departure',
        invitationId: invitation.id,
      });
    }
  }

  for (const transfer of Object.values(transfers)) {
    if (
      transfer.departureMinute <= input.toAbsoluteMinute &&
      !input.frameMovement && transfer.status === 'approaching_exit'
    ) {
      queue.push({
        id: `transfer-departure-${transfer.id}`,
        minute: Math.max(fromMinute, transfer.departureMinute),
        priority: 35,
        kind: 'transfer-departure',
        transferId: transfer.id,
      });
    }
    if (transfer.status === 'in_transit' && transfer.arrivalMinute > fromMinute && transfer.arrivalMinute <= input.toAbsoluteMinute) {
      queue.push({
        id: `transfer-arrival-${transfer.id}`,
        minute: transfer.arrivalMinute,
        priority: 35,
        kind: 'transfer-arrival',
        transferId: transfer.id,
      });
    }
  }

  while (queue.length > 0) {
    queue.sort(compareMilestone);
    const milestone = queue.shift()!;
    milestoneIds.push(milestone.id);
    switch (milestone.kind) {
      case 'energy':
        energy = Math.max(0, energy - 1);
        break;
      case 'basic-cost':
        money = Math.max(0, money - source.economy.basicDailyCost);
        nextBasicCostMinute = milestone.minute + 1_440;
        break;
      case 'allowance':
        if (!Number.isSafeInteger(money + source.economy.weeklyAllowance)) throw new RangeError('Allowance exceeds safe money range.');
        money += source.economy.weeklyAllowance;
        nextAllowanceMinute = milestone.minute + 7 * 1_440;
        break;
      case 'schedule': {
        const schedule = milestone.schedule!;
        const npc = npcs[schedule.npcId];
        if (!npc) throw new Error(`Schedule ${schedule.scheduleId} lost NPC ${schedule.npcId}.`);
        if (invitationOwnsNpcActivity(invitations, transfers, npc, milestone.minute)) break;
        if (npc.presence.kind === 'in_transit') {
          throw new Error(`Schedule ${schedule.id} overlaps transfer ${npc.presence.transferId}.`);
        }
        if (npc.scheduleGoal?.sourceInvitationId) {
          invitations = replanInvitation(
            invitations,
            npc.scheduleGoal.sourceInvitationId,
            'schedule_superseded_visit',
            'A later schedule change replaced the local visit. Choose another time.',
          );
        }
        const supersededTransfer = Object.values(transfers).find((transfer) => transfer.npcId === npc.id);
        if (supersededTransfer) {
          if (supersededTransfer.status === 'in_transit') {
            throw new Error(`Schedule ${schedule.id} cannot supersede active transit ${supersededTransfer.id}.`);
          }
          invitations = replanInvitationForTransfer(
            invitations,
            supersededTransfer.id,
            'schedule_superseded_travel',
            'A later schedule change replaced the travel plan. Choose another time.',
          );
          delete transfers[supersededTransfer.id];
        }
        const goal = {
          mapId: schedule.block.mapId,
          locationId: schedule.block.locationId,
          activityId: schedule.block.activityId,
          tileX: schedule.block.tileX,
          tileY: schedule.block.tileY,
          scheduledMinute: milestone.minute,
        };
        if (npc.presence.mapId === goal.mapId) {
          if (goal.mapId === activeMap && input.frameMovement) {
            npc.presence = { ...npc.presence, kind: 'active_local' };
            npc.scheduleGoal = goal;
          } else {
            npc.presence = {
              kind: 'inactive', mapId: goal.mapId, locationId: goal.locationId, tileX: goal.tileX, tileY: goal.tileY,
            };
            delete npc.scheduleGoal;
          }
          break;
        }
        const route = routeBetween(npc.presence.mapId, goal.mapId);
        const transferId = `transfer-${npc.id}-${milestone.minute}-${goal.mapId}`;
        const approaching = npc.presence.kind === 'active_local' && npc.presence.mapId === activeMap && input.frameMovement;
        transfers[transferId] = {
          id: transferId,
          status: approaching ? 'approaching_exit' : 'in_transit',
          npcId: npc.id,
          originMapId: route.originMapId,
          destinationMapId: route.destinationMapId,
          edgePortalId: route.sourcePortalId,
          departureMinute: milestone.minute,
          arrivalMinute: milestone.minute + PROTOTYPE_ECONOMY_POLICY.npcTravelMinutes,
          destinationEntranceId: route.destinationEntranceId,
          destinationEntranceTileX: route.destinationEntranceTile.x,
          destinationEntranceTileY: route.destinationEntranceTile.y,
          destinationLocationId: goal.locationId,
          destinationActivityId: goal.activityId,
          destinationGoalTileX: goal.tileX,
          destinationGoalTileY: goal.tileY,
        };
        if (approaching) {
          npc.scheduleGoal = {
            mapId: route.originMapId,
            locationId: npc.presence.locationId,
            activityId: 'travel',
            tileX: route.sourcePortalTile.x,
            tileY: route.sourcePortalTile.y,
            scheduledMinute: milestone.minute,
          };
        } else {
          npc.presence = { kind: 'in_transit', transferId };
          npc.scheduleGoal = goal;
          const arrivalMinute = milestone.minute + PROTOTYPE_ECONOMY_POLICY.npcTravelMinutes;
          if (arrivalMinute <= input.toAbsoluteMinute) {
            queue.push({
              id: `transfer-arrival-${transferId}`,
              minute: arrivalMinute,
              priority: 35,
              kind: 'transfer-arrival',
              transferId,
            });
          }
        }
        break;
      }
      case 'invitation-departure': {
        const invitation = invitations[milestone.invitationId!];
        if (!invitation || invitation.status !== 'accepted' || invitation.transferId || invitation.scheduledMinute === undefined) break;
        const npc = npcs[invitation.npcId];
        if (!npc) throw new Error(`Invitation ${invitation.id} lost NPC ${invitation.npcId}.`);
        if (npc.presence.kind === 'in_transit') {
          invitations = replanInvitation(
            invitations,
            invitation.id,
            'departure_in_transit',
            'The visitor is already travelling. Choose another time after arrival.',
          );
          break;
        }
        if (npc.presence.mapId === invitation.destinationMapId) {
          invitations[invitation.id] = {
            ...invitation,
            preparedAtMinute: milestone.minute,
          };
          if (invitation.scheduledMinute <= input.toAbsoluteMinute) {
            queue.push({
              id: `invitation-start-${invitation.id}-${invitation.scheduledMinute}`,
              minute: Math.max(milestone.minute, invitation.scheduledMinute),
              priority: 36,
              kind: 'invitation-start',
              invitationId: invitation.id,
            });
          }
          break;
        }
        if (milestone.minute >= invitation.scheduledMinute) {
          invitations = replanInvitation(
            invitations,
            invitation.id,
            'departure_window_missed',
            'There is no longer enough time for the visitor to travel. Choose another time.',
          );
          break;
        }
        let route;
        try {
          route = routeBetween(npc.presence.mapId, invitation.destinationMapId);
        } catch {
          invitations = replanInvitation(
            invitations,
            invitation.id,
            'multi_route_required',
            'The visitor needs another route plan. Choose another time.',
          );
          break;
        }
        const supersededTransfer = Object.values(transfers).find((transfer) => transfer.npcId === npc.id);
        if (supersededTransfer) {
          invitations = replanInvitationForTransfer(
            invitations,
            supersededTransfer.id,
            'invitation_superseded_travel',
            'A home visit replaced the earlier travel plan.',
          );
          delete transfers[supersededTransfer.id];
        }
        const transferId = `transfer-invitation-${invitation.id}`;
        const approaching = npc.presence.kind === 'active_local' && npc.presence.mapId === activeMap && input.frameMovement;
        transfers[transferId] = {
          id: transferId,
          status: approaching ? 'approaching_exit' : 'in_transit',
          npcId: npc.id,
          originMapId: route.originMapId,
          destinationMapId: route.destinationMapId,
          edgePortalId: route.sourcePortalId,
          departureMinute: milestone.minute,
          arrivalMinute: invitation.scheduledMinute,
          destinationEntranceId: route.destinationEntranceId,
          destinationEntranceTileX: route.destinationEntranceTile.x,
          destinationEntranceTileY: route.destinationEntranceTile.y,
          destinationLocationId: invitation.destinationLocationId,
          destinationActivityId: 'home_visit',
          destinationGoalTileX: 18,
          destinationGoalTileY: 18,
        };
        invitations[invitation.id] = { ...invitation, transferId };
        if (approaching) {
          npc.scheduleGoal = {
            mapId: route.originMapId,
            locationId: npc.presence.locationId,
            activityId: 'travel',
            tileX: route.sourcePortalTile.x,
            tileY: route.sourcePortalTile.y,
            scheduledMinute: milestone.minute,
            sourceInvitationId: invitation.id,
          };
        } else {
          npc.presence = { kind: 'in_transit', transferId };
          if (invitation.scheduledMinute <= input.toAbsoluteMinute) {
            queue.push({
              id: `transfer-arrival-${transferId}`,
              minute: invitation.scheduledMinute,
              priority: 35,
              kind: 'transfer-arrival',
              transferId,
            });
          }
        }
        break;
      }
      case 'invitation-start': {
        const invitation = invitations[milestone.invitationId!];
        if (
          !invitation || invitation.status !== 'accepted' || invitation.transferId ||
          invitation.preparedAtMinute === undefined
        ) break;
        const npc = npcs[invitation.npcId];
        if (!npc || npc.presence.kind === 'in_transit' || npc.presence.mapId !== invitation.destinationMapId) {
          invitations = replanInvitation(
            invitations,
            invitation.id,
            'visit_location_changed',
            'The visitor could not reach the villa at the agreed time. Choose another time.',
          );
          break;
        }
        if (input.frameMovement && npc.presence.kind === 'active_local' && npc.presence.mapId === activeMap) {
          npc.scheduleGoal = {
            mapId: invitation.destinationMapId,
            locationId: invitation.destinationLocationId,
            activityId: 'home_visit',
            tileX: 18,
            tileY: 18,
            scheduledMinute: invitation.scheduledMinute!,
            sourceInvitationId: invitation.id,
          };
        } else {
          npc.presence = {
            kind: 'inactive',
            mapId: invitation.destinationMapId,
            locationId: invitation.destinationLocationId,
            tileX: 18,
            tileY: 18,
          };
          delete npc.scheduleGoal;
          invitations = completeLocalInvitation(invitations, invitation.id);
        }
        break;
      }
      case 'transfer-departure': {
        const transfer = transfers[milestone.transferId!];
        if (!transfer || transfer.status !== 'approaching_exit') break;
        const npc = npcs[transfer.npcId];
        if (!npc) throw new Error(`Transfer ${transfer.id} lost NPC ${transfer.npcId}.`);
        if (npc.presence.kind === 'in_transit' || npc.presence.mapId !== transfer.originMapId) {
          invitations = replanInvitationForTransfer(
            invitations,
            transfer.id,
            'departure_location_changed',
            'The visitor was not at the reserved departure location. Choose another time.',
          );
          delete transfers[transfer.id];
          break;
        }
        if (input.frameMovement && npc.presence.kind === 'active_local' && npc.presence.mapId === activeMap) {
          const route = routeBetween(transfer.originMapId, transfer.destinationMapId);
          npc.scheduleGoal = {
            mapId: transfer.originMapId,
            locationId: npc.presence.locationId,
            activityId: 'travel',
            tileX: route.sourcePortalTile.x,
            tileY: route.sourcePortalTile.y,
            scheduledMinute: transfer.departureMinute,
          };
          break;
        }
        transfer.status = 'in_transit';
        npc.presence = { kind: 'in_transit', transferId: transfer.id };
        if (transfer.arrivalMinute <= input.toAbsoluteMinute) {
          queue.push({
            id: `transfer-arrival-${transfer.id}`,
            minute: transfer.arrivalMinute,
            priority: 35,
            kind: 'transfer-arrival',
            transferId: transfer.id,
          });
        }
        break;
      }
      case 'transfer-arrival': {
        const transfer = transfers[milestone.transferId!];
        if (!transfer || transfer.status !== 'in_transit') break;
        const npc = npcs[transfer.npcId];
        if (!npc || npc.presence.kind !== 'in_transit' || npc.presence.transferId !== transfer.id) {
          throw new Error(`Transfer ${transfer.id} does not own its NPC at arrival.`);
        }
        const invitation = Object.values(invitations).find((candidate) => candidate.transferId === transfer.id);
        if (transfer.destinationMapId === activeMap && input.frameMovement) {
          npc.presence = {
            kind: 'active_local',
            mapId: transfer.destinationMapId,
            locationId: transfer.destinationMapId,
            tileX: transfer.destinationEntranceTileX,
            tileY: transfer.destinationEntranceTileY,
          };
          npc.scheduleGoal = {
            mapId: transfer.destinationMapId,
            locationId: transfer.destinationLocationId,
            activityId: transfer.destinationActivityId,
            tileX: transfer.destinationGoalTileX,
            tileY: transfer.destinationGoalTileY,
            scheduledMinute: transfer.departureMinute,
            ...(invitation ? { sourceInvitationId: invitation.id } : {}),
          };
          if (invitation) invitations = prepareInvitationAfterTransferArrival(invitations, transfer.id, milestone.minute);
        } else {
          npc.presence = {
            kind: 'inactive',
            mapId: transfer.destinationMapId,
            locationId: transfer.destinationLocationId,
            tileX: transfer.destinationGoalTileX,
            tileY: transfer.destinationGoalTileY,
          };
          delete npc.scheduleGoal;
        }
        if (invitation && !(transfer.destinationMapId === activeMap && input.frameMovement)) {
          invitations = completeInvitationForTransfer(invitations, transfer.id);
        }
        delete transfers[transfer.id];
        break;
      }
    }
  }

  if (!input.frameMovement) {
    for (const npc of Object.values(npcs)) {
      if (npc.presence.kind === 'inactive' && npc.presence.mapId === activeMap) {
        npc.presence = { ...npc.presence, kind: 'active_local' };
      }
    }
  }

  const state = WorldStateSchema.parse({
    ...source,
    clock: {
      ...source.clock,
      absoluteMinute: input.toAbsoluteMinute,
      subMinuteMilliseconds: input.toSubMinuteMilliseconds,
    },
    protagonist: { ...source.protagonist, energy },
    inventory: { ...source.inventory, money },
    economy: { ...source.economy, nextAllowanceMinute, nextBasicCostMinute },
    npcs,
    transfers,
    invitations,
  });
  return {
    state,
    milestoneIds,
    energyDelta: energy - source.protagonist.energy,
    moneyDelta: money - source.inventory.money,
  };
}
