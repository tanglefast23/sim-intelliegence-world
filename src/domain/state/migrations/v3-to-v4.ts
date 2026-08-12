import { z } from 'zod';

import {
  EconomyStateSchema,
  NpcStateSchema,
  ScheduleBlockSchema,
} from '../models';
import { StableIdSchema } from '../ids';
import { WorldStateBaseSchema } from '../schema';
import { routeBetween } from '../../../world/transfers/routes';
import { LegacyStateV4Schema } from './v4-to-v5';

const LegacyNpcPresenceV3Schema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('active_local'), locationId: StableIdSchema }).strict(),
  z.object({ kind: z.literal('in_transit'), transferId: StableIdSchema }).strict(),
  z.object({ kind: z.literal('inactive'), destinationLocationId: StableIdSchema }).strict(),
]);
const LegacyNpcV3Schema = NpcStateSchema
  .omit({ presence: true, scheduleGoal: true })
  .extend({ presence: LegacyNpcPresenceV3Schema })
  .strict();
const LegacyEconomyV3Schema = EconomyStateSchema.omit({ nextBasicCostMinute: true }).strict();
const LegacyScheduleBlockV3Schema = ScheduleBlockSchema.omit({ mapId: true, tileX: true, tileY: true }).strict();
const LegacyScheduleV3Schema = z.object({
  id: StableIdSchema,
  npcId: StableIdSchema,
  blocks: z.array(LegacyScheduleBlockV3Schema).min(4).max(6),
}).strict().superRefine((schedule, context) => {
  for (let index = 1; index < schedule.blocks.length; index += 1) {
    if ((schedule.blocks[index]?.startMinuteOfDay ?? 0) <= (schedule.blocks[index - 1]?.startMinuteOfDay ?? 0)) {
      context.addIssue({ code: 'custom', message: 'Schedule blocks must use strictly increasing times.' });
    }
  }
});
const LegacyTransferV3Schema = z.object({
  id: StableIdSchema,
  npcId: StableIdSchema,
  originMapId: StableIdSchema,
  destinationMapId: StableIdSchema,
  edgePortalId: StableIdSchema,
  departureMinute: z.number().int().nonnegative(),
  arrivalMinute: z.number().int().nonnegative(),
  destinationEntranceId: StableIdSchema,
}).strict().refine((transfer) => transfer.arrivalMinute > transfer.departureMinute, {
  message: 'Transfer arrival must be after departure.',
});

export const LegacyStateV3Schema = WorldStateBaseSchema.omit({
  schemaVersion: true,
  relationships: true,
  journal: true,
  invitations: true,
  layoutRevisions: true,
  layoutMigrationEvidence: true,
}).extend({
  schemaVersion: z.literal(3),
  relationships: LegacyStateV4Schema.shape.relationships,
  journal: LegacyStateV4Schema.shape.journal,
  npcs: z.record(StableIdSchema, LegacyNpcV3Schema),
  economy: LegacyEconomyV3Schema,
  schedules: z.record(StableIdSchema, LegacyScheduleV3Schema),
  transfers: z.record(StableIdSchema, LegacyTransferV3Schema),
}).strict();

const LOCATION_DEFAULTS: Readonly<Record<string, Readonly<{ mapId: string; tileX: number; tileY: number }>>> = {
  linda_villa: { mapId: 'northwest_residential', tileX: 23, tileY: 28 },
  northeast_downtown: { mapId: 'northeast_downtown', tileX: 18, tileY: 13 },
  northwest_residential: { mapId: 'northwest_residential', tileX: 29, tileY: 33 },
  protagonist_villa: { mapId: 'northwest_residential', tileX: 18, tileY: 18 },
  southeast_docks: { mapId: 'southeast_docks', tileX: 39, tileY: 27 },
  southwest_commercial: { mapId: 'southwest_commercial', tileX: 17, tileY: 17 },
};

const SCHEDULE_BLOCK_DEFAULTS: Readonly<Record<string, Readonly<{ mapId: string; tileX: number; tileY: number }>>> = {
  'linda_villa:sleep': { mapId: 'northwest_residential', tileX: 23, tileY: 28 },
  'northwest_residential:relax': { mapId: 'northwest_residential', tileX: 28, tileY: 30 },
  'southwest_commercial:shop': { mapId: 'southwest_commercial', tileX: 17, tileY: 17 },
  'linda_villa:home': { mapId: 'northwest_residential', tileX: 23, tileY: 28 },
  'northwest_residential:sleep': { mapId: 'northwest_residential', tileX: 29, tileY: 33 },
  'northwest_residential:work': { mapId: 'northwest_residential', tileX: 27, tileY: 28 },
  'northeast_downtown:meal': { mapId: 'northeast_downtown', tileX: 44, tileY: 34 },
  'northeast_downtown:nightlife': { mapId: 'northeast_downtown', tileX: 18, tileY: 13 },
};

function locationDefault(locationId: string) {
  const value = LOCATION_DEFAULTS[locationId];
  if (!value) throw new Error(`No v3 location migration default exists for ${locationId}.`);
  return value;
}

function scheduleBlockDefault(locationId: string, activityId: string) {
  const value = SCHEDULE_BLOCK_DEFAULTS[`${locationId}:${activityId}`];
  if (!value) throw new Error(`No v3 schedule migration default exists for ${locationId}/${activityId}.`);
  return value;
}

export function migrateV3ToV4(candidate: unknown, nextGenerationId: string): z.infer<typeof LegacyStateV4Schema> {
  const generationId = StableIdSchema.refine((value) => value.startsWith('generation-'), {
    message: 'Migration generation ID must start with generation-.',
  }).parse(nextGenerationId);
  const source = LegacyStateV3Schema.parse(candidate);
  const schedules = Object.fromEntries(Object.entries(source.schedules).map(([id, schedule]) => [id, {
    ...schedule,
    blocks: schedule.blocks.map((block) => ({
      ...block,
      ...scheduleBlockDefault(block.locationId, block.activityId),
    })),
  }]));
  const npcs = Object.fromEntries(Object.entries(source.npcs).map(([id, npc]) => {
    if (npc.presence.kind === 'in_transit') return [id, npc];
    const locationId = npc.presence.kind === 'inactive'
      ? npc.presence.destinationLocationId
      : npc.presence.locationId;
    const position = locationDefault(locationId);
    return [id, {
      ...npc,
      presence: {
        kind: npc.presence.kind,
        mapId: position.mapId,
        locationId,
        tileX: position.tileX,
        tileY: position.tileY,
      },
    }];
  }));
  const transfers = Object.fromEntries(Object.entries(source.transfers).map(([id, transfer]) => {
    const route = routeBetween(transfer.originMapId, transfer.destinationMapId);
    return [id, {
      ...transfer,
      status: 'in_transit' as const,
      destinationEntranceTileX: route.destinationEntranceTile.x,
      destinationEntranceTileY: route.destinationEntranceTile.y,
      destinationLocationId: transfer.destinationMapId,
      destinationActivityId: 'travel',
      destinationGoalTileX: route.destinationEntranceTile.x,
      destinationGoalTileY: route.destinationEntranceTile.y,
    }];
  }));
  return LegacyStateV4Schema.parse({
    ...source,
    schemaVersion: 4,
    generationId,
    npcs,
    schedules,
    transfers,
    economy: {
      ...source.economy,
      nextBasicCostMinute: (Math.floor(source.clock.absoluteMinute / 1_440) + 1) * 1_440,
    },
  });
}
