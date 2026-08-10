import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  APP_CONTENT_SECURITY_POLICY,
  createAppProtocolHandler,
  registerAppSchemePrivileges,
  resolveAppRequest,
} from '../../electron/protocol/app-protocol';
import {
  IPC_CHANNELS,
  IpcRateLimiter,
  RendererReadySchema,
  RuntimeInfoSchema,
  registerRuntimeIpc,
} from '../../electron/ipc/contracts';
import { isTrustedAppUrl, lockedWebPreferences, lockWebContents } from '../../electron/main/security';
import type { IpcMain, IpcMainInvokeEvent, WebContents } from 'electron';
import { PERSISTENCE_IPC_CHANNELS, registerPersistenceIpc } from '../../electron/persistence/ipc';
import { createInitialState } from '../../src/domain/state/initial-state';

describe('secure Electron boundary', () => {
  test('locked renderer preferences are explicit', () => {
    expect(lockedWebPreferences('/safe/preload.js')).toEqual(
      expect.objectContaining({
        allowRunningInsecureContent: false,
        contextIsolation: true,
        nodeIntegration: false,
        preload: '/safe/preload.js',
        sandbox: true,
        webSecurity: true,
        webviewTag: false,
      }),
    );
  });

  test('the app scheme is privileged without bypassing CSP or CORS', () => {
    const registerSchemesAsPrivileged = jest.fn();
    registerAppSchemePrivileges({ registerSchemesAsPrivileged });

    expect(registerSchemesAsPrivileged).toHaveBeenCalledWith([
      expect.objectContaining({
        scheme: 'app',
        privileges: expect.objectContaining({
          bypassCSP: false,
          corsEnabled: false,
          secure: true,
          standard: true,
          supportFetchAPI: true,
        }),
      }),
    ]);
  });

  test.each([
    'https://example.com/',
    'file:///tmp/index.html',
    'app://evil/',
    'app://user@game/',
    'app://game:8123/',
    'not a url',
  ])('unexpected navigation is rejected: %s', (candidate) => {
    expect(isTrustedAppUrl(candidate)).toBe(false);
  });

  test('only the exact app scheme and host are trusted', () => {
    expect(isTrustedAppUrl('app://game/')).toBe(true);
    expect(isTrustedAppUrl('app://game/_expo/chunk.js')).toBe(true);
  });

  test('web contents deny outside navigation, all windows, and all webviews', () => {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const setWindowOpenHandler = jest.fn();
    const contents = {
      on: jest.fn((eventName: string, handler: (...args: unknown[]) => void) => {
        handlers.set(eventName, handler);
      }),
      setWindowOpenHandler,
    } as unknown as WebContents;
    lockWebContents(contents);

    const outsideEvent = { preventDefault: jest.fn() };
    handlers.get('will-navigate')?.(outsideEvent, 'https://example.com/');
    expect(outsideEvent.preventDefault).toHaveBeenCalledTimes(1);

    const insideEvent = { preventDefault: jest.fn() };
    handlers.get('will-navigate')?.(insideEvent, 'app://game/next');
    expect(insideEvent.preventDefault).not.toHaveBeenCalled();

    const webviewEvent = { preventDefault: jest.fn() };
    handlers.get('will-attach-webview')?.(webviewEvent);
    expect(webviewEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(setWindowOpenHandler.mock.calls[0]?.[0]()).toEqual({ action: 'deny' });
  });

  test.each([
    'app://game/%2e%2e/secret',
    'app://game/%2E%2E%2Fsecret',
    'app://game/folder%5csecret',
    'app://evil/index.html',
    'app://game:9999/index.html',
  ])('protocol traversal or authority mismatch is rejected: %s', (requestUrl) => {
    expect(resolveAppRequest(requestUrl, '/safe/dist').ok).toBe(false);
  });

  test('protocol maps root and asset paths inside dist', () => {
    expect(resolveAppRequest('app://game/', '/safe/dist')).toEqual({
      ok: true,
      filePath: '/safe/dist/index.html',
    });
    expect(resolveAppRequest('app://game/_expo/chunk.js', '/safe/dist')).toEqual({
      ok: true,
      filePath: '/safe/dist/_expo/chunk.js',
    });
  });

  test('protocol denies mutation methods before file access', async () => {
    const fetchFile = jest.fn<Promise<Response>, [string]>();
    const handler = createAppProtocolHandler('/safe/dist', fetchFile);
    const response = await handler(new Request('app://game/', { method: 'POST' }));

    expect(response.status).toBe(405);
    expect(fetchFile).not.toHaveBeenCalled();
  });

  test('successful protocol responses retain CSP and nosniff headers', async () => {
    const handler = createAppProtocolHandler('/safe/dist', async () =>
      new Response('ok', { headers: { 'Content-Type': 'text/plain' }, status: 200 }),
    );
    const response = await handler(new Request('app://game/index.html'));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
    expect(response.headers.get('Content-Security-Policy')).toBe(APP_CONTENT_SECURITY_POLICY);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  test('CSP allows CanvasKit but not general unsafe eval or remote origins', () => {
    expect(APP_CONTENT_SECURITY_POLICY).toContain("'wasm-unsafe-eval'");
    expect(APP_CONTENT_SECURITY_POLICY).not.toContain("'unsafe-eval'");
    expect(APP_CONTENT_SECURITY_POLICY).toContain("connect-src 'self'");
    expect(APP_CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    expect(APP_CONTENT_SECURITY_POLICY).not.toMatch(/https?:/u);
  });

  test('IPC response and readiness payloads are closed', () => {
    expect(() =>
      RuntimeInfoSchema.parse({
        appVersion: '0.1.0',
        electronVersion: '43.3.0',
        extra: 'no',
        packaged: true,
        platform: 'darwin',
      }),
    ).toThrow();
    expect(() =>
      RendererReadySchema.parse({
        appUrl: 'app://game/',
        assetsLoaded: true,
        bridgeKeys: [
          'abortConversation', 'beginConversation', 'endConversation', 'getRuntimeInfo',
          'loadPresentationPreferences', 'loadSave', 'migrateSave', 'reportRendererReady', 'requestSave',
          'savePresentationPreferences', 'sendConversationTurn',
        ],
        canvasKitReady: true,
        nodeAccessBlocked: false,
      }),
    ).toThrow();
  });

  test('IPC handlers reject non-main-frame senders, extra payloads, and request floods', async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const ipcMain = {
      handle: jest.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler);
      }),
    } as unknown as IpcMain;
    registerRuntimeIpc(
      ipcMain,
      { appVersion: '0.1.0', electronVersion: '43.3.0', packaged: true, platform: 'darwin' },
      jest.fn(),
    );

    const mainFrame = { url: 'app://game/' };
    const trustedEvent = {
      sender: { id: 1, mainFrame },
      senderFrame: mainFrame,
    } as unknown as IpcMainInvokeEvent;
    expect(() =>
      handlers.get(IPC_CHANNELS.getRuntimeInfo)?.(trustedEvent, { unexpected: true }),
    ).toThrow('Unexpected IPC payload');

    const childFrame = { url: 'app://game/' };
    const childEvent = {
      sender: { id: 2, mainFrame },
      senderFrame: childFrame,
    } as unknown as IpcMainInvokeEvent;
    expect(() => handlers.get(IPC_CHANNELS.getRuntimeInfo)?.(childEvent)).toThrow(
      'trusted main frame',
    );

    const limiter = new IpcRateLimiter(2, 1_000);
    limiter.assertAllowed(7, 100);
    limiter.assertAllowed(7, 101);
    expect(() => limiter.assertAllowed(7, 102)).toThrow('rate exceeded');
  });

  test('preload exposes no raw IPC object or arbitrary invoke method', () => {
    const preload = readFileSync(resolve('electron/preload/index.ts'), 'utf8');
    expect(preload).toContain("contextBridge.exposeInMainWorld('siWorldDesktop', desktopBridge)");
    expect(preload).toContain("getRuntimeInfo: 'si-world:get-runtime-info'");
    expect(preload).toContain("loadPresentationPreferences: 'si-world:load-presentation-preferences'");
    expect(preload).toContain("reportRendererReady: 'si-world:report-renderer-ready'");
    expect(preload).toContain("loadSave: 'si-world:load-save'");
    expect(preload).toContain("requestSave: 'si-world:request-save'");
    expect(preload).toContain("savePresentationPreferences: 'si-world:save-presentation-preferences'");
    expect(preload).toContain("migrateSave: 'si-world:migrate-save'");
    expect(preload).toContain("beginConversation: 'si-world:begin-conversation'");
    expect(preload).toContain("sendConversationTurn: 'si-world:send-conversation-turn'");
    expect(preload).toContain("endConversation: 'si-world:end-conversation'");
    expect(preload).toContain("abortConversation: 'si-world:abort-conversation'");
    expect(preload).toMatch(/import type \{ RendererReadyReport, RuntimeInfo \}/u);
    expect(preload).not.toMatch(/import \{[^}]*IPC_CHANNELS/u);
    expect(preload).not.toMatch(/exposeInMainWorld\([^)]*ipcRenderer/u);
    expect(preload).not.toContain('invoke: ipcRenderer.invoke');
  });

  test('persistence IPC is main-frame-only, typed, size-bounded, and path-closed', async () => {
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    const ipcMain = {
      handle: jest.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler);
      }),
    } as unknown as IpcMain;
    const requestSave = jest.fn(async () => ({
      status: 'saved' as const,
      slotId: 'slot-001' as const,
      saveGeneration: 1,
      checksum: 'a'.repeat(64),
      maintenanceWarnings: [],
    }));
    const loadSave = jest.fn(async () => ({ status: 'empty' as const, slotId: 'slot-001' as const }));
    const migrateSave = jest.fn(async () => ({
      status: 'migrated' as const,
      sourceSlotId: 'slot-001' as const,
      targetSlotId: 'slot-002' as const,
      saveGeneration: 1,
      checksum: 'b'.repeat(64),
      stateSchemaVersion: 4,
      maintenanceWarnings: [],
    }));
    registerPersistenceIpc(ipcMain, { requestSave, loadSave, migrateSave });

    const mainFrame = { url: 'app://game/' };
    const trustedEvent = {
      sender: { id: 41, mainFrame },
      senderFrame: mainFrame,
    } as unknown as IpcMainInvokeEvent;
    const savePayload = {
      slotId: 'slot-001',
      expectedSaveGeneration: null,
      trigger: 'manual',
      state: createInitialState(),
    };
    await expect(handlers.get(PERSISTENCE_IPC_CHANNELS.requestSave)?.(trustedEvent, savePayload)).resolves.toEqual(
      expect.objectContaining({ status: 'saved', saveGeneration: 1 }),
    );
    expect(requestSave).toHaveBeenCalledTimes(1);
    await expect(handlers.get(PERSISTENCE_IPC_CHANNELS.loadSave)?.(trustedEvent, '../escape')).rejects.toThrow();
    await expect(
      handlers.get(PERSISTENCE_IPC_CHANNELS.requestSave)?.(trustedEvent, 'x'.repeat(2 * 1_024 * 1_024)),
    ).rejects.toThrow('size limit');
    await expect(handlers.get(PERSISTENCE_IPC_CHANNELS.migrateSave)?.(trustedEvent, {
      sourceSlotId: 'slot-001',
      targetSlotId: 'slot-001',
      nextGenerationId: 'generation-migrated-001',
    })).rejects.toThrow('must differ');

    const childFrame = { url: 'app://game/' };
    const childEvent = {
      sender: { id: 42, mainFrame },
      senderFrame: childFrame,
    } as unknown as IpcMainInvokeEvent;
    await expect(handlers.get(PERSISTENCE_IPC_CHANNELS.loadSave)?.(childEvent, 'slot-001')).rejects.toThrow(
      'trusted main frame',
    );
  });

  test('Linux CI keeps the Chromium sandbox enabled for packaged smoke', () => {
    const workflow = readFileSync(resolve('.github/workflows/ci.yml'), 'utf8');
    const forgeConfig = readFileSync(resolve('forge.config.ts'), 'utf8');
    const mainProcess = readFileSync(resolve('electron/main/index.ts'), 'utf8');
    expect(workflow).toContain("sandbox_path='out/si-world-linux-x64/chrome-sandbox'");
    expect(workflow).toContain("sudo chown root:root \"$sandbox_path\"");
    expect(workflow).toContain("sudo chmod 4755 \"$sandbox_path\"");
    expect(workflow).not.toContain('--no-sandbox');
    expect(workflow).toContain("SI_WORLD_SMOKE_SOFTWARE_RENDERING: '1'");
    expect(forgeConfig).toContain("process.platform === 'linux' ? 'si-world' : 'SI World'");
    expect(mainProcess).toContain("smokeMode && process.env.SI_WORLD_SMOKE_SOFTWARE_RENDERING === '1'");
    expect(mainProcess).toContain('app.disableHardwareAcceleration()');
  });

  test('Phase 14 CI packages and test-signs Intel macOS and Windows x64 shells', () => {
    const workflow = readFileSync(resolve('.github/workflows/ci.yml'), 'utf8');
    expect(workflow).toContain('runs-on: macos-15-intel');
    expect(workflow).toContain('npm run package:mac:x64');
    expect(workflow).toContain('npm run sign:test:mac');
    expect(workflow).toContain('artifacts/phase-14/macos-x64/current');
    expect(workflow).toContain('runs-on: windows-2025');
    expect(workflow).toContain('npm run package:windows:x64');
    expect(workflow).toContain('./scripts/qualification/sign-windows-test.ps1');
    expect(workflow).toContain('artifacts/phase-14/windows-x64/current');
    expect(workflow).toContain('without model qualification claims');
    expect(workflow.match(/SI_WORLD_SMOKE_PROFILE: platform-shell/gu)).toHaveLength(3);
    const windowsSigner = readFileSync(resolve('scripts/qualification/sign-windows-test.ps1'), 'utf8');
    expect(windowsSigner).toContain("Windows Kits\\10\\bin");
    expect(windowsSigner).toContain('Get-AuthenticodeSignature');
    expect(windowsSigner).toContain("$signature.Status -eq 'UnknownError'");
    expect(windowsSigner).toContain("$signature.StatusMessage -match 'root certificate.+not trusted'");
    expect(windowsSigner).toContain("$signature.Status -notin @('Valid', 'NotTrusted') -and -not $expectedUntrustedRoot");
    expect(windowsSigner).toContain("$tamperedSignature.Status -ne 'HashMismatch'");
    expect(windowsSigner).not.toContain('CurrentUser\\Root');
    expect(windowsSigner).not.toContain('certutil.exe');
    expect(workflow).toContain('timeout-minutes: 2');
  });
});
