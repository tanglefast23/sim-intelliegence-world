import type { BrowserWindowConstructorOptions, WebContents } from 'electron';

import { APP_HOST, APP_SCHEME } from '../protocol/app-protocol';

export function lockedWebPreferences(preloadPath: string): NonNullable<BrowserWindowConstructorOptions['webPreferences']> {
  return {
    allowRunningInsecureContent: false,
    contextIsolation: true,
    devTools: false,
    enableWebSQL: false,
    navigateOnDragDrop: false,
    nodeIntegration: false,
    preload: preloadPath,
    sandbox: true,
    spellcheck: false,
    webSecurity: true,
    webviewTag: false,
  };
}

export function isTrustedAppUrl(candidate: string): boolean {
  try {
    const url = new URL(candidate);
    return (
      url.protocol === `${APP_SCHEME}:` &&
      url.hostname === APP_HOST &&
      url.port === '' &&
      url.username === '' &&
      url.password === ''
    );
  } catch {
    return false;
  }
}

export function lockWebContents(contents: WebContents): void {
  contents.on('will-navigate', (event, targetUrl) => {
    if (!isTrustedAppUrl(targetUrl)) {
      event.preventDefault();
    }
  });
  contents.on('will-attach-webview', (event) => event.preventDefault());
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
}
