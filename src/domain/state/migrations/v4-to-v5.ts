import { z } from 'zod';

import {
  RelationshipStageSchema,
  RelationshipValuesSchema,
  RejectionRecordSchema,
  resolveChangeableRejections,
} from '../../relationships/relationship';
import { StableIdSchema } from '../ids';
import { LegacyStateV6Schema } from './legacy-v6';
import { LegacyStateV5Schema, type LegacyStateV5 } from './v5-to-v6';

const LegacyRelationshipV4Schema = z.object({
  npcId: StableIdSchema,
  values: RelationshipValuesSchema,
  stage: RelationshipStageSchema,
  rejections: z.array(RejectionRecordSchema),
  compatibility: z.object({ social: z.boolean(), romantic: z.boolean() }).strict(),
}).strict();

const LegacyJournalEntryV4Schema = z.object({
  id: StableIdSchema,
  questId: StableIdSchema,
  summary: z.string().min(1).max(500),
  locationPrecision: z.enum(['none', 'vague', 'exact']),
  locationId: StableIdSchema.optional(),
  markerVisible: z.boolean(),
  resolutionState: z.enum(['open', 'resolved', 'expired']),
}).strict();

export const LegacyStateV4Schema = LegacyStateV6Schema.omit({
  schemaVersion: true,
  relationships: true,
  journal: true,
  invitations: true,
  layoutRevisions: true,
  layoutMigrationEvidence: true,
}).extend({
  schemaVersion: z.literal(4),
  relationships: z.record(StableIdSchema, LegacyRelationshipV4Schema),
  journal: z.record(StableIdSchema, LegacyJournalEntryV4Schema),
}).strict();

const LINDA_REJECTIONS = [
  {
    reasonId: 'current_relationship', kind: 'changeable_circumstance' as const, sourceActionId: 'ask_date',
    circumstanceFlagId: 'linda_relationship_resolved', resolved: false,
  },
  {
    reasonId: 'home_visit_not_safe', kind: 'changeable_circumstance' as const, sourceActionId: 'invite_home',
    circumstanceFlagId: 'linda_relationship_resolved', resolved: false,
  },
];
const GENERIC_REJECTIONS = [
  {
    reasonId: 'not_romantically_compatible', kind: 'permanent_boundary' as const,
    sourceActionId: 'ask_date', resolved: false,
  },
];

export function migrateV4ToV5(candidate: unknown, nextGenerationId: string): LegacyStateV5 {
  const generationId = StableIdSchema.refine((value) => value.startsWith('generation-'), {
    message: 'Migration generation ID must start with generation-.',
  }).parse(nextGenerationId);
  const source = LegacyStateV4Schema.parse(candidate);
  const questFlagIds = new Set(Object.values(source.quests).flatMap(({ flagIds }) => flagIds));
  const relationships = Object.fromEntries(Object.entries(source.relationships).map(([id, relationship]) => {
    const authoredRejections = id === 'linda' ? LINDA_REJECTIONS : id === 'generic_resident' ? GENERIC_REJECTIONS : [];
    const mergedRejections = [...relationship.rejections, ...authoredRejections.filter((candidateRejection) => (
        !relationship.rejections.some(({ reasonId }) => reasonId === candidateRejection.reasonId)
      ))];
    const rejections = resolveChangeableRejections(
      mergedRejections,
      new Set([...questFlagIds, ...(source.npcs[id]?.unlockedIds ?? [])]),
    );
    return [id, {
      ...relationship,
      rejections,
      policy: id === 'linda' ? {
        romanticEligibleAtStart: false,
        hardBoundaries: [
          { id: 'no_aggressive_flirting', scope: 'romantic' as const, blockedActionIds: ['aggressive_flirt'] },
        ],
        stageRules: [
          { stage: 'dating' as const, unavailable: false, requiredFlagIds: ['cats_common_interest'] },
        ],
      } : { romanticEligibleAtStart: false, hardBoundaries: [], stageRules: [] },
    }];
  }));
  const journal = Object.fromEntries(Object.entries(source.journal).map(([id, entry]) => [id, {
    ...entry,
    source: { type: 'authored_event' as const, sourceId: 'migration_v4' },
    outcomeReceipts: [],
  }]));
  return LegacyStateV5Schema.parse({
    ...source,
    schemaVersion: 5,
    generationId,
    relationships,
    journal,
    invitations: {},
  });
}
