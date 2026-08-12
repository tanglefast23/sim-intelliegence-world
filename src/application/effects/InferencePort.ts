export type InferenceMessage = Readonly<{
  role: 'system' | 'user';
  content: string;
}>;

export type InferenceCompletionRequest = Readonly<{
  messages: readonly InferenceMessage[];
  schemaName: string;
  jsonSchema: Readonly<Record<string, unknown>>;
  maxTokens: number;
}>;

export interface InferencePort {
  complete(request: InferenceCompletionRequest, signal?: AbortSignal): Promise<string>;
}

export class RecordedInferencePort implements InferencePort {
  readonly requests: InferenceCompletionRequest[] = [];
  readonly #responses: Array<string | Error | ((signal?: AbortSignal) => Promise<string>)>;

  constructor(responses: readonly (string | Error | ((signal?: AbortSignal) => Promise<string>))[]) {
    this.#responses = [...responses];
  }

  async complete(request: InferenceCompletionRequest, signal?: AbortSignal): Promise<string> {
    signal?.throwIfAborted();
    this.requests.push(request);
    const response = this.#responses.shift();
    if (response === undefined) throw new Error('Recorded inference response queue is empty.');
    if (response instanceof Error) throw response;
    return typeof response === 'function' ? response(signal) : response;
  }
}
