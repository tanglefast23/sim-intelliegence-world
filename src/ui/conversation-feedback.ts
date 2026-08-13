import type {
  ConversationTurnResult,
  ReadVerbalMissionTurnResult,
} from '../application/effects/ConversationPort';

type MissionRead = Extract<ReadVerbalMissionTurnResult, { kind: 'decided' }>;
export type VerbalMissionConfirmation = NonNullable<MissionRead['confirmation']>;

export function portraitExpressionForEmotion(emotion: ConversationTurnResult['emotion']): 'rest' | 'joy' | 'upset' {
  if (emotion === 'warm' || emotion === 'amused') return 'joy';
  if (emotion === 'neutral') return 'rest';
  return 'upset';
}

export function authoredBeginFallback(npcId: string): Readonly<{ displayName: string; dialogue: string }> {
  return npcId === 'linda'
    ? { displayName: 'Linda', dialogue: "The island's systems are acting up. We can keep this simple." }
    : { displayName: 'Resident', dialogue: 'The network is down. Nice weather, though.' };
}

export function conversationGenerationNote(source: ConversationTurnResult['source']): string {
  if (source === 'authored-fallback') return 'SAFE REPLY USED';
  if (source === 'model' || source === 'corrected-model') return 'REPLY RECEIVED';
  return 'AUTHORED REPLY USED';
}

export function portraitExpressionForMissionReaction(
  reaction: MissionRead['portraitId'],
): 'rest' | 'joy' | 'upset' {
  if (reaction === 'warm') return 'joy';
  if (reaction === 'guarded' || reaction === 'hurt') return 'upset';
  return 'rest';
}

export function verbalMissionLabel(value: string): string {
  return value.replaceAll('_', ' ').replaceAll('-', ' ').toUpperCase();
}

export function verbalMissionTimeLabel(absoluteMinute: number): string {
  const day = Math.floor(absoluteMinute / 1_440) + 1;
  const minute = absoluteMinute % 1_440;
  return `DAY ${day} ${Math.floor(minute / 60).toString().padStart(2, '0')}:${(minute % 60).toString().padStart(2, '0')}`;
}

export function verbalMissionConfirmationCopy(confirmation: VerbalMissionConfirmation): Readonly<{
  title: string;
  detail: string;
  consequence: string;
  button: string;
}> {
  if (confirmation.goalKind === 'disclose_fact') {
    return {
      title: `SHARE ${confirmation.factLabel.toUpperCase()}`,
      detail: `${confirmation.recipientLabel} will receive this information.`,
      consequence: 'This permanently records the disclosure.',
      button: 'CONFIRM DISCLOSURE',
    };
  }
  if (confirmation.goalKind === 'buy_object') {
    return {
      title: `BUY ${confirmation.objectLabel.toUpperCase()}`,
      detail: `$${confirmation.confirmedAmount} will be paid and ownership will transfer to you.`,
      consequence: 'This purchase cannot be cancelled after confirmation.',
      button: `PAY $${confirmation.confirmedAmount}`,
    };
  }
  return {
    title: confirmation.actionLabel.toUpperCase(),
    detail: `${confirmation.subjectLabel} · ${confirmation.locationLabel} · ${verbalMissionTimeLabel(confirmation.scheduledMinute)}`,
    consequence: 'This records an agreement. The action resolves later in the world.',
    button: 'CONFIRM AGREEMENT',
  };
}
