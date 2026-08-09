import { z } from 'zod';

export const SpikeResponseSchema = z
  .object({
    dialogue: z.string().min(1).max(280),
    emotion: z.enum(['neutral', 'warm', 'wary', 'angry', 'afraid', 'sad']),
    intent: z.enum(['greet', 'inform', 'ask', 'refuse', 'leave']),
    action: z.object({ type: z.literal('none') }).strict(),
    persistentCandidates: z.array(z.never()).max(0),
  })
  .strict();

export type SpikeResponse = z.infer<typeof SpikeResponseSchema>;

export const spikeResponseJsonSchema = z.toJSONSchema(SpikeResponseSchema, {
  target: 'draft-7',
});

const MAX_RESPONSE_BYTES = 4_096;

function assertNoDuplicateObjectKeys(source: string): void {
  let index = 0;

  function skipWhitespace(): void {
    while (/\s/u.test(source[index] ?? '')) {
      index += 1;
    }
  }

  function parseString(): string {
    const start = index;
    if (source[index] !== '"') {
      throw new Error('Expected a JSON string.');
    }
    index += 1;
    while (index < source.length) {
      const character = source[index];
      if (character === '\\') {
        index += 2;
      } else if (character === '"') {
        index += 1;
        return JSON.parse(source.slice(start, index)) as string;
      } else {
        index += 1;
      }
    }
    throw new Error('Unterminated JSON string.');
  }

  function parseValue(): void {
    skipWhitespace();
    const character = source[index];
    if (character === '{') {
      parseObject();
      return;
    }
    if (character === '[') {
      parseArray();
      return;
    }
    if (character === '"') {
      parseString();
      return;
    }
    const scalar = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/u.exec(
      source.slice(index),
    );
    if (!scalar) {
      throw new Error('Invalid JSON value.');
    }
    index += scalar[0].length;
  }

  function parseArray(): void {
    index += 1;
    skipWhitespace();
    if (source[index] === ']') {
      index += 1;
      return;
    }
    while (true) {
      parseValue();
      skipWhitespace();
      if (source[index] === ']') {
        index += 1;
        return;
      }
      if (source[index] !== ',') {
        throw new Error('Invalid JSON array.');
      }
      index += 1;
    }
  }

  function parseObject(): void {
    index += 1;
    const keys = new Set<string>();
    skipWhitespace();
    if (source[index] === '}') {
      index += 1;
      return;
    }
    while (true) {
      skipWhitespace();
      const key = parseString();
      if (keys.has(key)) {
        throw new Error(`Duplicate JSON key: ${key}`);
      }
      keys.add(key);
      skipWhitespace();
      if (source[index] !== ':') {
        throw new Error('Invalid JSON object.');
      }
      index += 1;
      parseValue();
      skipWhitespace();
      if (source[index] === '}') {
        index += 1;
        return;
      }
      if (source[index] !== ',') {
        throw new Error('Invalid JSON object.');
      }
      index += 1;
    }
  }

  parseValue();
  skipWhitespace();
  if (index !== source.length) {
    throw new Error('Unexpected data after the JSON response.');
  }
}

export function parseSpikeResponseJson(source: string): SpikeResponse {
  if (new TextEncoder().encode(source).byteLength > MAX_RESPONSE_BYTES) {
    throw new Error('Model response exceeds the byte limit.');
  }
  assertNoDuplicateObjectKeys(source);
  return SpikeResponseSchema.parse(JSON.parse(source) as unknown);
}

export const authoredNoChangeResponse: SpikeResponse = {
  dialogue: 'I lost my train of thought. Ask me again in a moment.',
  emotion: 'neutral',
  intent: 'leave',
  action: { type: 'none' },
  persistentCandidates: [],
};
