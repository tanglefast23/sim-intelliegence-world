import { randomBytes } from 'node:crypto';
import { spawn, type SpawnOptions } from 'node:child_process';
import type { Readable } from 'node:stream';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';

import { ModelClient, type CompletionRequest } from './model-client';
import { reserveLoopbackPort, type ReservedPort } from './port';

const FIVE_MINUTES = 5 * 60 * 1_000;
const MAX_RESTARTS_PER_WINDOW = 2;
const MAX_START_ATTEMPTS = 3;
const DEFAULT_STARTUP_TIMEOUT = 120_000;
const DEFAULT_STOP_TIMEOUT = 3_000;
const MAX_LOG_CHARACTERS = 8_192;

export type ModelSupervisorState =
  | 'stopped'
  | 'starting'
  | 'ready'
  | 'stopping'
  | 'failed'
  | 'circuit-open';

export type ModelRuntimeConfig = Readonly<{
  executablePath: string;
  modelPath: string;
  workingDirectory: string;
  temporaryRoot: string;
  parentGuardPath?: string;
  startupTimeoutMilliseconds?: number;
  stopTimeoutMilliseconds?: number;
  allowLifecycleFaultInjection?: boolean;
}>;

export type SupervisorInferenceRequest<T> = CompletionRequest &
  Readonly<{
    parse: (source: string) => T;
    fallback: T;
  }>;

export type SupervisorInferenceResult<T> = Readonly<{
  value: T;
  source: 'model' | 'authored-fallback';
  attempts: 1 | 2;
}>;

type RuntimeChild = Readonly<{
  stdout: Readable;
  stderr: Readable;
  exitCode: number | null;
  kill: (signal?: NodeJS.Signals) => boolean;
  once: (event: 'error' | 'close', listener: (...args: unknown[]) => void) => RuntimeChild;
}>;

type SpawnProcess = (command: string, args: readonly string[], options: SpawnOptions) => RuntimeChild;
type ReservePort = () => Promise<ReservedPort>;

export type ModelSupervisorDependencies = Readonly<{
  spawnProcess?: SpawnProcess;
  reservePort?: ReservePort;
  now?: () => number;
  delay?: (milliseconds: number) => Promise<void>;
  createClient?: (baseUrl: string, apiKey: string) => ModelClient;
}>;

function defaultDelay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function assertAbsoluteRuntimePaths(config: ModelRuntimeConfig): void {
  for (const candidate of [
    config.executablePath,
    config.modelPath,
    config.workingDirectory,
    config.temporaryRoot,
    ...(config.parentGuardPath ? [config.parentGuardPath] : []),
  ]) {
    if (!isAbsolute(candidate)) {
      throw new Error('Model runtime paths must be absolute.');
    }
  }
}

export function buildLlamaServerArguments(
  modelPath: string,
  keyFilePath: string,
  port: number,
): string[] {
  if (!isAbsolute(modelPath) || !isAbsolute(keyFilePath)) {
    throw new Error('llama-server model and key paths must be absolute.');
  }
  if (!Number.isInteger(port) || port < 49_152 || port > 65_535) {
    throw new Error('llama-server port must be a high port.');
  }
  return [
    '--model',
    modelPath,
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--api-key-file',
    keyFilePath,
    '--offline',
    '--no-ui',
    '--cors-origins',
    'localhost',
    '--no-cors-credentials',
    '--ctx-size',
    '8192',
    '--parallel',
    '1',
    '--reasoning',
    'off',
    '--log-disable',
  ];
}

export class ModelSupervisor {
  readonly #spawnProcess: SpawnProcess;
  readonly #reservePort: ReservePort;
  readonly #now: () => number;
  readonly #delay: (milliseconds: number) => Promise<void>;
  readonly #createClient: (baseUrl: string, apiKey: string) => ModelClient;
  readonly #restartTimes: number[] = [];
  #state: ModelSupervisorState = 'stopped';
  #child: RuntimeChild | undefined;
  #client: ModelClient | undefined;
  #runDirectory: string | undefined;
  #apiKey: string | undefined;
  #port: number | undefined;
  #logs = '';
  #sawLoadingHealth = false;
  #desiredRunning = false;
  #circuitOpen = false;
  #startPromise: Promise<void> | undefined;
  #queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly config: ModelRuntimeConfig,
    dependencies: ModelSupervisorDependencies = {},
  ) {
    assertAbsoluteRuntimePaths(config);
    this.#spawnProcess = dependencies.spawnProcess ?? (spawn as unknown as SpawnProcess);
    this.#reservePort = dependencies.reservePort ?? reserveLoopbackPort;
    this.#now = dependencies.now ?? Date.now;
    this.#delay = dependencies.delay ?? defaultDelay;
    this.#createClient =
      dependencies.createClient ??
      ((baseUrl, apiKey) => new ModelClient({ baseUrl, apiKey }));
  }

  get state(): ModelSupervisorState {
    return this.#state;
  }

  get boundedLogs(): string {
    return this.#logs;
  }

  get sawLoadingHealth(): boolean {
    return this.#sawLoadingHealth;
  }

  async start(): Promise<void> {
    if (this.#circuitOpen) {
      throw new Error('Model runtime circuit breaker is open.');
    }
    this.#desiredRunning = true;
    if (this.#state === 'ready') {
      return;
    }
    if (!this.#startPromise) {
      this.#startPromise = this.#startInternal().finally(() => {
        this.#startPromise = undefined;
      });
    }
    return this.#startPromise;
  }

  async #startInternal(): Promise<void> {
    this.#sawLoadingHealth = false;
    await mkdir(this.config.temporaryRoot, { recursive: true, mode: 0o700 });
    await this.#removeStaleRunDirectories();
    const deadline = this.#now() + (this.config.startupTimeoutMilliseconds ?? DEFAULT_STARTUP_TIMEOUT);
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_START_ATTEMPTS && this.#now() < deadline; attempt += 1) {
      this.#state = 'starting';
      try {
        await this.#startAttempt(deadline);
        return;
      } catch (error) {
        lastError = error;
        this.#state = 'failed';
        if (!this.#desiredRunning || this.#circuitOpen) {
          throw error;
        }
      }
    }

    this.#desiredRunning = false;
    throw new Error(`llama-server failed to start after ${MAX_START_ATTEMPTS} port attempts.`, {
      cause: lastError,
    });
  }

  async #startAttempt(deadline: number): Promise<void> {
    const runDirectory = await mkdtemp(join(this.config.temporaryRoot, 'llama-run-'));
    const apiKey = randomBytes(32).toString('hex');
    const keyFilePath = join(runDirectory, 'api-key');
    await writeFile(keyFilePath, `${apiKey}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });

    let reservation: ReservedPort | undefined;
    try {
      reservation = await this.#reservePort();
      const reservedPort = reservation.port;
      const args = buildLlamaServerArguments(this.config.modelPath, keyFilePath, reservedPort);
      await reservation.release();
      reservation = undefined;

      const spawnExecutable = this.config.parentGuardPath ?? this.config.executablePath;
      const spawnArguments = this.config.parentGuardPath
        ? [this.config.executablePath, ...args]
        : args;
      const child = this.#spawnProcess(spawnExecutable, spawnArguments, {
        cwd: this.config.workingDirectory,
        detached: false,
        env: {
          LANG: 'C',
          LC_ALL: 'C',
          NODE_ENV: 'production',
          TMPDIR: runDirectory,
        },
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      this.#child = child;
      this.#runDirectory = runDirectory;
      this.#apiKey = apiKey;
      this.#port = reservedPort;
      this.#client = this.#createClient(`http://127.0.0.1:${this.#port}`, apiKey);
      child.stdout.resume();
      child.stderr.resume();
      child.once('error', (...details) => this.#captureLog(`process error: ${String(details[0])}`));
      child.once('close', () => {
        void this.#handleClose(child);
      });
      await this.#waitUntilReady(child, deadline);
      if (child !== this.#child || child.exitCode !== null) {
        throw new Error('llama-server exited while completing startup.');
      }
      this.#state = 'ready';
    } catch (error) {
      if (reservation) {
        await reservation.release();
      }
      this.#state = 'failed';
      await this.#terminateChild();
      await this.#removeRunDirectory(runDirectory);
      throw error;
    }
  }

  async #waitUntilReady(child: RuntimeChild, deadline: number): Promise<void> {
    let waitMilliseconds = 10;
    while (this.#now() < deadline) {
      if (child.exitCode !== null) {
        throw new Error('llama-server exited before it became ready.');
      }
      try {
        const health = await this.#client?.health(AbortSignal.timeout(2_000));
        if (health === 'loading') {
          this.#sawLoadingHealth = true;
        }
        if (health === 'ready') {
          return;
        }
      } catch {
        // A refused connection is expected while the process binds and loads the model.
      }
      await this.#delay(waitMilliseconds);
      waitMilliseconds = Math.min(waitMilliseconds * 2, 250);
    }
    throw new Error('llama-server did not become ready before the startup deadline.');
  }

  infer<T>(request: SupervisorInferenceRequest<T>): Promise<SupervisorInferenceResult<T>> {
    const operation = this.#queue.then(async () => {
      if (this.#state !== 'ready' || !this.#client) {
        return { value: request.fallback, source: 'authored-fallback' as const, attempts: 1 as const };
      }
      for (const attempt of [1, 2] as const) {
        try {
          const source = await this.#client.complete(request, AbortSignal.timeout(30_000));
          return { value: request.parse(source), source: 'model' as const, attempts: attempt };
        } catch {
          if (attempt === 2) {
            return {
              value: request.fallback,
              source: 'authored-fallback' as const,
              attempts: 2 as const,
            };
          }
        }
      }
      return { value: request.fallback, source: 'authored-fallback' as const, attempts: 2 as const };
    });
    this.#queue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  killForLifecycleVerification(): void {
    if (!this.config.allowLifecycleFaultInjection) {
      throw new Error('Model lifecycle fault injection is disabled.');
    }
    if (!this.#child || this.#child.exitCode !== null) {
      throw new Error('No running llama-server process is available for fault injection.');
    }
    const verificationSignal: NodeJS.Signals = this.config.parentGuardPath ? 'SIGUSR1' : 'SIGKILL';
    if (!this.#child.kill(verificationSignal)) {
      throw new Error('Could not signal llama-server for fault injection.');
    }
    this.#state = 'failed';
  }

  async stop(): Promise<void> {
    this.#desiredRunning = false;
    if (this.#state === 'stopped' && !this.#child) {
      return;
    }
    this.#state = 'stopping';
    await this.#terminateChild();
    if (this.#runDirectory) {
      await this.#removeRunDirectory(this.#runDirectory);
    }
    this.#client = undefined;
    this.#apiKey = undefined;
    this.#port = undefined;
    this.#state = 'stopped';
  }

  async #terminateChild(): Promise<void> {
    const child = this.#child;
    if (!child) {
      return;
    }
    this.#child = undefined;
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      const closed = await this.#waitForClose(
        child,
        this.config.stopTimeoutMilliseconds ?? DEFAULT_STOP_TIMEOUT,
      );
      if (!closed && child.exitCode === null) {
        child.kill('SIGKILL');
        const forcedClosed = await this.#waitForClose(child, 1_000);
        if (!forcedClosed && child.exitCode === null) {
          throw new Error('llama-server did not exit after the forced stop.');
        }
      }
    }
  }

  async #waitForClose(child: RuntimeChild, timeoutMilliseconds: number): Promise<boolean> {
    if (child.exitCode !== null) {
      return true;
    }
    return new Promise<boolean>((resolveClose) => {
      let settled = false;
      const settle = (closed: boolean): void => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          resolveClose(closed);
        }
      };
      const timeout = setTimeout(() => settle(false), timeoutMilliseconds);
      child.once('close', () => settle(true));
    });
  }

  async #handleClose(child: RuntimeChild): Promise<void> {
    if (child !== this.#child) {
      return;
    }
    const closedDuringStartup = this.#state === 'starting';
    this.#child = undefined;
    this.#client = undefined;
    this.#apiKey = undefined;
    this.#port = undefined;
    if (closedDuringStartup) {
      this.#state = 'failed';
    }
    if (this.#runDirectory) {
      await this.#removeRunDirectory(this.#runDirectory);
    }
    if (closedDuringStartup) {
      return;
    }
    if (!this.#desiredRunning || this.#state === 'stopping') {
      this.#state = 'stopped';
      return;
    }
    const threshold = this.#now() - FIVE_MINUTES;
    const recent = this.#restartTimes.filter((timestamp) => timestamp > threshold);
    this.#restartTimes.splice(0, this.#restartTimes.length, ...recent);
    if (recent.length >= MAX_RESTARTS_PER_WINDOW) {
      this.#state = 'circuit-open';
      this.#circuitOpen = true;
      this.#desiredRunning = false;
      return;
    }
    this.#restartTimes.push(this.#now());
    this.#state = 'failed';
    await this.#delay(Math.min(250 * 2 ** (this.#restartTimes.length - 1), 1_000));
    if (this.#desiredRunning) {
      await this.start().catch(() => {
        this.#state = 'failed';
      });
    }
  }

  #captureLog(source: string): void {
    const redactedKey = this.#apiKey ? source.replaceAll(this.#apiKey, '[REDACTED]') : source;
    const redactedExecutable = redactedKey
      .replaceAll(this.config.modelPath, '[MODEL]')
      .replaceAll(this.config.executablePath, '[EXECUTABLE]');
    const redacted = this.config.parentGuardPath
      ? redactedExecutable.replaceAll(this.config.parentGuardPath, '[PARENT_GUARD]')
      : redactedExecutable;
    this.#logs = `${this.#logs}${redacted}`.slice(-MAX_LOG_CHARACTERS);
  }

  async #removeRunDirectory(runDirectory: string): Promise<void> {
    const relativeRunDirectory = relative(this.config.temporaryRoot, runDirectory);
    if (
      relativeRunDirectory === '' ||
      relativeRunDirectory.startsWith('..') ||
      isAbsolute(relativeRunDirectory)
    ) {
      throw new Error('Refusing to remove a model run directory outside the temporary root.');
    }
    await rm(runDirectory, { recursive: true, force: true });
    if (this.#runDirectory === runDirectory) {
      this.#runDirectory = undefined;
    }
  }

  async #removeStaleRunDirectories(): Promise<void> {
    const entries = await readdir(this.config.temporaryRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && /^llama-run-[A-Za-z0-9]+$/u.test(entry.name)) {
        await rm(join(this.config.temporaryRoot, entry.name), { recursive: true, force: true });
      }
    }
  }
}
