import { readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import process from 'node:process';

function jsonFilesUnder(path: string): string[] {
  try {
    return readdirSync(path).flatMap((entry) => {
      const entryPath = join(path, entry);
      return statSync(entryPath).isDirectory()
        ? jsonFilesUnder(entryPath)
        : extname(entryPath) === '.json'
          ? [entryPath]
          : [];
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

const authoredJson = jsonFilesUnder(join(process.cwd(), 'content'));
if (authoredJson.length > 0) {
  throw new Error(
    `Phase 1 has no content schemas. Refusing to accept unvalidated files: ${authoredJson.join(', ')}`,
  );
}

console.log('Content validation: no authored structured content before Phase 5');
