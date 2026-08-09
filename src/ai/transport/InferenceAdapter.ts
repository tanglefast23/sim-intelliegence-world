export type InferenceMessage = Readonly<{
  role: 'system' | 'user';
  content: string;
}>;

export type InferenceRequest<T> = Readonly<{
  messages: readonly InferenceMessage[];
  schemaName: string;
  jsonSchema: Readonly<Record<string, unknown>>;
  parse: (source: string) => T;
}>;

export interface InferenceAdapter {
  infer<T>(request: InferenceRequest<T>): Promise<T>;
}
