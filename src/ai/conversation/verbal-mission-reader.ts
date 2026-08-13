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

export function readerDialogueText(message: string): string {
  const instruction = /\[\s*system\s*\]|ignore\s+(?:all|every)\s+(?:rule|instruction)|set\s+(?:referentid|factid)|output\s+(?:success|json)/iu.exec(message);
  if (!instruction) return message;
  const suffix = /^[^.!?]*[.!?]\s+([^]*)$/u.exec(message.slice(instruction.index))?.[1]?.trim();
  return suffix || message;
}

export async function readVerbalMove(
  inference: InferencePort,
  input: MoveReaderPromptInput,
  signal?: AbortSignal,
): Promise<MoveReaderResult> {
  const dialogue = readerDialogueText(input.playerMessage);
  const promptInput = { ...input, playerMessage: dialogue };
  const prompt = buildMoveReaderPrompt(promptInput);
  const candidates = moveReaderCandidates(input);
  for (const attempt of [1, 2] as const) {
    try {
      const source = await inference.complete({
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: moveReaderUserMessage(dialogue, attempt === 2) },
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
