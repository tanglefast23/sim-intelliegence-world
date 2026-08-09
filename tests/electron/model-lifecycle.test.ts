import { EventEmitter } from 'node:events';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';

import type { SpawnOptions } from 'node:child_process';

import { ModelClient } from '../../electron/model/model-client';
import { ModelManifestSchema, verifyArtifact } from '../../electron/model/model-manifest';
import {
  buildLlamaServerArguments,
  ModelSupervisor,
} from '../../electron/model/model-supervisor';
import { reserveLoopbackPort } from '../../electron/model/port';
import { parseSpikeResponseJson } from '../../src/ai/schemas/spike-response';

class FakeChild extends EventEmitter {
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly stdin = null;
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;

  kill(signal: NodeJS.Signals = 'SIGTERM'): boolean {
    this.exitCode = signal === 'SIGKILL' ? 137 : 0;
    this.signalCode = signal;
    queueMicrotask(() => this.emit('close', this.exitCode, signal));
    return true;
  }

  crash(): void {
    this.exitCode = 1;
    this.emit('close', 1, null);
  }
}

class StubbornFakeChild extends FakeChild {
  readonly signals: NodeJS.Signals[] = [];

  override kill(signal: NodeJS.Signals = 'SIGTERM'): boolean {
    this.signals.push(signal);
    if (signal === 'SIGKILL') {
      return super.kill(signal);
    }
    return true;
  }
}

const validResponse =
  '{"dialogue":"Hello.","emotion":"neutral","intent":"greet","action":{"type":"none"},"persistentCandidates":[]}';

async function waitFor(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (condition()) {
      return;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 5));
  }
  throw new Error('Condition did not become true.');
}

describe('local model runtime', () => {
  it('reserves and releases a random high loopback port', async () => {
    const reservation = await reserveLoopbackPort();
    expect(reservation.port).toBeGreaterThanOrEqual(49_152);
    await reservation.release();

    const server = createServer();
    await new Promise<void>((resolveListen, rejectListen) => {
      server.once('error', rejectListen);
      server.listen(reservation.port, '127.0.0.1', resolveListen);
    });
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  });

  it('uses only the pinned safe llama-server argument surface', () => {
    const args = buildLlamaServerArguments('/runtime/llama-server', '/runtime/api-key', 50_001);
    expect(args).toEqual(
      expect.arrayContaining([
        '--host', '127.0.0.1', '--offline', '--no-ui', '--no-cors-credentials',
        '--ctx-size', '8192', '--parallel', '1', '--reasoning', 'off', '--log-disable',
      ]),
    );
    expect(args.join(' ')).not.toMatch(/--tools|--mcp|--agent|--metrics|--media/u);
  });

  it('handles loading and sends constrained completions without exposing the key in the body', async () => {
    const requests: Array<Readonly<{ url: string; init?: RequestInit }>> = [];
    const responses = [
      new Response('{"status":"loading model"}', { status: 503 }),
      new Response('{"status":"ok"}', { status: 200 }),
      new Response(JSON.stringify({ choices: [{ message: { content: validResponse } }] }), { status: 200 }),
    ];
    const client = new ModelClient({
      baseUrl: 'http://127.0.0.1:50001',
      apiKey: 'a'.repeat(64),
      fetchImplementation: (async (input, init) => {
        requests.push({ url: String(input), init });
        return responses.shift() as Response;
      }) as typeof fetch,
    });

    await expect(client.health()).resolves.toBe('loading');
    await expect(client.health()).resolves.toBe('ready');
    await expect(
      client.complete({ messages: [{ role: 'user', content: 'Hello' }], schemaName: 'spike', jsonSchema: {} }),
    ).resolves.toBe(validResponse);
    const completionBody = JSON.parse(String(requests[2]?.init?.body)) as Record<string, unknown>;
    expect(completionBody).toMatchObject({
      reasoning_effort: 'none',
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'spike', strict: true, schema: {} },
      },
    });
    expect(JSON.stringify(completionBody)).not.toContain('a'.repeat(64));
  });

  it('verifies artifact size and SHA-256 before use', async () => {
    const root = await mkdtemp(join(tmpdir(), 'si-world-manifest-'));
    try {
      await writeFile(join(root, 'artifact.bin'), 'verified');
      await expect(
        verifyArtifact(root, {
          fileName: 'artifact.bin',
          sha256: '1c34f88707b55e6104c4eb20e71ffa3d33e414b71ef689a15fad0640d0ac58cb',
          sizeBytes: 8,
        }),
      ).resolves.toBe(join(root, 'artifact.bin'));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it.each([
    'model-manifest.example.json',
    'artifacts/phase-03/model-manifest.darwin-arm64.json',
  ])('validates the tracked provenance manifest: %s', async (manifestPath) => {
    const manifest = JSON.parse(await readFile(join(process.cwd(), manifestPath), 'utf8')) as unknown;
    expect(() => ModelManifestSchema.parse(manifest)).not.toThrow();
  });

  it('keeps generated model binaries, weights, keys, and runtime manifests out of Git', () => {
    const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0');
    expect(tracked).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/\.gguf$/u),
        expect.stringMatching(/(?:^|\/)llama-(?:server|quantize)(?:\.exe)?$/u),
        expect.stringMatching(/runtime-manifest\.json$/u),
        expect.stringMatching(/\.api-key$/u),
      ]),
    );
  });

  it('spawns with isolated options, retries invalid output once, then uses the authored fallback', async () => {
    const root = await mkdtemp(join(tmpdir(), 'si-world-supervisor-'));
    const children: FakeChild[] = [];
    let capturedOptions: SpawnOptions | undefined;
    let capturedArguments: readonly string[] = [];
    const completions = ['invalid', validResponse, 'invalid', 'still invalid'];
    const client = {
      health: jest.fn()
        .mockResolvedValueOnce('loading' as const)
        .mockResolvedValue('ready' as const),
      complete: async () => completions.shift() as string,
    } as unknown as ModelClient;
    const supervisor = new ModelSupervisor(
      {
        executablePath: '/runtime/llama-server',
        modelPath: '/runtime/model.gguf',
        workingDirectory: '/runtime',
        temporaryRoot: root,
      },
      {
        createClient: () => client,
        reservePort: async () => ({ port: 50_001, release: async () => undefined }),
        spawnProcess: ((command: string, args: readonly string[], options: SpawnOptions) => {
          expect(command).toBe('/runtime/llama-server');
          capturedArguments = args;
          capturedOptions = options;
          const child = new FakeChild();
          children.push(child);
          return child;
        }),
      },
    );

    try {
      await supervisor.start();
      expect(supervisor.sawLoadingHealth).toBe(true);
      expect(capturedArguments).toContain('--api-key-file');
      expect(capturedOptions).toMatchObject({ detached: false, shell: false, windowsHide: true });
      expect(Object.keys(capturedOptions?.env ?? {}).sort()).toEqual(['LANG', 'LC_ALL', 'NODE_ENV', 'TMPDIR']);
      const keyFilePath = capturedArguments[capturedArguments.indexOf('--api-key-file') + 1] as string;
      const keyFile = await readFile(keyFilePath, 'utf8');
      expect(keyFile.trim()).toMatch(/^[a-f0-9]{64}$/u);
      expect((await stat(keyFilePath)).mode & 0o777).toBe(0o600);
      children[0]?.stdout.write('private player dialogue /runtime/model.gguf /runtime/llama-server');
      children[0]?.stderr.write('private player dialogue');
      expect(supervisor.boundedLogs).not.toContain('/runtime/model.gguf');
      expect(supervisor.boundedLogs).not.toContain('private player dialogue');

      const fallback = parseSpikeResponseJson(validResponse);
      const recovered = await supervisor.infer({
        messages: [], schemaName: 'spike', jsonSchema: {}, parse: parseSpikeResponseJson, fallback,
      });
      expect(recovered).toMatchObject({ source: 'model', attempts: 2 });
      const failed = await supervisor.infer({
        messages: [], schemaName: 'spike', jsonSchema: {}, parse: parseSpikeResponseJson, fallback,
      });
      expect(failed).toMatchObject({ source: 'authored-fallback', attempts: 2, value: fallback });
      await supervisor.stop();
      expect(supervisor.state).toBe('stopped');
      expect(await readdir(root)).toHaveLength(0);
      expect(children[0]?.signalCode).toBe('SIGTERM');
      await expect(stat(keyFilePath)).rejects.toThrow();
    } finally {
      await supervisor.stop();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('opens the circuit after two bounded restarts in five minutes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'si-world-circuit-'));
    const children: FakeChild[] = [];
    const supervisor = new ModelSupervisor(
      {
        executablePath: '/runtime/llama-server',
        modelPath: '/runtime/model.gguf',
        workingDirectory: '/runtime',
        temporaryRoot: root,
        allowLifecycleFaultInjection: true,
      },
      {
        createClient: () => ({ health: async () => 'ready' as const }) as unknown as ModelClient,
        delay: async () => undefined,
        now: () => 1_000,
        reservePort: async () => ({ port: 50_002, release: async () => undefined }),
        spawnProcess: () => {
          const child = new FakeChild();
          children.push(child);
          return child;
        },
      },
    );

    try {
      await supervisor.start();
      supervisor.killForLifecycleVerification();
      await waitFor(() => children.length === 2 && supervisor.state === 'ready');
      supervisor.killForLifecycleVerification();
      await waitFor(() => children.length === 3 && supervisor.state === 'ready');
      supervisor.killForLifecycleVerification();
      await waitFor(() => supervisor.state === 'circuit-open');
      await expect(supervisor.start()).rejects.toThrow('circuit breaker');
      await supervisor.stop();
      expect(supervisor.state).toBe('stopped');
      await expect(supervisor.start()).rejects.toThrow('circuit breaker');
    } finally {
      await supervisor.stop();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('retries a fresh reserved port when a child exits during startup', async () => {
    const root = await mkdtemp(join(tmpdir(), 'si-world-port-retry-'));
    const children: FakeChild[] = [];
    const reservedPorts = [50_006, 50_007];
    const supervisor = new ModelSupervisor(
      {
        executablePath: '/runtime/llama-server',
        modelPath: '/runtime/model.gguf',
        workingDirectory: '/runtime',
        temporaryRoot: root,
      },
      {
        createClient: (_baseUrl) => ({
          health: async () => children.length === 1 ? 'loading' as const : 'ready' as const,
        }) as unknown as ModelClient,
        delay: async () => undefined,
        reservePort: async () => ({
          port: reservedPorts.shift() as number,
          release: async () => undefined,
        }),
        spawnProcess: () => {
          const child = new FakeChild();
          children.push(child);
          if (children.length === 1) {
            queueMicrotask(() => child.crash());
          }
          return child;
        },
      },
    );

    try {
      await supervisor.start();
      expect(children).toHaveLength(2);
      expect(supervisor.state).toBe('ready');
    } finally {
      await supervisor.stop();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('serializes concurrent inference through one model queue', async () => {
    const root = await mkdtemp(join(tmpdir(), 'si-world-queue-'));
    const child = new FakeChild();
    let activeRequests = 0;
    let maximumActiveRequests = 0;
    const client = {
      health: async () => 'ready' as const,
      complete: async () => {
        activeRequests += 1;
        maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests);
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 5));
        activeRequests -= 1;
        return validResponse;
      },
    } as unknown as ModelClient;
    const supervisor = new ModelSupervisor(
      {
        executablePath: '/runtime/llama-server',
        modelPath: '/runtime/model.gguf',
        workingDirectory: '/runtime',
        temporaryRoot: root,
      },
      {
        createClient: () => client,
        reservePort: async () => ({ port: 50_004, release: async () => undefined }),
        spawnProcess: () => child,
      },
    );

    try {
      await supervisor.start();
      const fallback = parseSpikeResponseJson(validResponse);
      await Promise.all(
        Array.from({ length: 3 }, () =>
          supervisor.infer({
            messages: [{ role: 'user', content: 'hello' }],
            schemaName: 'spike',
            jsonSchema: {},
            parse: parseSpikeResponseJson,
            fallback,
          }),
        ),
      );
      expect(maximumActiveRequests).toBe(1);
    } finally {
      await supervisor.stop();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('waits for a forced stop when graceful shutdown times out', async () => {
    const root = await mkdtemp(join(tmpdir(), 'si-world-forced-stop-'));
    const child = new StubbornFakeChild();
    const supervisor = new ModelSupervisor(
      {
        executablePath: '/runtime/llama-server',
        modelPath: '/runtime/model.gguf',
        workingDirectory: '/runtime',
        temporaryRoot: root,
        stopTimeoutMilliseconds: 5,
      },
      {
        createClient: () => ({ health: async () => 'ready' as const }) as unknown as ModelClient,
        reservePort: async () => ({ port: 50_003, release: async () => undefined }),
        spawnProcess: () => child,
      },
    );

    try {
      await supervisor.start();
      await supervisor.stop();
      expect(child.signals).toEqual(['SIGTERM', 'SIGKILL']);
      expect(supervisor.state).toBe('stopped');
    } finally {
      await supervisor.stop();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('removes stale key directories without touching unrelated data', async () => {
    const root = await mkdtemp(join(tmpdir(), 'si-world-stale-'));
    const staleRoot = join(root, 'llama-run-stale123');
    const unrelatedRoot = join(root, 'player-data');
    await writeFile(join(root, 'keep.txt'), 'keep');
    await mkdir(staleRoot);
    await mkdir(unrelatedRoot);
    await writeFile(join(staleRoot, 'api-key'), 'stale');
    const supervisor = new ModelSupervisor(
      {
        executablePath: '/runtime/llama-server',
        modelPath: '/runtime/model.gguf',
        workingDirectory: '/runtime',
        temporaryRoot: root,
      },
      {
        createClient: () => ({ health: async () => 'ready' as const }) as unknown as ModelClient,
        reservePort: async () => ({ port: 50_005, release: async () => undefined }),
        spawnProcess: () => new FakeChild(),
      },
    );
    try {
      await supervisor.start();
      await expect(stat(staleRoot)).rejects.toThrow();
      await expect(stat(unrelatedRoot)).resolves.toBeDefined();
      await expect(stat(join(root, 'keep.txt'))).resolves.toBeDefined();
    } finally {
      await supervisor.stop();
      await rm(root, { recursive: true, force: true });
    }
  });
});
