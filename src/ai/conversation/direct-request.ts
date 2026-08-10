const ASK_DATE_PATTERNS = [
  /\b(?:would|will|can|could)\s+you\s+(?:like\s+to\s+)?(?:go\s+out|go\s+on\s+(?:a\s+)?date|date\s+me)(?:\s+with\s+me)?\b/iu,
  /\b(?:do\s+you\s+want\s+to|wanna)\s+(?:go\s+out|go\s+on\s+(?:a\s+)?date)(?:\s+with\s+me)?\b/iu,
  /\bcan\s+i\s+(?:take|ask)\s+you\s+(?:out|on\s+(?:a\s+)?date)\b/iu,
  /\bwould\s+you\s+be\s+my\s+(?:girlfriend|boyfriend|partner)\b/iu,
  /\byou\s+and\s+i\b[^.!?]{0,80}\b(?:might|could|should|would)\b[^.!?]{0,60}\b(?:be\s+good\s+together|go\s+out|have\s+dinner|date)\b/iu,
];

const INVITE_HOME_PATTERNS = [
  /\b(?:would|will|can|could)\s+you\s+(?:like\s+to\s+)?(?:come\s+(?:over|to\s+my\s+(?:home|house|villa))|visit\s+my\s+(?:home|house|villa))\b/iu,
  /\b(?:do\s+you\s+want\s+to|wanna)\s+(?:come\s+(?:over|to\s+my\s+(?:home|house|villa))|visit\s+my\s+(?:home|house|villa))\b/iu,
  /\bhow\s+about\s+(?:coming\s+over|visiting\s+my\s+(?:home|house|villa))\b/iu,
];

export function isDirectAskDateRequest(message: string): boolean {
  return ASK_DATE_PATTERNS.some((pattern) => pattern.test(message));
}

export function isDirectHomeInvitationRequest(message: string): boolean {
  return INVITE_HOME_PATTERNS.some((pattern) => pattern.test(message));
}

export function canModelInferStructuredAction(playerMessage: string, actionId: string | null): boolean {
  if (actionId === 'ask_date') return isDirectAskDateRequest(playerMessage);
  if (actionId === 'invite_home') return isDirectHomeInvitationRequest(playerMessage);
  return false;
}
