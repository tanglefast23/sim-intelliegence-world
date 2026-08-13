import type { ContextQuestAction } from '../domain/quests/quest-machine';

export function questActionCopy(action: ContextQuestAction, playerName: string) {
  switch (action.id) {
    case 'protect_linda':
      return { action: `${playerName} confronts Linda's boyfriend and forces him to leave the villa.`, result: action.result };
    case 'betray_linda':
      return { action: `${playerName} warns Linda's boyfriend and accepts his payment.`, result: action.result };
    case 'withdraw':
      return {
        action: `${playerName} tells Linda that he will not intervene.`,
        result: action.result,
      };
    case 'discover':
      return { action: `${playerName} confirms Linda's villa at the address she described.`, result: action.result };
    default:
      return { action: action.cause, result: action.result };
  }
}
