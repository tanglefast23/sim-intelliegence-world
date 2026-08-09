import { resolve } from 'node:path';

import {
  findImportBoundaryViolations,
  scanPureRoots,
} from '../../../scripts/verification/import-boundaries';

describe('pure-module architecture boundary', () => {
  test('current pure modules contain no platform imports', () => {
    expect(scanPureRoots(process.cwd())).toEqual([]);
  });

  test('an intentionally forbidden platform import is rejected', () => {
    const filePath = resolve(process.cwd(), 'src/domain/forbidden-fixture.ts');
    const source = "import { View } from 'react-native';\nexport const value = View;\n";

    expect(findImportBoundaryViolations(source, filePath, process.cwd())).toEqual([
      expect.objectContaining({ line: 1, moduleName: 'react-native' }),
    ]);
  });

  test('Node import forms cannot bypass the boundary', () => {
    const filePath = resolve(process.cwd(), 'src/domain/forbidden-fixture.ts');
    const source = [
      "import fs = require('fs');",
      "const promises = require('fs/promises');",
      "const electron = import('electron');",
      "export { join } from 'node:path';",
    ].join('\n');

    expect(findImportBoundaryViolations(source, filePath, process.cwd())).toHaveLength(4);
  });

  test('Expo package variants cannot bypass the boundary', () => {
    const filePath = resolve(process.cwd(), 'src/domain/forbidden-fixture.ts');
    const source = [
      "import 'expo-file-system';",
      "import 'expo-audio';",
      "import '@expo/config';",
    ].join('\n');

    expect(findImportBoundaryViolations(source, filePath, process.cwd())).toHaveLength(3);
  });

  test('a relative import cannot leave the pure roots', () => {
    const filePath = resolve(process.cwd(), 'src/domain/forbidden-fixture.ts');
    const escapedSource = "import '../../../scripts/verification/import-boundaries';";
    const pureSource = "import { createPrng } from './prng';";

    expect(findImportBoundaryViolations(escapedSource, filePath, process.cwd())).toHaveLength(1);
    expect(findImportBoundaryViolations(pureSource, filePath, process.cwd())).toEqual([]);
  });
});
