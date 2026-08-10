import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import {
  DEFAULT_PRESENTATION_PREFERENCES,
  PresentationPreferencesSchema,
  RendererPresentationPatchSchema,
  type PresentationPreferences,
  type RendererPresentationPatch,
} from '../../src/application/presentation/preferences';

export function presentationPreferencesPathForUserData(userDataPath: string): string {
  return join(userDataPath, 'si-world', 'presentation-preferences.json');
}

export class PresentationPreferencesRepository {
  readonly #path: string;
  #current: PresentationPreferences | undefined;
  #queue: Promise<void> = Promise.resolve();

  constructor(path: string) {
    this.#path = path;
  }

  async load(): Promise<PresentationPreferences> {
    if (this.#current) return this.#current;
    try {
      const candidate = JSON.parse(await readFile(this.#path, 'utf8')) as unknown;
      this.#current = PresentationPreferencesSchema.parse(candidate);
    } catch (error) {
      const missing = error instanceof Error && 'code' in error && error.code === 'ENOENT';
      if (!missing && error instanceof Error) {
        process.stderr.write(`SI_WORLD_PRESENTATION_PREFERENCES_IGNORED ${error.message}\n`);
      }
      this.#current = DEFAULT_PRESENTATION_PREFERENCES;
    }
    return this.#current;
  }

  async saveRendererPatch(candidate: unknown): Promise<PresentationPreferences> {
    const patch = RendererPresentationPatchSchema.parse(candidate);
    return this.#update(patch);
  }

  async saveWindowSize(candidate: unknown): Promise<PresentationPreferences> {
    const windowSize = PresentationPreferencesSchema.shape.windowSize.unwrap().parse(candidate);
    return this.#update({ windowSize });
  }

  async #update(
    patch: RendererPresentationPatch | Readonly<{ windowSize: NonNullable<PresentationPreferences['windowSize']> }>,
  ): Promise<PresentationPreferences> {
    let result = DEFAULT_PRESENTATION_PREFERENCES;
    const operation = this.#queue.then(async () => {
      const current = await this.load();
      result = PresentationPreferencesSchema.parse({ ...current, ...patch });
      await mkdir(dirname(this.#path), { recursive: true });
      const temporaryPath = `${this.#path}.tmp`;
      await writeFile(temporaryPath, `${JSON.stringify(result, null, 2)}\n`, { encoding: 'utf8', flush: true });
      await rename(temporaryPath, this.#path);
      this.#current = result;
    });
    this.#queue = operation.catch(() => undefined);
    await operation;
    return result;
  }
}
