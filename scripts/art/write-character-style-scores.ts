import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { CHARACTER_LOOKS } from './character-look-roster';
import { loadCharacterSources } from './character-source';
import {
  PROTAGONIST_STYLE_PASS_SCORE,
  scoreCharacterAgainstProtagonist,
} from './character-style-score';

function main(root = process.cwd()): void {
  const outputRoot = resolve(
    root,
    process.argv[2] ?? 'artifacts/phase-24/art-quality/cast-style-final',
  );
  const sources = new Map(loadCharacterSources(root).map((source) => [source.id, source]));
  const scores = CHARACTER_LOOKS.map(({ id }) => {
    const source = sources.get(id);
    if (!source) throw new Error(`Missing character source ${id}.`);
    return scoreCharacterAgainstProtagonist(source);
  });
  const failed = scores.filter(({ passed }) => !passed);
  const report = {
    schemaVersion: 2,
    referenceCharacterId: 'protagonist',
    scoreMeaning: 'A deterministic final-render feature-completeness gate. It checks hair values, eyes, brows, mouth, hands, accessory placement, true profiles, rear facing, identity retention, and pose stability. It is not a subjective art-quality rating.',
    passScore: PROTAGONIST_STYLE_PASS_SCORE,
    reviewOrder: 'character-look-roster',
    allPassed: failed.length === 0,
    minimumScore: Math.min(...scores.map(({ score }) => score)),
    scores,
  };
  mkdirSync(outputRoot, { recursive: true });
  const output = resolve(outputRoot, 'protagonist-style-scores.json');
  writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flush: true });
  for (const score of scores) {
    process.stdout.write(
      `${score.passed ? 'PASS' : 'FAIL'} ${score.characterId}: final-render feature completeness ${score.score.toFixed(2)}/10\n`,
    );
  }
  if (failed.length > 0) {
    throw new Error(`${failed.length} characters remain below ${PROTAGONIST_STYLE_PASS_SCORE.toFixed(1)}/10.`);
  }
  process.stdout.write(`Style score report: ${output}\n`);
}

try {
  main();
} catch (error: unknown) {
  process.stderr.write(`Character style scoring failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
