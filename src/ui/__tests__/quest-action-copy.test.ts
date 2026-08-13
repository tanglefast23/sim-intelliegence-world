import { questActionCopy } from '../quest-action-copy';

describe('quest action copy', () => {
  test('names the protagonist and states the full withdrawal result', () => {
    expect(questActionCopy({
      id: 'withdraw', label: 'Withdraw', cause: 'old copy', result: 'old result',
      socialConsequence: 'Linda loses trust.', routeConsequence: 'No route opens.', enabled: true,
    }, 'JOBO')).toEqual({
      action: 'JOBO tells Linda that he will not intervene.',
      result: 'End the quest. No cash gain, no injury possibility, no police attention.',
    });
  });
});
