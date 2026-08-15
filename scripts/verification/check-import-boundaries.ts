import { relative } from 'node:path';
import process from 'node:process';

import {
  scanPureRoots,
  scanRendererNeutralManifest,
  scanWorldSceneBoundary,
} from './import-boundaries';

const repositoryRoot = process.cwd();
const violations = [
  ...scanPureRoots(repositoryRoot),
  ...scanRendererNeutralManifest(repositoryRoot),
  ...scanWorldSceneBoundary(repositoryRoot),
];
if (violations.length > 0) {
  for (const violation of violations) {
    console.error(
      `${relative(repositoryRoot, violation.file)}:${violation.line}: forbidden import ${violation.moduleName}`,
    );
  }
  process.exitCode = 1;
} else {
  console.log('Pure and renderer-neutral import boundaries: valid');
}
