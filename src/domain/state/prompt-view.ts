import { clockParts } from '../clock/clock';
import type { WorldState } from './schema';

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stableEntries<T>(record: Readonly<Record<string, T>>): Array<readonly [string, T]> {
  return Object.entries(record).sort(([left], [right]) => compareAscii(left, right));
}

export function generatePromptView(state: WorldState): string {
  const time = clockParts(state.clock.absoluteMinute);
  const lines = [
    '# Disposable world view',
    '',
    `State revision: ${state.revision}`,
    `Time: day ${time.day}, ${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`,
    `Protagonist: ${state.protagonist.displayName} at ${state.protagonist.locationId}`,
    '',
    '## NPCs',
  ];
  for (const [npcId, npc] of stableEntries(state.npcs)) {
    const relationship = state.relationships[npcId];
    const presence = npc.presence.kind === 'active_local'
      ? npc.presence.locationId
      : npc.presence.kind === 'in_transit'
        ? `in transit (${npc.presence.transferId})`
        : `inactive at ${npc.presence.destinationLocationId}`;
    lines.push(
      relationship
        ? `- ${npcId}: ${npc.tier}, ${presence}; familiarity ${relationship.values.familiarity}, trust ${relationship.values.trust}, attraction ${relationship.values.attraction}, stage ${relationship.stage}`
        : `- ${npcId}: ${npc.tier}, ${presence}`,
    );
  }
  lines.push('', '## Factions');
  for (const [factionId, faction] of stableEntries(state.factions)) {
    lines.push(`- ${factionId}: standing ${faction.standing}; revealed ${faction.revealed ? 'yes' : 'no'}`);
  }
  lines.push('', 'This file is a projection. It is not authoritative game state.', '');
  return lines.join('\n');
}
