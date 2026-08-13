import type { InferencePort } from '../../application/effects/InferencePort';
import {
  parseVerbalMoveJson,
  verbalMoveJsonSchemaForCandidates,
  type VerbalMove,
} from '../schemas/verbal-move';
import {
  buildMoveReaderPrompt,
  moveReaderCandidates,
  moveReaderUserMessage,
  type MoveReaderPromptInput,
} from './verbal-mission-prompts';

export type MoveReaderResult =
  | Readonly<{ kind: 'move'; move: VerbalMove; attempts: 1 | 2 }>
  | Readonly<{ kind: 'clarify'; reasonId: 'move_reader_invalid'; attempts: 2 }>;

export async function readVerbalMove(
  inference: InferencePort,
  input: MoveReaderPromptInput,
  signal?: AbortSignal,
): Promise<MoveReaderResult> {
  const prompt = buildMoveReaderPrompt(input);
  const candidates = moveReaderCandidates(input);
  for (const attempt of [1, 2] as const) {
    try {
      const source = await inference.complete({
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: moveReaderUserMessage(input.playerMessage, attempt === 2) },
        ],
        schemaName: 'si_world_verbal_move',
        jsonSchema: verbalMoveJsonSchemaForCandidates(candidates),
        maxTokens: 160,
      }, signal);
      return { kind: 'move', move: parseVerbalMoveJson(source, input.playerMessage, candidates), attempts: attempt };
    } catch {
      signal?.throwIfAborted();
    }
  }
  return { kind: 'clarify', reasonId: 'move_reader_invalid', attempts: 2 };
}
