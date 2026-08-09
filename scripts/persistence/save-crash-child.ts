import { SaveRequestSchema } from '../../src/application/effects/PersistencePort';
import { createInitialState } from '../../src/domain/state/initial-state';
import { WorldStateSchema } from '../../src/domain/state/schema';
import { SaveRepository, type SaveFaultStage } from '../../electron/persistence/save-repository';

const [rootPath, faultStage] = process.argv.slice(2) as [string | undefined, SaveFaultStage | undefined];
if (!rootPath || !faultStage) throw new Error('Expected save root and fault stage.');

const repository = new SaveRepository(rootPath, (stage) => {
  if (stage === faultStage) process.kill(process.pid, 'SIGKILL');
});
const state = WorldStateSchema.parse({ ...createInitialState(), revision: 2 });
await repository.save(SaveRequestSchema.parse({
  slotId: 'slot-001',
  expectedSaveGeneration: 1,
  trigger: 'manual',
  state,
}));
process.exitCode = 2;
