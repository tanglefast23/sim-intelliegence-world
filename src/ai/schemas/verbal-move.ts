import { z } from 'zod';

import { StableIdSchema } from '../../domain/state/ids';
import { VERBAL_ACTS, VERBAL_REGISTERS } from '../../domain/verbal-missions/contracts';
import { parseBoundedJson } from './safe-json';

export { VERBAL_ACTS, VERBAL_REGISTERS };

const EvidenceTextSchema = z.string().min(1).max(500);

export const VerbalMoveSchema = z.object({
  acts: z.array(z.object({
    act: z.enum(VERBAL_ACTS),
    referentId: StableIdSchema.nullable(),
    evidenceText: EvidenceTextSchema,
  }).strict()).min(1).max(3),
  register: z.enum(VERBAL_REGISTERS),
  claims: z.array(z.object({
    factId: StableIdSchema,
    polarity: z.enum(['assert', 'deny', 'ask']),
    evidenceText: EvidenceTextSchema,
  }).strict()).max(3),
  referenceConfidence: z.enum(['clear', 'probable', 'ambiguous']),
}).strict();

export type VerbalMove = z.infer<typeof VerbalMoveSchema>;

export type VerbalMoveCandidates = Readonly<{
  referentIds: readonly string[];
  factIds: readonly string[];
}>;

export const verbalMoveJsonSchema = z.toJSONSchema(VerbalMoveSchema, { target: 'draft-7' });

function closedIdSchema(ids: readonly string[]): z.ZodType {
  if (ids.length === 0) return z.never();
  return z.enum(ids as [string, ...string[]]);
}

export function verbalMoveJsonSchemaForCandidates(candidates: VerbalMoveCandidates): Readonly<Record<string, unknown>> {
  const schema = z.object({
    acts: z.array(z.object({
      act: z.enum(VERBAL_ACTS),
      referentId: candidates.referentIds.length === 0
        ? z.null()
        : closedIdSchema(candidates.referentIds).nullable(),
      evidenceText: EvidenceTextSchema,
    }).strict()).min(1).max(3),
    register: z.enum(VERBAL_REGISTERS),
    claims: candidates.factIds.length === 0
      ? z.array(z.never()).max(0)
      : z.array(z.object({
        factId: closedIdSchema(candidates.factIds),
        polarity: z.enum(['assert', 'deny', 'ask']),
        evidenceText: EvidenceTextSchema,
      }).strict()).max(3),
    referenceConfidence: z.enum(['clear', 'probable', 'ambiguous']),
  }).strict();
  return z.toJSONSchema(schema, { target: 'draft-7' });
}

export function validateVerbalMove(
  candidate: unknown,
  playerMessage: string,
  candidates: VerbalMoveCandidates,
): VerbalMove {
  const move = VerbalMoveSchema.parse(candidate);
  const referentIds = new Set(candidates.referentIds);
  const factIds = new Set(candidates.factIds);
  for (const act of move.acts) {
    if (act.referentId !== null && !referentIds.has(act.referentId)) {
      throw new Error(`Unknown Verbal Move referent: ${act.referentId}`);
    }
    if (!playerMessage.includes(act.evidenceText)) {
      throw new Error('Verbal Move act evidence is not an exact player-message substring.');
    }
  }
  for (const claim of move.claims) {
    if (!factIds.has(claim.factId)) throw new Error(`Unknown Verbal Move fact: ${claim.factId}`);
    if (!playerMessage.includes(claim.evidenceText)) {
      throw new Error('Verbal Move claim evidence is not an exact player-message substring.');
    }
  }
  return move;
}

export function parseVerbalMoveJson(
  source: string,
  playerMessage: string,
  candidates: VerbalMoveCandidates,
): VerbalMove {
  return validateVerbalMove(parseBoundedJson(source), playerMessage, candidates);
}
