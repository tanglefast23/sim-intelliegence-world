import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { FakeInferenceAdapter } from '../transport/FakeInferenceAdapter';
import {
  parseSpikeResponseJson,
  spikeResponseJsonSchema,
} from '../schemas/spike-response';

const fixtureRoot = join(process.cwd(), 'tests/fixtures/model');

async function fixture(name: string): Promise<string> {
  return readFile(join(fixtureRoot, `${name}.json`), 'utf8');
}

describe('model response contract', () => {
  it('accepts the valid recorded response through the fake adapter', async () => {
    const adapter = new FakeInferenceAdapter([await fixture('valid')]);
    const response = await adapter.infer({
      messages: [{ role: 'user', content: 'What is happening at the docks?' }],
      schemaName: 'spike_response',
      jsonSchema: spikeResponseJsonSchema,
      parse: parseSpikeResponseJson,
    });

    expect(response.dialogue).toBe('The ferry is late again.');
    expect(adapter.requests).toHaveLength(1);
  });

  it.each(['invalid', 'duplicate', 'truncated', 'hostile'])(
    'rejects the %s recorded response',
    async (name) => {
      const source = await fixture(name);
      expect(() => parseSpikeResponseJson(source)).toThrow();
    },
  );

  it('publishes a closed JSON Schema for llama-server constraints', () => {
    expect(spikeResponseJsonSchema).toMatchObject({
      additionalProperties: false,
      required: ['dialogue', 'emotion', 'intent', 'action', 'persistentCandidates'],
      type: 'object',
    });
  });
});
