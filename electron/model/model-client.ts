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
  now?: () => number;
}>;

export type CompletionRequest = Readonly<{
  messages: readonly Readonly<{ role: 'system' | 'user'; content: string }>[];
  schemaName: string;
  jsonSchema: Readonly<Record<string, unknown>>;
  maxTokens?: number;
}>;

export type BufferedCompletionTiming = Readonly<{
  content: string;
  firstTokenMilliseconds: number;
  totalMilliseconds: number;
  promptTokens: number | null;
  completionTokens: number | null;
  predictedTokensPerSecond: number | null;
}>;

const MAX_STREAM_RESPONSE_BYTES = 256 * 1_024;

function assertCompletionRequest(request: CompletionRequest): void {
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
}

function completionBody(request: CompletionRequest, stream: boolean): Record<string, unknown> {
  return {
    messages: request.messages,
    stream,
    ...(stream ? { stream_options: { include_usage: true } } : {}),
    timings_per_token: stream,
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
  };
}

function finiteMetric(candidate: unknown): number | null {
  return typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0
    ? candidate
    : null;
}

function objectValue(candidate: unknown): Record<string, unknown> | undefined {
  return candidate !== null && typeof candidate === 'object' && !Array.isArray(candidate)
    ? candidate as Record<string, unknown>
    : undefined;
}

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
  readonly #now: () => number;

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
    this.#now = options.now ?? performance.now.bind(performance);
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
    assertCompletionRequest(request);
    const response = await this.#fetch(`${this.options.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(completionBody(request, false)),
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

  async completeBufferedWithTimings(
    request: CompletionRequest,
    signal?: AbortSignal,
  ): Promise<BufferedCompletionTiming> {
    assertCompletionRequest(request);
    const startedAt = this.#now();
    const response = await this.#fetch(`${this.options.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(completionBody(request, true)),
      redirect: 'error',
      signal,
    });
    if (!response.ok || !response.body) {
      throw new Error(`Model streamed completion failed with status ${response.status}.`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    let responseBytes = 0;
    let content = '';
    let firstContentAt: number | undefined;
    let promptTokens: number | null = null;
    let completionTokens: number | null = null;
    let predictedTokensPerSecond: number | null = null;

    const consumeLine = (line: string): void => {
      if (!line.startsWith('data:')) return;
      const data = line.slice(5).trim();
      if (data === '' || data === '[DONE]') return;
      const event = objectValue(JSON.parse(data) as unknown);
      if (!event) throw new Error('Model stream event is not an object.');
      const choices = Array.isArray(event.choices) ? event.choices : [];
      const firstChoice = objectValue(choices[0]);
      const delta = objectValue(firstChoice?.delta);
      const fragment = typeof delta?.content === 'string' ? delta.content : '';
      if (fragment !== '') {
        firstContentAt ??= this.#now();
        content += fragment;
        if (new TextEncoder().encode(content).byteLength > MAX_HTTP_RESPONSE_BYTES) {
          throw new Error('Model completion content exceeds the byte limit.');
        }
      }
      const usage = objectValue(event.usage);
      promptTokens = finiteMetric(usage?.prompt_tokens) ?? promptTokens;
      completionTokens = finiteMetric(usage?.completion_tokens) ?? completionTokens;
      const timings = objectValue(event.timings);
      predictedTokensPerSecond = finiteMetric(timings?.predicted_per_second)
        ?? predictedTokensPerSecond;
      promptTokens = finiteMetric(timings?.prompt_n) ?? promptTokens;
      completionTokens = finiteMetric(timings?.predicted_n) ?? completionTokens;
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      responseBytes += value.byteLength;
      if (responseBytes > MAX_STREAM_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('Model stream exceeds the byte limit.');
      }
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split(/\r?\n/u);
      pending = lines.pop() ?? '';
      lines.forEach(consumeLine);
    }
    pending += decoder.decode();
    pending.split(/\r?\n/u).forEach(consumeLine);
    if (content === '' || firstContentAt === undefined) {
      throw new Error('Model stream did not contain completion content.');
    }
    const totalMilliseconds = this.#now() - startedAt;
    const firstTokenMilliseconds = firstContentAt - startedAt;
    const computedTokensPerSecond = completionTokens && totalMilliseconds > firstTokenMilliseconds
      ? completionTokens / ((totalMilliseconds - firstTokenMilliseconds) / 1_000)
      : null;
    return {
      content,
      firstTokenMilliseconds,
      totalMilliseconds,
      promptTokens,
      completionTokens,
      predictedTokensPerSecond: predictedTokensPerSecond ?? computedTokensPerSecond,
    };
  }
}
