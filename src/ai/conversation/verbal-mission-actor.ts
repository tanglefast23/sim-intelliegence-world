import { z } from 'zod';

import type { InferencePort } from '../../application/effects/InferencePort';
import type { VerbalMissionOutcome } from '../../domain/verbal-missions/outcome-engine';
import type { VerbalMissionState } from '../../domain/verbal-missions/state';
import type { WorldState } from '../../domain/state/schema';
import { classifyApprovedDialogue } from '../policy/content-policy';
import { buildVerbalMissionActorProjection, type PromptTurn } from '../projection/prompt-projection';
import type { CharacterWriting } from '../registry/scene-registry';
import { parseBoundedJson } from '../schemas/safe-json';

const VerbalMissionActorSchema = z.object({
  dialogue: z.string().trim().min(1).max(420),
  emotion: z.enum(['neutral', 'warm', 'wary', 'angry', 'afraid', 'sad', 'amused']),
  reactionId: z.string().regex(/^[a-z][a-z0-9]*(?:[_-][a-z0-9]+)*$/u),
}).strict();

const actorJsonSchema = z.toJSONSchema(VerbalMissionActorSchema, { target: 'draft-7' });
const PREMATURE_COMPLETION = /\b(?:deal is done|deal's done|sold to you|sale is complete|it is yours|it's yours|i agree|i promise|consider it done|assessment is complete)\b/iu;

export type VerbalMissionActorDiagnostic = Readonly<{
  attempt: 1 | 2;
  reason: string;
}>;

function exactTermsAgree(dialogue: string, mission: VerbalMissionState): boolean {
  const dollarAmounts = [...dialogue.matchAll(/\$\s*(\d[\d,]*)/gu)].map((match) => Number(match[1]?.replaceAll(',', '')));
  if (dollarAmounts.length > 0) {
    if (mission.goalKind !== 'buy_object' || mission.terms.currentOffer === null) return false;
    if (dollarAmounts.some((amount) => amount !== mission.terms.currentOffer)) return false;
  }
  const scheduledMinutes = [...dialogue.matchAll(/\bminute\s+(\d+)\b/giu)].map((match) => Number(match[1]));
  if (scheduledMinutes.length > 0) {
    if (mission.goalKind !== 'schedule_cooperation' || mission.terms.proposedMinute === null) return false;
    if (scheduledMinutes.some((minute) => minute !== mission.terms.proposedMinute)) return false;
  }
  return true;
}

export async function completeVerbalMissionActor(input: Readonly<{
  inference: InferencePort;
  state: WorldState;
  character: CharacterWriting;
  mission: VerbalMissionState;
  playerMessage: string;
  recentTurns: readonly PromptTurn[];
  outcome: VerbalMissionOutcome;
  speakableFactTexts: readonly string[];
  signal?: AbortSignal;
  onDiagnostic?: (diagnostic: VerbalMissionActorDiagnostic) => void;
}>): Promise<Readonly<{
  dialogue: string;
  emotion: z.infer<typeof VerbalMissionActorSchema>['emotion'];
  source: 'model' | 'corrected-model' | 'authored-fallback';
}>> {
  const prompt = buildVerbalMissionActorProjection(input);
  for (const attempt of [1, 2] as const) {
    try {
      const source = await input.inference.complete({
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: attempt === 1
            ? 'Return the in-character Verbal Mission reply.'
            : 'The prior object was invalid. Return one corrected object that preserves the exact authoritative outcome.' },
        ],
        schemaName: 'si_world_verbal_mission_actor',
        jsonSchema: actorJsonSchema,
        maxTokens: 192,
      }, input.signal);
      const parsed = VerbalMissionActorSchema.parse(parseBoundedJson(source));
      if (parsed.reactionId !== input.outcome.reactionId) throw new Error('Actor changed the authoritative reaction ID.');
      if (PREMATURE_COMPLETION.test(parsed.dialogue)) throw new Error('Actor claimed an unconfirmed terminal result.');
      if (!exactTermsAgree(parsed.dialogue, input.mission)) throw new Error('Actor contradicted authoritative exact terms.');
      if (input.speakableFactTexts.some((fact) => !parsed.dialogue.includes(fact))) {
        throw new Error('Actor omitted a newly disclosed authored fact.');
      }
      const policy = await classifyApprovedDialogue(input.inference, parsed.dialogue, input.signal);
      if (!policy || policy.decision !== 'allow') throw new Error('Actor dialogue failed content policy.');
      return { dialogue: parsed.dialogue, emotion: parsed.emotion, source: attempt === 1 ? 'model' : 'corrected-model' };
    } catch (error) {
      input.signal?.throwIfAborted();
      input.onDiagnostic?.({
        attempt,
        reason: error instanceof Error ? error.message : 'Unknown Verbal Mission Actor failure.',
      });
    }
  }
  const facts = input.speakableFactTexts.filter((fact) => !input.outcome.actorFallback.includes(fact));
  return {
    dialogue: [input.outcome.actorFallback, ...facts].join(' ').slice(0, 420),
    emotion: input.outcome.portraitId === 'warm' ? 'warm'
      : input.outcome.portraitId === 'guarded' ? 'wary'
        : input.outcome.portraitId === 'hurt' ? 'sad' : 'neutral',
    source: 'authored-fallback',
  };
}
