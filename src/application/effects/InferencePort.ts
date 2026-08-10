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
  complete(request: InferenceCompletionRequest): Promise<string>;
}

export class RecordedInferencePort implements InferencePort {
  readonly requests: InferenceCompletionRequest[] = [];
  readonly #responses: Array<string | Error | (() => Promise<string>)>;

  constructor(responses: readonly (string | Error | (() => Promise<string>))[]) {
    this.#responses = [...responses];
  }

  async complete(request: InferenceCompletionRequest): Promise<string> {
    this.requests.push(request);
    const response = this.#responses.shift();
    if (response === undefined) throw new Error('Recorded inference response queue is empty.');
    if (response instanceof Error) throw response;
    return typeof response === 'function' ? response() : response;
  }
}
