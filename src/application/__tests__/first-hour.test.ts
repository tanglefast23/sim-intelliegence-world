import golden from '../../../tests/fixtures/first-hour/golden.json';
import { WorldStateSchema } from '../../domain/state/schema';
import { runFirstHourGolden, summarizeFirstHour } from '../runtime/first-hour-golden';

describe('first-hour vertical slice', () => {
  test('matches the locked deterministic outcome', () => {
    const result = runFirstHourGolden();
    expect(result.summary).toEqual(golden);
  });

  test('save and load preserve the exact one-hour checkpoint', () => {
    const result = runFirstHourGolden();
    const loaded = WorldStateSchema.parse(JSON.parse(JSON.stringify(result.state)) as unknown);
    expect(summarizeFirstHour(loaded)).toEqual(result.summary);
    expect(loaded).toEqual(result.state);
  });
});
