import type { ContextQuestAction } from '../quests/quest-machine';
import type { WorldState } from '../state/schema';
import {
  LINDA_PURSE_MISSION_ID,
  PRIYA_ASSESSMENT_MISSION_ID,
  authoredPlayerKnowledgeRecord,
} from './goal-planners';

export const VERBAL_MISSION_DISCOVERY_FACTS = {
  appraise_linda_purse: 'linda_quick_consignment_net',
  check_linda_payment: 'linda_cash_payment_ready',
  inspect_linda_purse: 'linda_purse_worn_clasp',
  record_patient_consent: 'priya_patient_consent',
} as const;

export type VerbalMissionDiscoveryActionId = keyof typeof VERBAL_MISSION_DISCOVERY_FACTS;

function unresolved(state: WorldState, missionId: string): boolean {
  const mission = state.verbalMissions[missionId];
  return Boolean(mission && (mission.status === 'available' || mission.status === 'active'));
}

function action(
  id: VerbalMissionDiscoveryActionId,
  label: string,
  cause: string,
  result: string,
): ContextQuestAction {
  return {
    id, label, cause, result,
    socialConsequence: 'No relationship value changes.',
    routeConsequence: 'This adds one verified fact you can use in a Verbal Mission.',
    enabled: true,
  };
}

export function verbalMissionContextActions(state: WorldState, selectedNpcId?: string): ContextQuestAction[] {
  const actions: ContextQuestAction[] = [];
  if (unresolved(state, LINDA_PURSE_MISSION_ID)) {
    if (selectedNpcId === 'sora_tan' && !state.playerKnowledge.linda_quick_consignment_net) {
      actions.push(action(
        'appraise_linda_purse', 'Ask Sora for a purse appraisal',
        'Show Sora the public details and ask what a fast consignment sale would net.',
        'You learn that a fast consignment sale would net Linda $85.',
      ));
    }
    if (selectedNpcId === 'linda' && !state.playerKnowledge.linda_purse_worn_clasp) {
      actions.push(action(
        'inspect_linda_purse', 'Look at the purse clasp',
        'Inspect the visible clasp without taking or touching the purse.',
        'You record that the clasp is visibly worn.',
      ));
    }
    if (selectedNpcId === 'linda' && !state.playerKnowledge.linda_cash_payment_ready && state.inventory.money >= 80) {
      actions.push(action(
        'check_linda_payment', 'Check your purse payment',
        'Count enough available money for the minimum legal private sale.',
        'You confirm that an exact cash payment is available.',
      ));
    }
  }
  if (
    unresolved(state, PRIYA_ASSESSMENT_MISSION_ID) && selectedNpcId === 'linda_boyfriend' &&
    state.npcs.linda_boyfriend?.condition === 'injured' && !state.playerKnowledge.priya_patient_consent
  ) {
    actions.push(action(
      'record_patient_consent', 'Ask Marcus for medical consent',
      'Ask Marcus whether Priya may assess him for off-island transport.',
      'Marcus gives consent for Priya to perform the assessment.',
    ));
  }
  return actions;
}

export function verbalMissionDiscoveryRecord(state: WorldState, actionId: string) {
  const factId = VERBAL_MISSION_DISCOVERY_FACTS[actionId as VerbalMissionDiscoveryActionId];
  if (!factId) throw new Error(`Unknown Verbal Mission discovery action: ${actionId}`);
  const available = verbalMissionContextActions(state, actionId === 'appraise_linda_purse' ? 'sora_tan'
    : actionId === 'record_patient_consent' ? 'linda_boyfriend' : 'linda').some(({ id }) => id === actionId);
  if (!available) throw new Error('Verbal Mission discovery action is not currently available.');
  return authoredPlayerKnowledgeRecord(factId);
}
