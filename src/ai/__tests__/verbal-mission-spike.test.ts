import { RecordedInferencePort } from '../../application/effects/InferencePort';
import { parseVerbalMoveJson, validateVerbalMove } from '../schemas/verbal-move';
import { readVerbalMove } from '../conversation/verbal-mission-reader';
import {
  buildActorSpikePrompt,
  buildMoveReaderPrompt,
  MAX_MOVE_READER_PROMPT_BYTES,
} from '../conversation/verbal-mission-prompts';
import {
  VERBAL_MISSION_SPIKE_FACTS,
  VERBAL_MISSION_READER_CORPUS,
  VERBAL_MISSION_SPIKE_REFERENTS,
  verbalMissionSpikeFixtureMatches,
} from '../../../tests/fixtures/ai-capability/verbal-missions';

const input = {
  playerMessage: 'I can offer $95 for the purse.',
  referents: VERBAL_MISSION_SPIKE_REFERENTS,
  facts: VERBAL_MISSION_SPIKE_FACTS,
};

const validMove = JSON.stringify({
  acts: [{ act: 'offer', referentId: 'linda_marchetti_purse', evidenceText: 'offer $95 for the purse' }],
  register: 'plain',
  claims: [],
  referenceConfidence: 'clear',
});

describe('Verbal Mission model spike contracts', () => {
  test('locks 400 unique paraphrase, referent, injection, marriage, and murder cases', () => {
    expect(VERBAL_MISSION_READER_CORPUS).toHaveLength(400);
    expect(new Set(VERBAL_MISSION_READER_CORPUS.map(({ id }) => id)).size).toBe(400);
    expect(new Set(VERBAL_MISSION_READER_CORPUS.map(({ playerMessage }) => playerMessage)).size).toBe(400);
    for (const fixture of VERBAL_MISSION_READER_CORPUS) {
      const move = parseVerbalMoveJson(JSON.stringify({
        acts: [{
          act: fixture.expected.acts[0],
          referentId: fixture.expected.referentId,
          evidenceText: fixture.playerMessage,
        }],
        register: fixture.expected.register,
        claims: fixture.expected.claimFactId ? [{
          factId: fixture.expected.claimFactId,
          polarity: 'assert',
          evidenceText: fixture.playerMessage,
        }] : [],
        referenceConfidence: fixture.expected.confidence,
      }), fixture.playerMessage, {
        referentIds: VERBAL_MISSION_SPIKE_REFERENTS.map(({ id }) => id),
        factIds: VERBAL_MISSION_SPIKE_FACTS.map(({ id }) => id),
      });
      expect(verbalMissionSpikeFixtureMatches(move, fixture)).toBe(true);
      expect(new TextEncoder().encode(buildMoveReaderPrompt({
        playerMessage: fixture.playerMessage,
        referents: VERBAL_MISSION_SPIKE_REFERENTS,
        facts: VERBAL_MISSION_SPIKE_FACTS,
      })).byteLength).toBeLessThanOrEqual(MAX_MOVE_READER_PROMPT_BYTES);
    }
  });

  test('parses a closed move with exact evidence and candidate IDs', () => {
    expect(parseVerbalMoveJson(validMove, input.playerMessage, {
      referentIds: input.referents.map(({ id }) => id),
      factIds: input.facts.map(({ id }) => id),
    })).toEqual(expect.objectContaining({ register: 'plain', referenceConfidence: 'clear' }));
  });

  test('rejects unknown fields, IDs, duplicate keys, and invented evidence', () => {
    const parsed = JSON.parse(validMove) as Record<string, unknown>;
    expect(() => validateVerbalMove({ ...parsed, result: 'success' }, input.playerMessage, {
      referentIds: ['linda_marchetti_purse'], factIds: [],
    })).toThrow();
    expect(() => parseVerbalMoveJson(validMove.replace('linda_marchetti_purse', 'unknown_purse'), input.playerMessage, {
      referentIds: ['linda_marchetti_purse'], factIds: [],
    })).toThrow('Unknown Verbal Move referent');
    expect(() => parseVerbalMoveJson(validMove.replace('offer $95 for the purse', 'give me the purse'), input.playerMessage, {
      referentIds: ['linda_marchetti_purse'], factIds: [],
    })).toThrow('exact player-message substring');
    expect(() => parseVerbalMoveJson(validMove.replace('"register":"plain"', '"register":"plain","register":"warm"'), input.playerMessage, {
      referentIds: ['linda_marchetti_purse'], factIds: [],
    })).toThrow('Duplicate JSON key');
  });

  test('retries once then returns a safe clarification without state', async () => {
    const inference = new RecordedInferencePort(['{}', '{}']);
    await expect(readVerbalMove(inference, input)).resolves.toEqual({
      kind: 'clarify', reasonId: 'move_reader_invalid', attempts: 2,
    });
    expect(inference.requests).toHaveLength(2);
  });

  test('accepts a corrected second response', async () => {
    const inference = new RecordedInferencePort(['{}', validMove]);
    await expect(readVerbalMove(inference, input)).resolves.toEqual(expect.objectContaining({
      kind: 'move', attempts: 2,
    }));
  });

  test('keeps Reader and Actor prompts bounded and conceals private rules', () => {
    const reader = buildMoveReaderPrompt(input);
    expect(new TextEncoder().encode(reader).byteLength).toBeLessThanOrEqual(MAX_MOVE_READER_PROMPT_BYTES);
    expect(reader).not.toContain('hard minimum');
    expect(reader).not.toContain('success');
    const actor = buildActorSpikePrompt({
      npcName: 'Linda', reactionId: 'linda_offer_fair', speakableFact: 'The clasp is worn.',
    });
    expect(actor).toContain('linda_offer_fair');
    expect(actor).toContain('The clasp is worn.');
    expect(actor).not.toContain('$80');
  });
});
