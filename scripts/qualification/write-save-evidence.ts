import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { migrateStateCopy } from '../../src/domain/state/migrations';
import { resolveTestedCommit } from './tested-commit';

async function main(): Promise<void> {
  const testedCommit = resolveTestedCommit();
  const fixturePath = resolve('tests/fixtures/saves/legacy-v1.json');
  const outputPath = resolve('artifacts/phase-14/save/migration.json');
  const source = await readFile(fixturePath, 'utf8');
  const sourceHash = createHash('sha256').update(source).digest('hex');
  const parsed = JSON.parse(source) as unknown;
  const before = JSON.stringify(parsed);
  const migrated = migrateStateCopy(parsed, 'generation-phase-14-migrated');
  if (JSON.stringify(parsed) !== before) throw new Error('Compatible migration modified its source object.');
  if (migrated.schemaVersion !== 5) throw new Error('Compatible migration did not reach schema version 5.');

  const unsupported = { schemaVersion: 99, data: 'preserve me' };
  const unsupportedBefore = JSON.stringify(unsupported);
  let unavailableMigrationError = '';
  try {
    migrateStateCopy(unsupported, 'generation-phase-14-unsupported');
  } catch (error) {
    unavailableMigrationError = error instanceof Error ? error.message : String(error);
  }
  if (!unavailableMigrationError.includes('No compatible state migration')) {
    throw new Error('Unavailable migration did not fail with the expected safe error.');
  }
  if (JSON.stringify(unsupported) !== unsupportedBefore) {
    throw new Error('Unavailable migration modified its source object.');
  }

  await mkdir(resolve(outputPath, '..'), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify({
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    testedCommit,
    fixture: 'tests/fixtures/saves/legacy-v1.json',
    fixtureSha256: sourceHash,
    compatibleMigration: {
      fromSchemaVersion: 1,
      toSchemaVersion: migrated.schemaVersion,
      sourceUnchanged: true,
      generationId: migrated.generationId,
      pins: {
        engineVersion: migrated.engineVersion,
        contentVersion: migrated.contentVersion,
        promptVersion: migrated.promptVersion,
        modelContractVersion: migrated.modelContractVersion,
        model: migrated.modelPin,
      },
    },
    unavailableMigration: {
      fromSchemaVersion: 99,
      rejected: true,
      sourceUnchanged: true,
      errorClass: 'No compatible state migration',
    },
  }, null, 2)}\n`, { encoding: 'utf8', flush: true });
  process.stdout.write(`Save migration evidence: ${outputPath}\n`);
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
