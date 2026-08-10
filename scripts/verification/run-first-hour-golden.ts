import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { runFirstHourGolden } from '../../src/application/runtime/first-hour-golden';

const fixture = JSON.parse(readFileSync(resolve('tests/fixtures/first-hour/golden.json'), 'utf8')) as unknown;
const { summary } = runFirstHourGolden();
if (!isDeepStrictEqual(summary, fixture)) {
  process.stderr.write(`First-hour golden mismatch. Actual:\n${JSON.stringify(summary, null, 2)}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`First-hour golden verified: minute ${summary.startMinute} to ${summary.endMinute}, quest ${summary.quest.status}.\n`);
}
