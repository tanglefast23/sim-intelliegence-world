import { existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const phase = process.argv[2];
const ownedPaths: Record<string, readonly string[]> = {
  art: ['assets/source', 'assets/generated', 'scripts/art'],
  electron: ['electron', 'forge.config.ts'],
};

if (!phase || !(phase in ownedPaths)) {
  throw new Error(`Unknown deferred phase check: ${String(phase)}`);
}

const unexpectedPaths = ownedPaths[phase]?.filter((path) => existsSync(join(process.cwd(), path))) ?? [];
if (unexpectedPaths.length > 0) {
  throw new Error(
    `${phase} implementation exists but its real verification command has not replaced the Phase 1 guard: ${unexpectedPaths.join(', ')}`,
  );
}

console.log(`${phase} verification: deferred owner paths are absent`);
