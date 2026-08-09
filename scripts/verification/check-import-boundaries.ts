import { relative } from 'node:path';
import process from 'node:process';

import { scanPureRoots } from './import-boundaries';

const repositoryRoot = process.cwd();
const violations = scanPureRoots(repositoryRoot);
if (violations.length > 0) {
  for (const violation of violations) {
    console.error(
      `${relative(repositoryRoot, violation.file)}:${violation.line}: forbidden import ${violation.moduleName}`,
    );
  }
  process.exitCode = 1;
} else {
  console.log('Pure-module import boundaries: valid');
}
