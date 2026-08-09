import { z } from 'zod';

const HealthBodySchema = z.object({ status: z.string() }).passthrough();
const CompletionBodySchema = z
  .object({
    choices: z
      .array(
        z
          .object({ message: z.object({ content: z.string() }).passthrough() })
          .passthrough(),
      )
      .min(1),
  })
  .passthrough();

const MAX_HTTP_RESPONSE_BYTES = 64 * 1_024;

export type HealthState = 'loading' | 'ready';

export type ModelClientOptions = Readonly<{
  baseUrl: string;
  apiKey: string;
  fetchImplementation?: typeof fetch;
}>;

export type CompletionRequest = Readonly<{
  messages: readonly Readonly<{ role: 'system' | 'user'; content: string }>[];
  schemaName: string;
  jsonSchema: Readonly<Record<string, unknown>>;
  maxTokens?: number;
}>;

async function boundedResponseText(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_HTTP_RESPONSE_BYTES) {
    throw new Error('Model HTTP response exceeds the byte limit.');
  }
  const source = await response.text();
  if (new TextEncoder().encode(source).byteLength > MAX_HTTP_RESPONSE_BYTES) {
    throw new Error('Model HTTP response exceeds the byte limit.');
  }
  return source;
}

export class ModelClient {
  readonly #fetch: typeof fetch;

  constructor(private readonly options: ModelClientOptions) {
    const parsedUrl = new URL(options.baseUrl);
    const port = Number(parsedUrl.port);
    if (
      parsedUrl.protocol !== 'http:' ||
      parsedUrl.hostname !== '127.0.0.1' ||
      !Number.isInteger(port) ||
      port < 49_152 ||
      port > 65_535 ||
      parsedUrl.username !== '' ||
      parsedUrl.password !== '' ||
      parsedUrl.pathname !== '/' ||
      parsedUrl.search !== '' ||
      parsedUrl.hash !== ''
    ) {
      throw new Error('Model client requires a loopback HTTP URL.');
    }
    if (!/^[a-f0-9]{64}$/u.test(options.apiKey)) {
      throw new Error('Model client requires a 256-bit hexadecimal API key.');
    }
    this.#fetch = options.fetchImplementation ?? fetch;
  }

  async health(signal?: AbortSignal): Promise<HealthState> {
    const response = await this.#fetch(`${this.options.baseUrl}/health`, {
      headers: { Authorization: `Bearer ${this.options.apiKey}` },
      redirect: 'error',
      signal,
    });
    if (response.status === 503) {
      return 'loading';
    }
    if (response.status !== 200) {
      throw new Error(`Model health request failed with status ${response.status}.`);
    }
    HealthBodySchema.parse(JSON.parse(await boundedResponseText(response)) as unknown);
    return 'ready';
  }

  async complete(request: CompletionRequest, signal?: AbortSignal): Promise<string> {
    if (!/^[a-z][a-z0-9_]{0,63}$/u.test(request.schemaName)) {
      throw new Error('Model schema name is invalid.');
    }
    if (request.messages.length === 0 || request.messages.length > 16) {
      throw new Error('Model message count is outside the allowed range.');
    }
    const messageBytes = request.messages.reduce(
      (total, message) => total + new TextEncoder().encode(message.content).byteLength,
      0,
    );
    if (messageBytes > 32 * 1_024) {
      throw new Error('Model messages exceed the byte limit.');
    }
    const response = await this.#fetch(`${this.options.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: request.messages,
        stream: false,
        max_tokens: Math.min(Math.max(request.maxTokens ?? 256, 1), 512),
        temperature: 0,
        seed: 1,
        reasoning_effort: 'none',
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: request.schemaName,
            strict: true,
            schema: request.jsonSchema,
          },
        },
      }),
      redirect: 'error',
      signal,
    });
    if (!response.ok) {
      throw new Error(`Model completion failed with status ${response.status}.`);
    }
    const parsed = CompletionBodySchema.parse(
      JSON.parse(await boundedResponseText(response)) as unknown,
    );
    return parsed.choices[0]?.message.content ?? '';
  }
}
