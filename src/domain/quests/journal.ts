import { z } from 'zod';

import { StableIdSchema } from '../state/ids';
import { JournalSubjectSchema } from '../verbal-missions/state';

export const JournalSourceSchema = z.object({
  type: z.enum(['npc_report', 'scene_observation', 'authored_event', 'item']),
  sourceId: StableIdSchema,
}).strict();

export const JournalOutcomeReceiptSchema = z.object({
  id: StableIdSchema,
  summary: z.string().trim().min(1).max(240),
  outcome: z.enum(['success', 'failure', 'withdrawn', 'information']),
}).strict();

export const JournalEntrySchema = z.object({
  id: StableIdSchema,
  subject: JournalSubjectSchema,
  summary: z.string().trim().min(1).max(500),
  locationPrecision: z.enum(['none', 'vague', 'exact']),
  locationId: StableIdSchema.optional(),
  markerVisible: z.boolean(),
  deadlineMinute: z.number().int().nonnegative().optional(),
  source: JournalSourceSchema,
  resolutionState: z.enum(['open', 'resolved', 'expired']),
  outcomeReceipts: z.array(JournalOutcomeReceiptSchema),
}).strict().superRefine((entry, context) => {
  if (entry.markerVisible && (entry.locationPrecision !== 'exact' || !entry.locationId)) {
    context.addIssue({ code: 'custom', message: 'A map marker requires an exact known location.' });
  }
  if (entry.locationPrecision === 'exact' && (!entry.locationId || entry.source.type === 'npc_report')) {
    context.addIssue({ code: 'custom', message: 'Exact journal locations require authoritative non-report evidence.' });
  }
  if (entry.locationPrecision !== 'exact' && entry.locationId) {
    context.addIssue({ code: 'custom', message: 'Only an exact journal location may store a location ID.' });
  }
  const receiptIds = entry.outcomeReceipts.map(({ id }) => id);
  if (new Set(receiptIds).size !== receiptIds.length) {
    context.addIssue({ code: 'custom', message: 'Journal outcome receipt IDs must be unique.' });
  }
});
export type JournalEntry = z.infer<typeof JournalEntrySchema>;

const PRECISION_RANK = { none: 0, vague: 1, exact: 2 } as const;

export function upsertJournalEntry(current: JournalEntry | undefined, candidate: JournalEntry): JournalEntry {
  const parsed = JournalEntrySchema.parse(candidate);
  if (!current) return parsed;
  if (current.id !== parsed.id || JSON.stringify(current.subject) !== JSON.stringify(parsed.subject)) {
    throw new Error('A journal update cannot change entry or subject identity.');
  }
  if (PRECISION_RANK[parsed.locationPrecision] < PRECISION_RANK[current.locationPrecision]) {
    throw new Error('A journal update cannot reduce known location precision.');
  }
  if (current.resolutionState !== 'open' && parsed.resolutionState === 'open') {
    throw new Error('A closed journal entry cannot return to open state.');
  }
  if (current.deadlineMinute !== undefined && parsed.deadlineMinute === undefined) {
    throw new Error('A learned journal deadline cannot be removed.');
  }
  const receipts = [...current.outcomeReceipts];
  for (const receipt of parsed.outcomeReceipts) {
    const existing = receipts.find(({ id }) => id === receipt.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(receipt)) {
      throw new Error(`Journal outcome receipt ${receipt.id} cannot be redefined.`);
    }
    if (!existing) receipts.push(receipt);
  }
  return JournalEntrySchema.parse({ ...parsed, outcomeReceipts: receipts });
}
