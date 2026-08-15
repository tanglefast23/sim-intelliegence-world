import { resolve } from 'node:path';

import {
  findImportBoundaryViolations,
  findRendererNeutralBoundaryViolations,
  findWorldSceneThreeViolations,
  scanPureRoots,
  scanRendererNeutralManifest,
  scanWorldSceneBoundary,
} from '../../../scripts/verification/import-boundaries';

describe('pure-module architecture boundary', () => {
  test('current pure modules contain no platform imports', () => {
    expect(scanPureRoots(process.cwd())).toEqual([]);
    expect(scanRendererNeutralManifest(process.cwd())).toEqual([]);
    expect(scanWorldSceneBoundary(process.cwd())).toEqual([]);
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

  test('Three.js cannot enter pure roots', () => {
    const filePath = resolve(process.cwd(), 'src/world/forbidden-fixture.ts');
    expect(findImportBoundaryViolations("import * as THREE from 'three';", filePath, process.cwd()))
      .toHaveLength(1);
  });

  test('renderer-neutral files allow only the manifest, domain, world, and atlas JSON', () => {
    const filePath = resolve(process.cwd(), 'src/render/world-frame.ts');
    const allowed = [
      "import './camera';",
      "import '../domain/state/schema';",
      "import '../world/maps/schema';",
      "import atlas from '../../assets/generated/atlas-index.json';",
    ].join('\n');
    const forbidden = [
      "import 'three';",
      "import React from 'react';",
      "import '../application/runtime/map-catalog';",
      "const canvas = document.createElement('canvas');",
    ].join('\n');
    expect(findRendererNeutralBoundaryViolations(allowed, filePath, process.cwd())).toEqual([]);
    expect(findRendererNeutralBoundaryViolations(forbidden, filePath, process.cwd())).toHaveLength(4);
  });

  test('renderer-neutral files cannot read clocks, schedule work, or use random values', () => {
    const filePath = resolve(process.cwd(), 'src/render/world-frame.ts');
    const source = [
      'Date.now();',
      'performance.now();',
      'requestAnimationFrame(() => undefined);',
      'setInterval(() => undefined, 10);',
      'setTimeout(() => undefined, 10);',
      'Math.random();',
    ].join('\n');

    expect(findRendererNeutralBoundaryViolations(source, filePath, process.cwd()))
      .toHaveLength(6);
  });

  test('WorldScene cannot own Three.js', () => {
    const filePath = resolve(process.cwd(), 'src/render/WorldScene.tsx');
    expect(findWorldSceneThreeViolations("import * as THREE from 'three';\nconst scene = new THREE.Scene();", filePath))
      .toHaveLength(3);
    expect(findWorldSceneThreeViolations('const scene = new Scene();', filePath)).toHaveLength(1);
  });

  test('a relative import cannot leave the pure roots', () => {
    const filePath = resolve(process.cwd(), 'src/domain/forbidden-fixture.ts');
    const escapedSource = "import '../../../scripts/verification/import-boundaries';";
    const pureSource = "import { createPrng } from './prng';";

    expect(findImportBoundaryViolations(escapedSource, filePath, process.cwd())).toHaveLength(1);
    expect(findImportBoundaryViolations(pureSource, filePath, process.cwd())).toEqual([]);
  });
});
