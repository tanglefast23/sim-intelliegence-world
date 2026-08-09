import { parseWorldState, type WorldState } from '../state/schema';
import { reduceCommand, type CommandResult } from './reducer';
import { DomainCommandSchema, type DomainCommand } from './types';

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function orderCommands(candidates: readonly DomainCommand[]): DomainCommand[] {
  const commands = candidates.map((candidate) => DomainCommandSchema.parse(candidate));
  const commandIds = commands.map(({ commandId }) => commandId);
  if (new Set(commandIds).size !== commandIds.length) {
    throw new Error('Command IDs must be unique within a queue.');
  }
  return commands.sort((left, right) => (
    left.scheduledMinute - right.scheduledMinute ||
    left.priority - right.priority ||
    compareAscii(left.commandId, right.commandId)
  ));
}

export type CommandQueueResult = Readonly<{
  state: WorldState;
  results: readonly CommandResult[];
}>;

export function processCommandQueue(
  initialState: WorldState,
  candidates: readonly DomainCommand[],
): CommandQueueResult {
  let state = parseWorldState(initialState);
  const results: CommandResult[] = [];
  for (const command of orderCommands(candidates)) {
    const result = reduceCommand(state, command);
    state = result.state;
    results.push(result);
  }
  return { state, results };
}
