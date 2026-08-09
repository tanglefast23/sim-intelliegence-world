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
        bridgeKeys: ['getRuntimeInfo', 'reportRendererReady'],
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
    expect(preload).toContain("reportRendererReady: 'si-world:report-renderer-ready'");
    expect(preload).toMatch(/import type \{ RendererReadyReport, RuntimeInfo \}/u);
    expect(preload).not.toMatch(/import \{[^}]*IPC_CHANNELS/u);
    expect(preload).not.toMatch(/exposeInMainWorld\([^)]*ipcRenderer/u);
    expect(preload).not.toContain('invoke: ipcRenderer.invoke');
  });

  test('Linux CI keeps the Chromium sandbox enabled for packaged smoke', () => {
    const workflow = readFileSync(resolve('.github/workflows/ci.yml'), 'utf8');
    const forgeConfig = readFileSync(resolve('forge.config.ts'), 'utf8');
    expect(workflow).toContain("sandbox_path='out/si-world-linux-x64/chrome-sandbox'");
    expect(workflow).toContain("sudo chown root:root \"$sandbox_path\"");
    expect(workflow).toContain("sudo chmod 4755 \"$sandbox_path\"");
    expect(workflow).not.toContain('--no-sandbox');
    expect(forgeConfig).toContain("process.platform === 'linux' ? 'si-world' : 'SI World'");
  });
});
