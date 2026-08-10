import type {
  PersistencePort,
  SaveResult,
  SaveTrigger,
} from '../effects/PersistencePort';
import type { WorldState } from '../../domain/state/schema';

export async function autosaveStableState(input: Readonly<{
  persistence: Pick<PersistencePort, 'requestSave'>;
  state: WorldState;
  trigger: Extract<SaveTrigger, 'sleep' | 'travel' | 'major_quest'>;
  expectedSaveGeneration: number | null;
}>): Promise<SaveResult> {
  if (input.state.clock.pauseTokens.length > 0) {
    throw new Error('Autosave requires a stable world with no pause tokens.');
  }
  return input.persistence.requestSave({
    slotId: 'slot-001',
    expectedSaveGeneration: input.expectedSaveGeneration,
    trigger: input.trigger,
    state: input.state,
  });
}
