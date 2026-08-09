import type { InferenceAdapter, InferenceRequest } from './InferenceAdapter';

export class FakeInferenceAdapter implements InferenceAdapter {
  readonly #responses: string[];
  readonly requests: InferenceRequest<unknown>[] = [];

  constructor(responses: readonly string[]) {
    this.#responses = [...responses];
  }

  async infer<T>(request: InferenceRequest<T>): Promise<T> {
    this.requests.push(request as InferenceRequest<unknown>);
    const response = this.#responses.shift();
    if (response === undefined) {
      throw new Error('Fake inference response queue is empty.');
    }
    return request.parse(response);
  }
}
